import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, Menu, nativeImage, Notification, screen, shell, Tray } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { obtenerAjustes, guardarAjustes, guardarSecreto, borrarSecreto, leerSecreto, leerDatos, guardarDatos } from './almacen.js';
import { Gmail } from './gmail.js';
import { ConversacionClaude, mensajeDeError } from '../src/compartido/claude.js';
import { Recordatorios } from '../src/compartido/recordatorios.js';
import { Memoria } from '../src/compartido/memoria.js';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const URL_DESARROLLO = process.env.KITSUNE_DEV_URL;

// Medidas del zorro según el tamaño elegido y del diálogo que aparece encima.
const ZORRO = { pequeno: [210, 240], mediano: [260, 300], grande: [330, 380] };
const DIALOGO = [430, 480];

let ventana = null;
let bandeja = null;
let atajoActual = null;
let temporizadorCorreo = null;
let temporizadorCitas = null;
// Último texto del portapapeles que se ofreció, para no proponerlo dos veces.
let textoOfrecido = '';

const gmail = new Gmail(obtenerAjustes);
const recordatorios = new Recordatorios({
  leer: () => leerDatos('recordatorios'),
  guardar: (lista) => guardarDatos('recordatorios', lista),
  avisar: avisarRecordatorio,
});
// Lo que el usuario pide recordar es personal: va cifrado, como las claves.
const memoria = new Memoria({
  leer: () => {
    try {
      return JSON.parse(leerSecreto('memoria') ?? '[]');
    } catch {
      return [];
    }
  },
  guardar: (lista) => guardarSecreto('memoria', JSON.stringify(lista)),
});
const claude = new ConversacionClaude({
  obtenerClave: async () => leerSecreto('claveClaude'),
  obtenerAjustes,
  gmail,
  calendario: {
    estado: async () => ({ conectado: gmail.conCalendario }),
    eventos: (opciones) => gmail.calendario.eventos(opciones),
    crear: (evento) => gmail.calendario.crear(evento),
  },
  recordatorios,
  memoria,
  emitir: (evento) => ventana?.webContents.send('claude:evento', evento),
});

// A su hora: notificación del sistema y el zorro aparece con el aviso.
function avisarRecordatorio(recordatorio) {
  if (Notification.isSupported()) {
    const notificacion = new Notification({ title: 'Kitsune te recuerda', body: recordatorio.texto });
    notificacion.on('click', mostrar);
    notificacion.show();
  }
  if (ventana && !ventana.isVisible()) mostrar();
  ventana?.webContents.send('recordatorio:aviso', recordatorio);
}

function medidas(ajustes) {
  const [anchoZorro, altoZorro] = ZORRO[ajustes.tamano];
  const ancho = Math.max(DIALOGO[0] + 24, anchoZorro);
  const alto = altoZorro + DIALOGO[1] - 50;
  const { workArea } = screen.getPrimaryDisplay();
  const x = ajustes.posicion === 'izquierda' ? workArea.x : workArea.x + workArea.width - ancho;
  return { x, y: workArea.y + workArea.height - alto, width: ancho, height: alto };
}

function abrirEnlaceSeguro(url) {
  try {
    const { protocol } = new URL(url);
    if (['https:', 'http:', 'mailto:'].includes(protocol)) shell.openExternal(url);
  } catch {
    // URL mal formada: se ignora.
  }
}

