import { app, BrowserWindow, clipboard, globalShortcut, ipcMain, Menu, nativeImage, Notification, screen, shell, Tray } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  obtenerAjustes,
  guardarAjustes,
  guardarSecreto,
  borrarSecreto,
  leerSecreto,
  leerDatos,
  guardarDatos,
  leerCifrado,
  guardarCifrado,
  borrarCifrado,
} from './almacen.js';
import { Gmail } from './gmail.js';
import { ConversacionClaude, mensajeDeError } from '../src/compartido/claude.js';
import { Recordatorios } from '../src/compartido/recordatorios.js';
import { Memoria } from '../src/compartido/memoria.js';
import { Conversaciones, ID_CONVERSACION } from '../src/compartido/conversaciones.js';
import { servidor, sincronizarRecordatorios, automatizacionesChat } from './avisos.js';
import { aviso } from '../src/compartido/notificaciones.js';
import { normalizarDatosEmpleo } from '../src/compartido/empleo.js';
import { hablarVoiceStudio, vocesVoiceStudio } from './voicestudio.js';
import { transcribirGroq } from '../src/compartido/dictado.js';

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
  guardar: (lista) => {
    guardarDatos('recordatorios', lista);
    sincronizarRecordatorios();
  },
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
const conversaciones = new Conversaciones({
  leerIndice: () => leerCifrado('indice') ?? [],
  guardarIndice: (lista) => guardarCifrado('indice', lista),
  leer: (id) => leerCifrado(id),
  guardar: (id, datos) => guardarCifrado(id, datos),
  borrar: (id) => borrarCifrado(id),
});
// Cada IA tiene su clave, cifrada con el sistema.
const SECRETO_CLAVE = { claude: 'claveClaude', groq: 'claveGroq' };
const proveedorValido = (p) => (p === 'groq' || p === 'claude' ? p : obtenerAjustes().proveedor);
const estadoIA = () => {
  const proveedor = obtenerAjustes().proveedor;
  return {
    proveedor,
    configurado: Boolean(leerSecreto(SECRETO_CLAVE[proveedor])),
    claves: { claude: Boolean(leerSecreto('claveClaude')), groq: Boolean(leerSecreto('claveGroq')) },
  };
};

const claude = new ConversacionClaude({
  obtenerClave: async (proveedor) => leerSecreto(SECRETO_CLAVE[proveedorValido(proveedor)]),
  obtenerAjustes,
  gmail,
  calendario: {
    estado: async () => ({ conectado: gmail.conCalendario }),
    eventos: (opciones) => gmail.calendario.eventos(opciones),
    crear: (evento) => gmail.calendario.crear(evento),
    obtener: (id) => gmail.calendario.obtener(id),
    modificar: (id, cambios) => gmail.calendario.modificar(id, cambios),
    borrar: (id) => gmail.calendario.borrar(id),
  },
  recordatorios,
  memoria,
  automatizaciones: automatizacionesChat,
  emitir: (evento) => ventana?.webContents.send('claude:evento', evento),
  alCambiarHistorial: (historial, id) => conversaciones.guardar(id, historial).catch(() => {}),
});

// Un evento creado desde la Agenda: se valida lo que llega del renderer.
function eventoValido(e) {
  const texto = (v, max) => (v === undefined ? '' : typeof v === 'string' && v.length <= max ? v : null);
  if (!e || typeof e.titulo !== 'string' || !e.titulo.trim() || e.titulo.length > 200) return null;
  if (!Number.isFinite(e.inicio) || !Number.isFinite(e.fin) || e.fin < e.inicio || typeof (e.todoElDia ?? false) !== 'boolean') return null;
  const lugar = texto(e.lugar, 200);
  const descripcion = texto(e.descripcion, 2000);
  if (lugar === null || descripcion === null) return null;
  return { titulo: e.titulo.trim(), inicio: e.inicio, fin: e.fin, todoElDia: e.todoElDia ?? false, lugar, descripcion };
}

function exigirCalendario() {
  if (!gmail.conCalendario) throw new Error('Conecta tu calendario de Google en Ajustes.');
}

