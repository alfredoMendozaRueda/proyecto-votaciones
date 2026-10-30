import { Kitsune } from '../kitsune/Kitsune.js';
import { crearDemo } from './demo.js';
import { crearBackendWeb } from './web/backend.js';
import { crearChat } from './chat.js';
import { crearCorreo } from './correo.js';
import { crearAjustes } from './ajustes.js';
import { crearAgenda, crearRecordatorios, crearMemoria, crearHistorial } from './vistas.js';
import { icono } from './iconos.js';
import { prepararMovil } from './movil.js';

// Electron trae window.asistente (preload). En el navegador se usa la versión
// web real, salvo en el modo de ejemplo (?demo o la página de demostración).
const modoEjemplo = window.KITSUNE_DEMO === true || new URLSearchParams(location.search).has('demo');
const api = window.asistente ?? (modoEjemplo ? crearDemo() : crearBackendWeb());
document.documentElement.dataset.plataforma = api.plataforma;

// El proceso principal puede pedir "mostrar" antes de que todo esté listo.
const pendientes = [];
let manejarAlternar = null;
api.ventana.alAlternar((accion) => (manejarAlternar ? manejarAlternar(accion) : pendientes.push(accion)));

const escena = document.getElementById('escena');
const dialogo = document.getElementById('dialogo');
const insignia = document.getElementById('insignia-correo');
const insigniaRecordatorios = document.getElementById('insignia-recordatorios');
const vistas = Object.fromEntries(
  ['chat', 'correo', 'agenda', 'recordatorios', 'memoria', 'historial', 'ajustes'].map((v) => [v, document.getElementById(`vista-${v}`)]),
);
const pestanas = Object.fromEntries([...document.querySelectorAll('.apartados [data-vista]')].map((b) => [b.dataset.vista, b]));
for (const span of document.querySelectorAll('.apartado__icono')) span.innerHTML = icono(span.dataset.icono, 18);
document.getElementById('boton-ajustes').innerHTML = icono('ajustes');
document.getElementById('boton-cerrar').innerHTML = icono('cerrar');
document.getElementById('boton-nueva').innerHTML = icono('conversacion');

let ajustes;
let kitsune;
let chat;
let correo;
let panelAjustes;
// Disposición de móvil de la versión web (null en Electron).
let movil = null;
// Apartados que se vuelven a pintar cada vez que se abren.
const apartados = {};
let vistaActual = 'chat';
let noLeidos = 0;
let ultimaActividad = Date.now();
let ratonDentro = false;
// En pantallas táctiles no se enfoca el chat solo: abriría el teclado sin pedirlo.
const tactil = matchMedia('(pointer: coarse)').matches;
const enfocarChat = () => !tactil && chat.enfocar();
// Un toque de vibración en móviles Android (iPhone no la permite en la web).
const vibrar = (patron) => tactil && navigator.vibrate?.(patron);

function aplicarAjustes(a) {
  escena.dataset.tamano = a.tamano;
  escena.dataset.posicion = a.posicion;
  kitsune.setPaleta(a.paleta);
  kitsune.setOpcion('seguirCursor', a.seguirCursor);
  kitsune.setOpcion('fuegos', a.fuegos);
  kitsune.setCalidad(a.calidadPelo);
}

function mostrarVista(nombre, seccionAjustes = null) {
  vistaActual = nombre;
  for (const [clave, vista] of Object.entries(vistas)) vista.hidden = clave !== nombre;
  for (const [clave, pestana] of Object.entries(pestanas)) {
    pestana.setAttribute('aria-selected', String(clave === nombre));
    pestana.tabIndex = clave === nombre ? 0 : -1;
  }
  // El apartado activo, a la vista si la barra se ha desplazado (pantallas estrechas).
  pestanas[nombre]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  document.getElementById('boton-ajustes').setAttribute('aria-pressed', String(nombre === 'ajustes'));
  movil?.alCambiarVista(nombre);
  if (nombre === 'ajustes') panelAjustes.abrir(seccionAjustes);
  if (nombre === 'chat') enfocarChat();
  apartados[nombre]?.mostrar();
}

// Insignia de Recordatorios: los que quedan para hoy.
async function contarRecordatoriosDeHoy() {
  const pendientes = await api.recordatorios?.listar().catch(() => []);
  const fin = new Date();
  fin.setHours(23, 59, 59, 999);
  const hoy = (pendientes ?? []).filter((r) => r.cuando <= fin.getTime()).length;
  insigniaRecordatorios.hidden = hoy === 0;
  insigniaRecordatorios.textContent = String(hoy);
  recordatoriosHoy = hoy;
  ponerInsigniaApp();
}

function abrirDialogo() {
  // En el móvil se abre con la transición: el zorro se encoge y el diálogo le sale de la boca.
  if (movil?.activo()) return movil.abrir();
  dialogo.classList.remove('cerrandose');
  dialogo.hidden = false;
  if (vistaActual === 'chat') enfocarChat();
}