function crearVentana() {
  const ajustes = obtenerAjustes();
  ventana = new BrowserWindow({
    ...medidas(ajustes),
    transparent: true,
    frame: false,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    show: false,
    backgroundColor: '#00000000',
    title: 'Kitsune',
    webPreferences: {
      preload: path.join(aqui, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  ventana.setAlwaysOnTop(true, 'floating');
  // Las zonas transparentes dejan pasar el ratón al escritorio; el renderer
  // avisa cuando el puntero está sobre el zorro o el diálogo.
  ventana.setIgnoreMouseEvents(true, { forward: true });

  ventana.webContents.setWindowOpenHandler(({ url }) => {
    abrirEnlaceSeguro(url);
    return { action: 'deny' };
  });
  ventana.webContents.on('will-navigate', (evento, url) => {
    if (url !== ventana.webContents.getURL()) {
      evento.preventDefault();
      abrirEnlaceSeguro(url);
    }
  });

  if (URL_DESARROLLO) ventana.loadURL(URL_DESARROLLO);
  else ventana.loadFile(path.join(aqui, '..', 'dist', 'index.html'));
  ventana.once('ready-to-show', () => mostrar());
}

function mostrar() {
  if (!ventana) return;
  ventana.show();
  ventana.focus();
  ventana.webContents.send('ventana:alternar', 'mostrar');
}

// Al llamarlo con el atajo, si hay texto nuevo copiado, Kitsune ofrece
// resumirlo, traducirlo… Solo se lee el portapapeles en ese momento.
function ofrecerPortapapeles() {
  if (!obtenerAjustes().ofrecerPortapapeles) return;
  const texto = clipboard.readText().trim();
  if (texto.length < 3 || texto === textoOfrecido) return;
  textoOfrecido = texto;
  ventana.webContents.send('ventana:texto', texto.slice(0, 8000));
}

function alternar() {
  if (!ventana) return;
  if (ventana.isVisible()) ventana.webContents.send('ventana:alternar', 'ocultar');
  else {
    mostrar();
    ofrecerPortapapeles();
  }
}

function registrarAtajo(atajo) {
  if (atajoActual) globalShortcut.unregister(atajoActual);
  let ok = false;
  try {
    ok = globalShortcut.register(atajo, alternar);
  } catch {
    ok = false;
  }
  if (ok) atajoActual = atajo;
  else if (atajoActual) globalShortcut.register(atajoActual, alternar);
  return ok;
}

function programarCorreo() {
  clearInterval(temporizadorCorreo);
  const { correoCadaMin } = obtenerAjustes();
  temporizadorCorreo = setInterval(comprobarCorreo, correoCadaMin * 60 * 1000);
  comprobarCorreo();
}

async function comprobarCorreo() {
  if (!gmail.conectado) return;
  try {
    const nuevos = await gmail.nuevos();
    if (!nuevos.length) return;
    ventana?.webContents.send('correo:nuevo', { cantidad: nuevos.length, ultimo: nuevos[0] });
    if (obtenerAjustes().avisarCorreo && Notification.isSupported()) {
      const [primero] = nuevos;
      const notificacion = new Notification({
        title: nuevos.length === 1 ? `Correo de ${primero.de.nombre}` : `${nuevos.length} correos nuevos`,
        body: primero.asunto,
        silent: true,
      });
      notificacion.on('click', mostrar);
      notificacion.show();
    }
  } catch {
    // Sin conexión o token caducado: se reintenta en la siguiente comprobación.
  }
}

// Aviso unos minutos antes de cada cita del calendario.
function programarCitas() {
  clearInterval(temporizadorCitas);
  temporizadorCitas = setInterval(comprobarCitas, 5 * 60 * 1000);
  comprobarCitas();
}

async function comprobarCitas() {
  if (!gmail.conCalendario || !obtenerAjustes().avisarCitas) return;
  try {
    for (const cita of await gmail.calendario.proximas(15)) {
      const hora = new Date(cita.inicio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      if (Notification.isSupported()) {
        const notificacion = new Notification({ title: `A las ${hora}: ${cita.titulo}`, body: cita.lugar || 'Dentro de poco' });
        notificacion.on('click', mostrar);
        notificacion.show();
      }
      ventana?.webContents.send('calendario:cita', cita);
    }
  } catch {
    // Sin conexión o sin permiso: se reintenta en la siguiente comprobación.
  }
}

function crearBandeja() {
  const icono = nativeImage.createFromPath(path.join(aqui, '..', 'assets', 'icono.png')).resize({ width: 16, height: 16 });
  bandeja = new Tray(icono);
  bandeja.setToolTip('Kitsune');
  bandeja.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Mostrar u ocultar', click: alternar },
      { label: 'Ajustes', click: () => { mostrar(); ventana.webContents.send('ventana:ajustes'); } },
      { type: 'separator' },
      { label: 'Salir', click: () => app.quit() },
    ]),
  );
  bandeja.on('click', alternar);
}

// Todos los canales responden { ok, datos } o { ok: false, error } y solo
// atienden a la ventana del asistente.
function manejar(canal, funcion) {
  ipcMain.handle(canal, async (evento, ...args) => {
    if (evento.sender !== ventana?.webContents) return { ok: false, error: 'Origen no permitido.' };
    try {
      return { ok: true, datos: await funcion(...args) };
    } catch (error) {
      return { ok: false, error: error.message || String(error) };
    }
  });
}

function registrarCanales() {
  manejar('ajustes:obtener', () => obtenerAjustes());
  manejar('ajustes:guardar', (cambios) => {
    const anteriores = obtenerAjustes();
    if (cambios.atajo && cambios.atajo !== anteriores.atajo && !registrarAtajo(cambios.atajo)) {
      throw new Error('Ese atajo no está disponible: puede que lo use otro programa.');
    }
    const ajustes = guardarAjustes(cambios);
    if (cambios.tamano || cambios.posicion) ventana.setBounds(medidas(ajustes));
    if ('iniciarConWindows' in cambios) app.setLoginItemSettings({ openAtLogin: ajustes.iniciarConWindows });
    if ('correoCadaMin' in cambios) programarCorreo();
    return ajustes;
  });

  manejar('claude:estado', () => ({ configurado: Boolean(leerSecreto('claveClaude')) }));
  manejar('claude:clave', async (clave) => {
    if (!clave) {
      borrarSecreto('claveClaude');
      return { configurado: false };
    }
    const limpia = String(clave).trim();
    try {
      await ConversacionClaude.probarClave(limpia, obtenerAjustes().modelo);
    } catch (error) {
      throw new Error(mensajeDeError(error));
    }
    guardarSecreto('claveClaude', limpia);
    return { configurado: true };
  });
  manejar('claude:enviar', (texto) => {
    if (typeof texto !== 'string' || !texto.trim()) throw new Error('Escribe un mensaje.');
    // Se resuelve al terminar el turno; el texto llega antes por 'claude:evento'.
    return claude.enviar(texto.trim().slice(0, 20000));
  });
  manejar('claude:cancelar', () => claude.cancelar());
  manejar('claude:reiniciar', () => claude.reiniciar());
  manejar('claude:mensajes', () => claude.mensajesVisibles());
  manejar('claude:confirmar', (id, acepta) => claude.responderConfirmacion(String(id), acepta === true));

  manejar('memoria:listar', () => memoria.listar());
  manejar('memoria:olvidar', (id) => memoria.olvidar(String(id ?? '')));
  manejar('memoria:olvidarTodo', () => memoria.olvidarTodo());
  manejar('claude:redactar', async (id, indicaciones) => claude.redactarRespuesta(await gmail.leer(id), String(indicaciones ?? '')));

  manejar('correo:estado', () => gmail.estado());
  manejar('correo:cliente', (secreto) => gmail.guardarCliente(String(secreto ?? '')));
  manejar('correo:conectar', async () => {
    const estado = await gmail.conectar();
    programarCorreo();
    programarCitas();
    return estado;
  });
  manejar('correo:desconectar', () => gmail.desconectar());
  manejar('correo:listar', (opciones) => gmail.listar(opciones));
  manejar('correo:leer', (id) => gmail.leer(id));
  manejar('correo:modificar', (id, cambios) => gmail.modificar(id, cambios));
  manejar('correo:enviar', (datos) => gmail.enviar(datos));

  manejar('recordatorios:listar', () => recordatorios.listar());
  manejar('recordatorios:borrar', (id) => recordatorios.borrar(String(id ?? '')));

  manejar('enlace:abrir', (url) => abrirEnlaceSeguro(url));

  ipcMain.on('ventana:ocultar', (evento) => {
    if (evento.sender === ventana?.webContents) ventana.hide();
  });
  ipcMain.on('ventana:raton', (evento, dentro) => {
    if (evento.sender === ventana?.webContents) ventana.setIgnoreMouseEvents(!dentro, { forward: true });
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', mostrar);
  app.setAppUserModelId('com.kitsune.asistente');
  app.whenReady().then(() => {
    registrarCanales();
    crearVentana();
    crearBandeja();
    if (!registrarAtajo(obtenerAjustes().atajo)) registrarAtajo('Control+Alt+K');
    programarCorreo();
    programarCitas();
    recordatorios.programar();
  });
  // Vive en la bandeja del sistema: cerrar la ventana no cierra la app.
  app.on('window-all-closed', () => {});
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