// A su hora: notificación del sistema y el zorro aparece con el aviso.
function avisarRecordatorio(recordatorio) {
  if (Notification.isSupported()) {
    const { titulo, cuerpo } = aviso(recordatorio.texto);
    const notificacion = new Notification({ title: titulo, body: cuerpo });
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
// En Electron 45 leer el portapapeles es asíncrono (devuelve una promesa); con
// await vale igual para las versiones que lo devuelven directamente.
async function ofrecerPortapapeles() {
  if (!obtenerAjustes().ofrecerPortapapeles || !ventana) return;
  const texto = String((await clipboard.readText()) ?? '').trim();
  if (texto.length < 3 || texto === textoOfrecido) return;
  textoOfrecido = texto;
  ventana.webContents.send('ventana:texto', texto.slice(0, 8000));
}

function alternar() {
  if (!ventana) return;
  if (ventana.isVisible()) ventana.webContents.send('ventana:alternar', 'ocultar');
  else {
    mostrar();
    // Si el portapapeles no se puede leer, no se ofrece nada; la app sigue.
    ofrecerPortapapeles().catch(() => {});
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
      const { titulo, cuerpo } = nuevos.length === 1 ? aviso(primero.asunto || '(sin asunto)', `De ${primero.de.nombre}`) : aviso(`${nuevos.length} correos nuevos`, `De ${primero.de.nombre} y más`);
      const notificacion = new Notification({ title: titulo, body: cuerpo, silent: true });
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
        const { titulo, cuerpo } = aviso(cita.titulo, [`a las ${hora}`, cita.lugar].filter(Boolean).join(' · '));
        const notificacion = new Notification({ title: titulo, body: cuerpo });
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

  manejar('claude:estado', () => estadoIA());
  manejar('claude:clave', async (clave, proveedor) => {
    const ia = proveedorValido(proveedor);
    if (!clave) {
      borrarSecreto(SECRETO_CLAVE[ia]);
      return estadoIA();
    }
    const limpia = String(clave).trim().slice(0, 300);
    try {
      await ConversacionClaude.probarClave(limpia, obtenerAjustes().modelo, {}, ia);
    } catch (error) {
      throw new Error(mensajeDeError(error));
    }
    guardarSecreto(SECRETO_CLAVE[ia], limpia);
    return estadoIA();
  });
  manejar('claude:enviar', (texto) => {
    if (typeof texto !== 'string' || !texto.trim()) throw new Error('Escribe un mensaje.');
    // Se resuelve al terminar el turno; el texto llega antes por 'claude:evento'.
    return claude.enviar(texto.trim().slice(0, 20000));
  });
  manejar('claude:cancelar', () => claude.cancelar());
  manejar('claude:reiniciar', () => claude.reiniciar());
  manejar('claude:mensajes', () => claude.mensajesVisibles());
  manejar('conversaciones:listar', async () => ({ lista: await conversaciones.listar(), actual: claude.id }));
  manejar('conversaciones:abrir', async (id) => {
    if (claude.controlador) throw new Error('Espera a que termine la respuesta.');
    const datos = await conversaciones.cargar(String(id ?? ''));
    if (!datos || !claude.restaurar(datos.historial, id)) throw new Error('No se ha podido abrir esa conversación.');
    return claude.mensajesVisibles();
  });
  manejar('conversaciones:borrar', async (id) => {
    if (!ID_CONVERSACION.test(String(id))) throw new Error('Identificador de conversación no válido.');
    if (id === claude.id) claude.reiniciar();
    return conversaciones.borrar(id);
  });
  manejar('conversaciones:borrarTodo', async () => {
    claude.reiniciar();
    await conversaciones.borrarTodo();
  });

  manejar('calendario:estado', () => ({ conectado: gmail.conectado, calendario: gmail.conCalendario }));
  manejar('calendario:eventos', (desde, hasta) => {
    exigirCalendario();
    if (!Number.isFinite(desde) || !Number.isFinite(hasta) || hasta <= desde) throw new Error('Fechas no válidas.');
    return gmail.calendario.eventos({ desde, hasta, maximo: 250 });
  });
  manejar('calendario:crear', (evento) => {
    exigirCalendario();
    const valido = eventoValido(evento);
    if (!valido) throw new Error('Revisa los datos del evento.');
    return gmail.calendario.crear(valido);
  });
  manejar('calendario:borrar', (id) => {
    exigirCalendario();
    return gmail.calendario.borrar(String(id ?? ''));
  });
  manejar('claude:confirmar', (id, acepta) => claude.responderConfirmacion(String(id), acepta === true));

  manejar('memoria:listar', () => memoria.listar());
  manejar('memoria:recordar', (texto) => memoria.recordar(String(texto ?? '')));
  manejar('memoria:olvidar', (id) => memoria.olvidar(String(id ?? '')));
  manejar('memoria:olvidarTodo', () => memoria.olvidarTodo());
  manejar('claude:redactar', async (id, indicaciones) => claude.redactarRespuesta(await gmail.leer(id), String(indicaciones ?? '')));
  manejar('ia:tarea', (p) =>
    claude.tarea({
      sistema: String(p?.sistema ?? '').slice(0, 20000),
      usuario: String(p?.usuario ?? '').slice(0, 60000),
      web: p?.web === true,
      max: Math.min(16000, Math.max(500, Number(p?.max) || 4000)),
    }),
  );
  manejar('ia:transcribir', async (audio, tipo) => {
    const bytes = audio instanceof Uint8Array ? audio : new Uint8Array(audio ?? []);
    const clave = leerSecreto('claveGroq');
    const hayServidor = Boolean(leerSecreto('servidorToken'));
    if (clave) {
      try {
        return await transcribirGroq({ apiKey: clave, audio: bytes, tipo: String(tipo ?? '') });
      } catch (error) {
        if (!hayServidor) throw error;
      }
    }
    if (hayServidor) return servidor.transcribir(bytes, String(tipo ?? ''));
    throw new Error('Para dictar necesito tu clave gratuita de Groq (Ajustes → Inteligencia artificial) o vincular el servidor de avisos.');
  });
  manejar('empleo:leer', () => JSON.parse(leerSecreto('empleo') ?? 'null'));
  manejar('empleo:guardar', (datos) => guardarSecreto('empleo', JSON.stringify(normalizarDatosEmpleo(datos))));

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
  manejar('recordatorios:crear', (datos) => recordatorios.crear({ texto: String(datos?.texto ?? ''), cuando: Number(datos?.cuando) }));
  manejar('recordatorios:borrar', (id) => recordatorios.borrar(String(id ?? '')));

  manejar('servidor:estado', () => servidor.estado());
  manejar('servidor:canjear', (codigo) => servidor.canjear(String(codigo ?? '')));
  manejar('servidor:probar', () => servidor.probar());
  manejar('servidor:voz', (texto, voz) => servidor.voz(texto, voz));
  manejar('voicestudio:hablar', (texto) => hablarVoiceStudio(obtenerAjustes().voicestudioUrl, String(texto ?? ''), obtenerAjustes().voicestudioVoz));
  manejar('voicestudio:voces', () => vocesVoiceStudio(obtenerAjustes().voicestudioUrl));
  manejar('servidor:empleoBuscar', (datos) => servidor.empleo.buscar(datos));
  manejar('servidor:empleoDetalle', (url) => servidor.empleo.detalle(url));
  manejar('servidor:resumen', () => servidor.resumen());
  manejar('servidor:codigo', () => servidor.crearCodigo());
  manejar('servidor:avisos', (avisos) => servidor.avisos(avisos));
  manejar('servidor:groq', (activar) => servidor.groq(activar === true));
  manejar('servidor:automatizaciones', () => servidor.automatizaciones.listar());
  manejar('servidor:crearAutomatizacion', (datos) => servidor.automatizaciones.crear(datos));
  manejar('servidor:actualizarAutomatizacion', (id, datos) => servidor.automatizaciones.actualizar(String(id), datos));
  manejar('servidor:borrarAutomatizacion', (id) => servidor.automatizaciones.borrar(String(id)));
  manejar('servidor:registro', () => servidor.registro());
  manejar('servidor:quitarDispositivo', (id) => servidor.quitarDispositivo(id));
  manejar('servidor:desvincular', () => servidor.desvincular());

  manejar('enlace:abrir', (url) => abrirEnlaceSeguro(url));

  ipcMain.on('ventana:ocultar', (evento) => {
    if (evento.sender === ventana?.webContents) ventana.hide();
  });
  ipcMain.on('ventana:raton', (evento, dentro) => {
    if (evento.sender === ventana?.webContents) ventana.setIgnoreMouseEvents(!dentro, { forward: true });
  });
}

// Solo en las pruebas automáticas: pulsar el atajo sin teclado.
if (process.env.KITSUNE_PRUEBAS === '1') globalThis.kitsunePruebas = { alternar };

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
    // Si la última conversación es de hace poco, se sigue con ella.
    conversaciones.reciente().then(async (ultima) => {
      const datos = ultima && (await conversaciones.cargar(ultima.id));
      if (datos) claude.restaurar(datos.historial, ultima.id);
    });
  });
  // Vive en la bandeja del sistema: cerrar la ventana no cierra la app.
  app.on('window-all-closed', () => {});
  app.on('will-quit', () => globalShortcut.unregisterAll());
}