function cerrarDialogo() {
  if (movil?.activo()) return movil.cerrar();
  if (dialogo.hidden) return Promise.resolve();
  dialogo.classList.add('cerrandose');
  return new Promise((resolver) =>
    setTimeout(() => {
      dialogo.hidden = true;
      dialogo.classList.remove('cerrandose');
      resolver();
    }, 160),
  );
}

function ponerNoLeidos(n) {
  noLeidos = n === null ? noLeidos + 1 : n;
  insignia.hidden = noLeidos === 0;
  insignia.textContent = noLeidos > 99 ? '99+' : String(noLeidos);
  ponerInsigniaApp();
}

// Número en el icono de la app instalada: correos sin leer y recordatorios de hoy.
let recordatoriosHoy = 0;
function ponerInsigniaApp() {
  if (api.plataforma !== 'web' || !('setAppBadge' in navigator)) return;
  const total = noLeidos + recordatoriosHoy;
  (total ? navigator.setAppBadge(total) : navigator.clearAppBadge()).catch(() => {});
}

function actividad() {
  ultimaActividad = Date.now();
  if (kitsune?.estado === 'dormir') kitsune.setEstado('reposo');
}

// ---------- Voz (opcional): voces en español del sistema ----------

function hablarEnVoz(texto) {
  if (!('speechSynthesis' in window)) return Promise.resolve();
  const limpio = texto.replace(/[*_`>#]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1');
  const frase = new SpeechSynthesisUtterance(limpio);
  frase.lang = 'es-ES';
  frase.voice = speechSynthesis.getVoices().find((v) => v.lang?.startsWith('es')) ?? null;
  // Cada palabra pronunciada mueve la boca del zorro.
  frase.onboundary = (e) => kitsune.pulsoHabla(e.charLength || 5);
  return new Promise((resolver) => {
    frase.onend = resolver;
    frase.onerror = resolver;
    speechSynthesis.cancel();
    speechSynthesis.speak(frase);
  });
}

// El chat avisa de lo que está pasando y el zorro lo representa.
async function alEstadoChat(estado, texto) {
  actividad();
  if (estado === 'hablar' && texto) kitsune.pulsoHabla(texto.length);
  if (estado === 'fin') {
    if (ajustes.voz && texto) {
      kitsune.setEstado('hablar');
      await hablarEnVoz(texto);
    }
    setTimeout(() => kitsune.estado === 'hablar' && kitsune.setEstado('reposo'), 500);
    return;
  }
  kitsune.setEstado(estado);
}

async function iniciar() {
  ajustes = await api.ajustes.obtener();
  kitsune = new Kitsune(document.getElementById('zorro'), {
    paleta: ajustes.paleta,
    seguirCursor: ajustes.seguirCursor,
    fuegos: ajustes.fuegos,
    zoom: 1.22,
  });
  aplicarAjustes(ajustes);

  chat = crearChat({
    contenedor: vistas.chat,
    api,
    alEstado: alEstadoChat,
    abrirAjustes: (seccion) => mostrarVista('ajustes', seccion),
    obtenerAjustes: () => ajustes,
  });
  correo = crearCorreo({
    contenedor: vistas.correo,
    api,
    abrirAjustes: (seccion) => mostrarVista('ajustes', seccion),
    alNoLeidos: ponerNoLeidos,
  });
  panelAjustes = crearAjustes({
    contenedor: vistas.ajustes,
    api,
    alCerrar: () => mostrarVista('chat'),
    alCambiar: (nuevos, cambios) => {
      ajustes = nuevos;
      aplicarAjustes(nuevos);
      if ('claveClaude' in cambios) chat.comprobarClave();
      if ('correo' in cambios) correo.recargar();
    },
  });

  apartados.agenda = crearAgenda({
    contenedor: vistas.agenda,
    api,
    abrirAjustes: (seccion) => mostrarVista('ajustes', seccion),
    preguntar: (texto) => {
      mostrarVista('chat');
      chat.preguntar(texto);
    },
  });
  apartados.recordatorios = crearRecordatorios({
    contenedor: vistas.recordatorios,
    api,
    web: api.plataforma === 'web',
    alCambiar: contarRecordatoriosDeHoy,
  });
  apartados.memoria = crearMemoria({
    contenedor: vistas.memoria,
    api,
    obtenerAjustes: () => ajustes,
    guardarAjustes: async (cambios) => {
      ajustes = await api.ajustes.guardar(cambios);
    },
  });
  apartados.historial = crearHistorial({
    contenedor: vistas.historial,
    api,
    alAbrir: (mensajesConversacion) => {
      chat.cargar(mensajesConversacion);
      mostrarVista('chat');
    },
    alNueva: async ({ irAlChat = true } = {}) => {
      await chat.nueva();
      if (irAlChat) mostrarVista('chat');
    },
  });

  for (const [nombre, pestana] of Object.entries(pestanas)) {
    pestana.addEventListener('click', () => {
      // En la web, la sesión de Google dura una hora: se renueva con este mismo toque.
      if (nombre === 'correo' || nombre === 'agenda') api.correo.renovar?.();
      if (nombre !== vistaActual) vibrar(6);
      mostrarVista(nombre);
    });
  }
  api.correo.alRenovado?.(() => {
    correo.recargar();
    if (vistaActual === 'agenda') apartados.agenda.mostrar();
  });
  // Flechas para moverse entre apartados, como en cualquier lista de pestañas.
  document.querySelector('.apartados').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    const orden = Object.keys(pestanas);
    const actual = orden.indexOf(document.activeElement?.dataset.vista);
    if (actual < 0) return;
    e.preventDefault();
    const siguiente =
      e.key === 'Home' ? 0 : e.key === 'End' ? orden.length - 1 : (actual + (e.key === 'ArrowRight' ? 1 : -1) + orden.length) % orden.length;
    mostrarVista(orden[siguiente]);
    pestanas[orden[siguiente]].focus();
  });
  contarRecordatoriosDeHoy();
  setInterval(contarRecordatoriosDeHoy, 60_000);
  api.claude.alEvento((e) => e.tipo === 'recordatorio' && contarRecordatoriosDeHoy());
  document.getElementById('boton-ajustes').addEventListener('click', () =>
    mostrarVista(vistaActual === 'ajustes' ? 'chat' : 'ajustes'),
  );
  document.getElementById('boton-cerrar').addEventListener('click', cerrarDialogo);
  const nuevaConversacion = async () => {
    await chat.nueva();
    mostrarVista('chat');
  };
  document.getElementById('boton-nueva').addEventListener('click', nuevaConversacion);
  if (api.plataforma !== 'electron') {
    movil = prepararMovil({
      escena,
      dialogo,
      zorro: document.getElementById('zorro'),
      kitsune,
      mostrarVista,
      obtenerVista: () => vistaActual,
      nuevaConversacion,
      vibrar,
    });
  }

  kitsune.on('caricia', () => {
    actividad();
    vibrar(12);
  });

  kitsune.on('toque', () => {
    actividad();
    vibrar(8);
    // En el móvil tocar al zorro abre el diálogo o, si ya está abierto, lo recoge.
    if (movil?.activo()) {
      movil.alternar();
      return;
    }
    if (dialogo.hidden) {
      abrirDialogo();
      kitsune.reproducir('saludar');
    } else {
      kitsune.reproducir('alegria');
    }
  });

  api.ventana.alAbrirAjustes(() => {
    abrirDialogo();
    mostrarVista('ajustes');
  });

  // Texto copiado al llamarlo con el atajo (Windows): propone qué hacer con él.
  api.ventana.alTexto?.((texto) => {
    abrirDialogo();
    mostrarVista('chat');
    chat.ofrecerTexto(texto);
  });

  // Una cita del calendario empieza pronto.
  api.calendario?.alCita((cita) => {
    actividad();
    abrirDialogo();
    mostrarVista('chat');
    chat.avisoCita(cita);
    vibrar([30, 60, 30]);
    setTimeout(() => kitsune.reproducir('alegria'), kitsune.accion?.nombre === 'aparecer' ? 1700 : 0);
  });

  // Llega la hora de un recordatorio: el zorro avisa y lo deja escrito en el chat.
  api.recordatorios?.alAviso((r) => {
    actividad();
    abrirDialogo();
    mostrarVista('chat');
    chat.avisoRecordatorio(r);
    contarRecordatoriosDeHoy();
    vibrar([30, 60, 30]);
    // Si acaba de aparecer (Electron lo muestra para avisar), primero termina de aparecer.
    setTimeout(() => kitsune.reproducir('alegria'), kitsune.accion?.nombre === 'aparecer' ? 1700 : 0);
  });

  api.correo.alNuevo(() => {
    vibrar(20);
    if (ajustes.avisarCorreo) {
      if (kitsune.estado === 'dormir') kitsune.setEstado('reposo');
      kitsune.reproducir('alegria');
    }
  });

  manejarAlternar = async (accion) => {
    if (accion === 'mostrar') {
      // En el móvil el zorro vive dentro del diálogo: primero se abre y luego aparece.
      // En el móvil la app empieza solo con el zorro: el diálogo se abre al tocarlo.
      if (movil?.activo()) {
        await kitsune.reproducir('aparecer');
      } else {
        await kitsune.reproducir('aparecer');
        abrirDialogo();
      }
      // Saludo solo la primera vez de cada día.
      const hoy = new Date().toDateString();
      try {
        if (localStorage.getItem('ultimoSaludo') !== hoy) {
          localStorage.setItem('ultimoSaludo', hoy);
          kitsune.reproducir('saludar');
        }
      } catch {
        // Sin almacenamiento local: se saluda igualmente.
      }
    } else {
      await cerrarDialogo();
      await kitsune.reproducir('desaparecer');
      api.ventana.ocultar();
    }
  };
  pendientes.splice(0).forEach(manejarAlternar);

  window.addEventListener('keydown', (e) => {
    actividad();
    if (e.key === 'Escape') {
      if (!dialogo.hidden) cerrarDialogo();
      // En la web no hay atajo global para volver a llamarlo: el zorro se queda.
      else if (api.plataforma !== 'web') manejarAlternar('ocultar');
    }
  });

  // Clic a través de lo transparente: solo el diálogo y el zorro reciben el ratón.
  document.addEventListener('mousemove', (e) => {
    const dentro = Boolean(e.target.closest?.('.dialogo')) || kitsune.tocaEn(e.clientX, e.clientY);
    if (dentro) actividad();
    if (dentro !== ratonDentro) {
      ratonDentro = dentro;
      api.ventana.ratonDentro(dentro);
    }
  });

  // Se duerme tras unos minutos sin uso.
  setInterval(() => {
    const minutos = ajustes.dormirTrasMin;
    if (minutos > 0 && kitsune.estado === 'reposo' && Date.now() - ultimaActividad > minutos * 60_000) {
      kitsune.setEstado('dormir');
    }
  }, 10_000);

  if (api.plataforma !== 'electron') vigilarTeclado();
  if (api.demo) prepararDemo();
  if (api.plataforma === 'web') prepararWeb();
}

// En pantallas anchas la "ventana" de 454×730 se reduce si no cabe; en móvil
// manda la disposición a pantalla completa del CSS.
function ajustarEscala(barra = 0) {
  const escalar = () => {
    const escala = Math.min(1, window.innerWidth / 460, (window.innerHeight - barra) / 735);
    escena.style.transform = window.innerWidth > 600 && escala < 1 ? `scale(${escala})` : '';
  };
  escalar();
  window.addEventListener('resize', escalar);
}

// En el móvil, mientras se escribe el zorro se aparta para dejar sitio al teclado.
function vigilarTeclado() {
  const esCampo = (el) => el?.matches?.('textarea, input:not([type=checkbox]):not([type=radio]), select');
  document.addEventListener('focusin', (e) => {
    if (esCampo(e.target) && window.innerWidth <= 600) escena.classList.add('teclado');
  });
  document.addEventListener('focusout', () => {
    setTimeout(() => {
      if (!esCampo(document.activeElement)) escena.classList.remove('teclado');
    }, 120);
  });
}

// Versión web: no hay atajo global; el zorro aparece al abrir la app.
function prepararWeb() {
  ajustarEscala();
  manejarAlternar('mostrar');
  atenderParametros();
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.tipo !== 'abrir-correo') return;
      abrirDialogo();
      mostrarVista('correo');
    });
  }
}

// Llegadas desde fuera: el aviso de correo (?correo), los atajos del icono
// (?pulso) o "Compartir" desde otra app (?texto, ?enlace, ?titulo).
function atenderParametros() {
  const parametros = new URLSearchParams(location.search);
  const compartido = ['titulo', 'texto', 'enlace'].map((c) => parametros.get(c)?.trim()).filter(Boolean);
  if (parametros.has('correo')) mostrarVista('correo');
  else if (parametros.has('agenda')) mostrarVista('agenda');
  else if (parametros.has('recordatorios')) mostrarVista('recordatorios');
  else if (parametros.has('pulso')) chat.preguntar('Prepárame el pulso de hoy');
  else if (compartido.length) {
    mostrarVista('chat');
    chat.ofrecerTexto([...new Set(compartido)].join('\n'), 'compartido');
  }
  // Llegar con una acción abre el diálogo directamente; que recargar no la repita.
  if ([...parametros.keys()].some((c) => ['correo', 'agenda', 'recordatorios', 'pulso', 'chat', 'titulo', 'texto', 'enlace'].includes(c))) {
    abrirDialogo();
    history.replaceState(null, '', location.pathname);
  }
}

// Solo en el navegador: escritorio simulado y el atajo funcionando dentro de la página.
function prepararDemo() {
  document.body.classList.add('demo');
  ajustarEscala(48);
  window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.altKey && e.code === 'KeyK') {
      e.preventDefault();
      api.simular.alternar(kitsune.visible ? 'ocultar' : 'mostrar');
    }
  });
  window.kitsuneDemo = { api, kitsune, mostrarVista, abrirDialogo, cerrarDialogo, correo, chat };
  api.simular.alternar('mostrar');
}

iniciar();
