import { Kitsune } from '../kitsune/Kitsune.js';
import { crearDemo } from './demo.js';
import { crearBackendWeb } from './web/backend.js';
import { crearChat } from './chat.js';
import { crearCorreo } from './correo.js';
import { crearAjustes } from './ajustes.js';
import { crearEmpleo } from './empleo.js';
import { crearHoy } from './hoy.js';
import { crearAgenda, crearRecordatorios, crearMemoria, crearHistorial } from './vistas.js';
import { icono } from './iconos.js';
import { trozosDeVoz, limpiarParaVoz } from '../compartido/voz.js';
import { prepararMovil } from './movil.js';
import { prepararBloqueo } from './web/bloqueo.js';
import { prepararOndas, prepararIndicador, entrarVista, saltar, prepararEnvio } from './animaciones.js';

// Electron trae window.asistente (preload). En el navegador se usa la versión
// web real, salvo en el modo de ejemplo (?demo o la página de demostración).
const modoEjemplo = window.KITSUNE_DEMO === true || new URLSearchParams(location.search).has('demo');
const api = window.asistente ?? (modoEjemplo ? crearDemo() : crearBackendWeb());
document.documentElement.dataset.plataforma = api.plataforma;
// Face ID: lo primero, antes de enseñar nada.
if (api.plataforma === 'web' && !modoEjemplo) prepararBloqueo();

// El proceso principal puede pedir "mostrar" antes de que todo esté listo.
const pendientes = [];
let manejarAlternar = null;
api.ventana.alAlternar((accion) => (manejarAlternar ? manejarAlternar(accion) : pendientes.push(accion)));

const escena = document.getElementById('escena');
const dialogo = document.getElementById('dialogo');
const insignia = document.getElementById('insignia-correo');
const insigniaRecordatorios = document.getElementById('insignia-recordatorios');
const insigniaAgenda = document.getElementById('insignia-agenda');
const insigniaEmpleo = document.getElementById('insignia-empleo');
const vistas = Object.fromEntries(
  ['hoy', 'chat', 'correo', 'agenda', 'recordatorios', 'memoria', 'historial', 'empleo', 'ajustes'].map((v) => [v, document.getElementById(`vista-${v}`)]),
);
// Los cinco apartados de la barra. Recordatorios vive dentro de Agenda; las
// conversaciones y la memoria, dentro del Chat (botones de la cabecera).
const pestanas = Object.fromEntries([...document.querySelectorAll('.apartados [data-vista]')].map((b) => [b.dataset.vista, b]));
const PADRE = { recordatorios: 'agenda', historial: 'chat', memoria: 'chat' };
const subAgenda = document.getElementById('sub-agenda');
const botonesChat = [...document.querySelectorAll('.solo-chat')];
for (const span of document.querySelectorAll('.apartado__icono')) span.innerHTML = icono(span.dataset.icono, 18);
document.getElementById('boton-ajustes').innerHTML = icono('ajustes');
document.getElementById('boton-cerrar').innerHTML = icono('cerrar');
document.getElementById('boton-nueva').innerHTML = icono('conversacion');
document.getElementById('boton-historial').innerHTML = icono('historial');
document.getElementById('boton-memoria').innerHTML = icono('memoria');

let ajustes;
let kitsune;
let chat;
let correo;
let panelAjustes;
// Disposición de móvil de la versión web (null en Electron).
let movil = null;
// Apartados que se vuelven a pintar cada vez que se abren.
const apartados = {};
// Al abrir, Hoy: lo que tienes de un vistazo.
let vistaActual = 'hoy';
// Adónde vuelve la flecha de Ajustes.
let vistaAntesDeAjustes = 'hoy';
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
  kitsune.setEstilo(a.estilo);
  kitsune.setOpcion('seguirCursor', a.seguirCursor);
  kitsune.setOpcion('fuegos', a.fuegos);
  kitsune.setCalidad(a.calidadPelo);
}

// Orden de los apartados: la vista nueva entra desde el lado hacia el que se va.
const ORDEN_VISTAS = ['hoy', 'chat', 'historial', 'memoria', 'correo', 'agenda', 'recordatorios', 'empleo', 'ajustes'];
let moverIndicador = null;

function mostrarVista(nombre, seccionAjustes = null) {
  if (!vistas[nombre]) nombre = 'hoy';
  const anterior = vistaActual;
  if (nombre === 'ajustes' && anterior !== 'ajustes') vistaAntesDeAjustes = anterior;
  vistaActual = nombre;
  const destino = PADRE[nombre] ?? nombre;
  for (const [clave, vista] of Object.entries(vistas)) vista.hidden = clave !== nombre;
  for (const [clave, pestana] of Object.entries(pestanas)) {
    pestana.setAttribute('aria-selected', String(clave === destino));
    pestana.tabIndex = clave === destino ? 0 : -1;
  }
  // Agenda: sus dos pestañas. Chat: sus botones de la cabecera.
  subAgenda.hidden = destino !== 'agenda';
  for (const b of subAgenda.querySelectorAll('[data-vista]')) b.setAttribute('aria-selected', String(b.dataset.vista === nombre));
  for (const b of botonesChat) b.hidden = destino !== 'chat';
  document.getElementById('boton-historial').setAttribute('aria-pressed', String(nombre === 'historial'));
  document.getElementById('boton-memoria').setAttribute('aria-pressed', String(nombre === 'memoria'));
  dialogo.dataset.apartado = destino;
  // El apartado activo, a la vista si la barra se ha desplazado (pantallas estrechas).
  pestanas[destino]?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  document.getElementById('boton-ajustes').setAttribute('aria-pressed', String(nombre === 'ajustes'));
  movil?.alCambiarVista(nombre);
  moverIndicador?.();
  if (anterior !== nombre) entrarVista(vistas[nombre], Math.sign(ORDEN_VISTAS.indexOf(nombre) - ORDEN_VISTAS.indexOf(anterior)));
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
  for (const el of [insigniaRecordatorios, insigniaAgenda]) {
    el.hidden = hoy === 0;
    if (el.textContent !== String(hoy) && hoy && el.offsetParent) saltar(el);
    el.textContent = String(hoy);
  }
  recordatoriosHoy = hoy;
  ponerInsigniaApp();
}

// Insignia de Empleo: candidaturas preparadas que aún no has abierto.
function ponerInsigniaEmpleo(n) {
  const cuantas = typeof n === 'number' ? n : (n?.postulaciones ?? []).filter((p) => !p.revisada).length;
  if (insigniaEmpleo.textContent !== String(cuantas) && cuantas && insigniaEmpleo.offsetParent) saltar(insigniaEmpleo);
  insigniaEmpleo.hidden = cuantas === 0;
  insigniaEmpleo.textContent = String(cuantas);
}

// Ir a un apartado y, si se pide, hacer algo nada más llegar (desde las tarjetas de Hoy).
function pulsarCuandoExista(contenedor, selector, plazo = 4000) {
  const inicio = Date.now();
  const mirar = () => {
    const el = contenedor.querySelector(selector);
    if (el && !el.disabled) return el.click();
    if (Date.now() - inicio < plazo) setTimeout(mirar, 80);
  };
  mirar();
}
function ir(nombre, { buscarYPreparar = false, nuevo = false } = {}) {
  if (nombre === 'correo' || nombre === 'agenda') api.correo.renovar?.();
  mostrarVista(nombre);
  if (buscarYPreparar) pulsarCuandoExista(vistas.empleo, '#empleo-preparar');
  if (nuevo) pulsarCuandoExista(vistas.recordatorios, '#rec-nuevo');
}

function abrirDialogo() {
  // Hoy se pone al día cada vez que vuelves.
  if (vistaActual === 'hoy') apartados.hoy?.mostrar();
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
  const texto = noLeidos > 99 ? '99+' : String(noLeidos);
  if (insignia.textContent !== texto && !insignia.hidden) saltar(insignia);
  insignia.textContent = texto;
  ponerInsigniaApp();
}

// Número en el icono de la app instalada: correos sin leer y recordatorios de hoy.
let recordatoriosHoy = 0;
function ponerInsigniaApp() {
  if (api.plataforma !== 'web' || !('setAppBadge' in navigator)) return;
  const total = noLeidos + recordatoriosHoy;
  (total ? navigator.setAppBadge(total) : navigator.clearAppBadge()).catch(() => {});
}

// Un gesto del zorro como reacción, sin cortarle si está apareciendo o despidiéndose.
function gesto(nombre) {
  if (!kitsune?.visible || ['aparecer', 'desaparecer', 'saludar'].includes(kitsune.accion?.nombre)) return;
  actividad();
  kitsune.reproducir(nombre);
}

function actividad() {
  ultimaActividad = Date.now();
  if (kitsune?.estado === 'dormir') kitsune.setEstado('reposo');
}

// ---------- Voz ----------
// Natural: la del servidor de avisos (Aura-2 en Workers AI), por trozos; el
// siguiente se pide mientras suena el anterior. Si no hay servidor o falla,
// las voces en español del dispositivo.

let audioCtx = null;
let fuenteVoz = null;
let turnoVoz = 0;
let servidorVoz = { comprobado: 0, disponible: false };
// Mientras se prueba la voz en Ajustes, los fallos se enseñan en vez de callarse.
let avisoVoz = null;

function contextoAudio() {
  const Contexto = window.AudioContext || window.webkitAudioContext;
  if (!Contexto) return null;
  // Como un vídeo: suena aunque el iPhone esté en silencio (Safari 16.4+).
  if (navigator.audioSession) navigator.audioSession.type = 'playback';
  audioCtx ??= new Contexto();
  return audioCtx;
}
// En el iPhone el audio solo puede empezar tras un toque: se despierta con el primero.
const despertarAudio = () => ajustes && ajustes.vozTipo !== 'dispositivo' && contextoAudio()?.resume().catch(() => {});
document.addEventListener('pointerdown', despertarAudio, { passive: true });
document.addEventListener('keydown', despertarAudio);

// Qué genera la voz: VoiceStudio (Windows, en el propio ordenador), la natural
// del servidor o ninguna (y entonces la del dispositivo).
async function motorDeVoz() {
  if (ajustes.vozTipo === 'voicestudio' && api.voicestudio) return (trozo) => api.voicestudio.hablar(trozo);
  if (ajustes.vozTipo === 'dispositivo' || !api.servidor?.voz) return null;
  if (Date.now() - servidorVoz.comprobado >= 10 * 60_000) {
    const e = await api.servidor.estado().catch(() => null);
    servidorVoz = { comprobado: Date.now(), disponible: Boolean(e?.vinculado && e.voz) };
  }
  return servidorVoz.disponible ? (trozo) => api.servidor.voz(trozo, ajustes.vozNombre) : null;
}

function callarVoz() {
  turnoVoz++;
  try {
    fuenteVoz?.stop();
  } catch {
    // Ya había terminado.
  }
  fuenteVoz = null;
  if ('speechSynthesis' in window) speechSynthesis.cancel();
}

async function hablarEnVoz(texto) {
  callarVoz();
  const turno = turnoVoz;
  const motor = await motorDeVoz();
  if (motor) {
    try {
      const empezo = await hablarNatural(texto, turno, motor);
      if (empezo) return;
    } catch (error) {
      console.warn('Voz:', error.message);
      avisoVoz?.(error.message);
      // Para no esperar en cada respuesta: se vuelve a probar en unos minutos.
      servidorVoz = { comprobado: Date.now(), disponible: false };
    }
    if (turno !== turnoVoz) return;
  }
  return hablarDispositivo(texto);
}

// Devuelve false si no llegó a sonar nada (para usar entonces la del dispositivo).
async function hablarNatural(texto, turno, motor) {
  const ctx = contextoAudio();
  if (!ctx) return false;
  if (ctx.state !== 'running') await ctx.resume().catch(() => {});
  if (ctx.state !== 'running') return false;
  const trozos = trozosDeVoz(texto);
  const analizador = ctx.createAnalyser();
  analizador.fftSize = 512;
  analizador.connect(ctx.destination);
  const pedir = (i) =>
    i < trozos.length
      ? motor(trozos[i]).then((bytes) => ctx.decodeAudioData(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)))
      : null;
  let siguiente = pedir(0);
  let sonado = false;
  for (let i = 0; i < trozos.length; i++) {
    let buffer;
    try {
      buffer = await siguiente;
    } catch (error) {
      if (!sonado) throw error;
      break;
    }
    if (turno !== turnoVoz) return true;
    siguiente = pedir(i + 1);
    siguiente?.catch(() => {});
    sonado = true;
    await reproducir(ctx, buffer, analizador, turno);
    if (turno !== turnoVoz) return true;
  }
  return sonado;
}

// Suena un trozo y la boca del zorro sigue el volumen.
function reproducir(ctx, buffer, analizador, turno) {
  return new Promise((resolver) => {
    const fuente = ctx.createBufferSource();
    fuente.buffer = buffer;
    fuente.connect(analizador);
    fuenteVoz = fuente;
    const muestras = new Uint8Array(analizador.fftSize);
    let ultimo = 0;
    const boca = (t) => {
      if (fuenteVoz !== fuente || turno !== turnoVoz) return;
      analizador.getByteTimeDomainData(muestras);
      let suma = 0;
      for (const m of muestras) suma += ((m - 128) / 128) ** 2;
      const volumen = Math.sqrt(suma / muestras.length);
      if (volumen > 0.03 && t - ultimo > 85) {
        kitsune.pulsoHabla(Math.round(volumen * 60) + 2);
        ultimo = t;
      }
      requestAnimationFrame(boca);
    };
    fuente.onended = () => {
      if (fuenteVoz === fuente) fuenteVoz = null;
      resolver();
    };
    fuente.start();
    requestAnimationFrame(boca);
  });
}

function hablarDispositivo(texto) {
  if (!('speechSynthesis' in window)) return Promise.resolve();
  const frase = new SpeechSynthesisUtterance(limpiarParaVoz(texto));
  frase.lang = 'es-ES';
  frase.voice = speechSynthesis.getVoices().find((v) => v.lang?.startsWith('es')) ?? null;
  // Cada palabra pronunciada mueve la boca del zorro.
  frase.onboundary = (e) => kitsune.pulsoHabla(e.charLength || 5);
  return new Promise((resolver) => {
    // A veces (iOS) no avisa al acabar: como mucho, lo que tardaría en leerlo.
    const limite = setTimeout(resolver, 4000 + frase.text.split(/\s+/).length * 450);
    const fin = () => {
      clearTimeout(limite);
      resolver();
    };
    frase.onend = fin;
    frase.onerror = fin;
    speechSynthesis.cancel();
    speechSynthesis.speak(frase);
  });
}

// El chat avisa de lo que está pasando y el zorro lo representa.
async function alEstadoChat(estado, texto) {
  actividad();
  // Una pregunta nueva corta lo que estuviera diciendo.
  if (estado === 'pensar' || estado === 'escuchar') callarVoz();
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
    estilo: ajustes.estilo,
    seguirCursor: ajustes.seguirCursor,
    fuegos: ajustes.fuegos,
    zoom: 1.22,
  });
  aplicarAjustes(ajustes);

  // Modo conversación: lee la respuesta (siempre en voz alta) y avisa al terminar.
  const hablarEnConversacion = async (texto) => {
    kitsune.setEstado('hablar');
    try {
      await hablarEnVoz(texto);
    } finally {
      kitsune.setEstado('reposo');
    }
  };
  hablarEnConversacion.callar = () => callarVoz();
  // Con el mismo toque que empieza la conversación se desbloquea el audio del iPhone.
  hablarEnConversacion.preparar = () => {
    contextoAudio()?.resume().catch(() => {});
    if ('speechSynthesis' in window) speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  };
  chat = crearChat({
    contenedor: vistas.chat,
    api,
    alEstado: alEstadoChat,
    hablar: hablarEnConversacion,
    abrirAjustes: (seccion) => mostrarVista('ajustes', seccion),
    obtenerAjustes: () => ajustes,
  });
  correo = crearCorreo({
    contenedor: vistas.correo,
    api,
    abrirAjustes: (seccion) => mostrarVista('ajustes', seccion),
    alNoLeidos: ponerNoLeidos,
    alLeer: () => gesto('olfatear'),
    conFotos: () => ajustes?.fotosRemitentes !== false,
  });
  panelAjustes = crearAjustes({
    contenedor: vistas.ajustes,
    api,
    probarVoz: async () => {
      servidorVoz.comprobado = 0;
      let fallo = null;
      avisoVoz = (mensaje) => (fallo = mensaje);
      kitsune.setEstado('hablar');
      try {
        await hablarEnVoz('Hola, soy Kitsune. Así sonará mi voz cuando te lea las respuestas.');
      } finally {
        avisoVoz = null;
        kitsune.setEstado('reposo');
      }
      if (fallo) throw new Error(`${fallo} He usado la voz del dispositivo.`);
    },
    vocesVoiceStudio: api.voicestudio ? () => api.voicestudio.voces() : null,
    alCerrar: () => mostrarVista(vistaAntesDeAjustes === 'ajustes' ? 'hoy' : vistaAntesDeAjustes),
    alCambiar: (nuevos, cambios) => {
      ajustes = nuevos;
      aplicarAjustes(nuevos);
      if ('claveClaude' in cambios) chat.comprobarClave();
      if ('correo' in cambios) correo.recargar();
      // El servidor prepara las candidaturas con el mismo modo de IA.
      if ('modoIA' in cambios) apartados.empleo?.cambiarModo(cambios.modoIA);
    },
  });

  apartados.agenda = crearAgenda({
    contenedor: vistas.agenda,
    api,
    alCrear: () => gesto('celebrar'),
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
    alConfigurarAvisos: () => mostrarVista('ajustes', 'avisos'),
  });
  apartados.memoria = crearMemoria({
    contenedor: vistas.memoria,
    api,
    obtenerAjustes: () => ajustes,
    guardarAjustes: async (cambios) => {
      ajustes = await api.ajustes.guardar(cambios);
    },
  });
  apartados.empleo = crearEmpleo({
    contenedor: vistas.empleo,
    api,
    abrirAjustes: (seccion) => mostrarVista('ajustes', seccion),
    alCambiar: ponerInsigniaEmpleo,
  });
  apartados.hoy = crearHoy({
    contenedor: vistas.hoy,
    api,
    ir,
    preguntar: (texto) => {
      mostrarVista('chat');
      chat.preguntar(texto);
    },
    abrirAjustes: (seccion) => mostrarVista('ajustes', seccion),
    instalacion: { puedeInstalar: () => movil?.puedeInstalar() ?? null, instalar: () => movil?.instalar() ?? false },
    alEmpleo: ponerInsigniaEmpleo,
  });
  apartados.hoy.mostrar();
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

  // Pestañas de Agenda y botones del Chat.
  for (const b of subAgenda.querySelectorAll('[data-vista]')) b.addEventListener('click', () => mostrarVista(b.dataset.vista));
  document.getElementById('boton-historial').addEventListener('click', () => mostrarVista(vistaActual === 'historial' ? 'chat' : 'historial'));
  document.getElementById('boton-memoria').addEventListener('click', () => mostrarVista(vistaActual === 'memoria' ? 'chat' : 'memoria'));
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
  // Llegan cambios de tus otros dispositivos: se refresca lo que se ve.
  api.sincro?.alCambios(async (colecciones) => {
    if (colecciones.includes('ajustes')) {
      ajustes = await api.ajustes.obtener();
      aplicarAjustes(ajustes);
    }
    if (colecciones.includes('ajustes') || colecciones.includes('claves')) chat.comprobarClave();
    if (colecciones.includes('recordatorios')) contarRecordatoriosDeHoy();
    if (colecciones.includes('empleo')) apartados.empleo.recargar();
    const vista = { memoria: 'memoria', recordatorios: 'recordatorios', conversaciones: 'historial' };
    if (colecciones.some((c) => vista[c] === vistaActual)) apartados[vistaActual]?.mostrar();
  });
  contarRecordatoriosDeHoy();
  setInterval(contarRecordatoriosDeHoy, 60_000);
  api.claude.alEvento((e) => e.tipo === 'recordatorio' && contarRecordatoriosDeHoy());
  api.claude.alEvento((e) => e.tipo === 'automatizacion' && apartados.recordatorios.recargarAutomatizaciones());
  // El zorro reacciona a lo que pasa en la conversación.
  const GESTOS = {
    recordatorio: 'asentir',
    memoria: 'asentir',
    evento: 'celebrar',
    'agenda-cambiada': 'asentir',
    'correo-cambiado': 'asentir',
    'correo-enviado': 'celebrar',
    automatizacion: 'celebrar',
    error: 'triste',
    rechazo: 'triste',
  };
  api.claude.alEvento((e) => GESTOS[e.tipo] && gesto(GESTOS[e.tipo]));
  document.getElementById('boton-ajustes').addEventListener('click', () =>
    mostrarVista(vistaActual === 'ajustes' ? vistaAntesDeAjustes : 'ajustes'),
  );
  document.getElementById('boton-cerrar').addEventListener('click', cerrarDialogo);
  const nuevaConversacion = async () => {
    await chat.nueva();
    mostrarVista('chat');
  };
  document.getElementById('boton-nueva').addEventListener('click', nuevaConversacion);
  prepararOndas(document);
  moverIndicador = prepararIndicador(document.querySelector('.apartados'));
  prepararEnvio(document.getElementById('chat-formulario'), document.getElementById('chat-enviar'));
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
    const escala = Math.min(1, window.innerWidth / 510, (window.innerHeight - barra) / 775);
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
      if (!['abrir-correo', 'abrir-vista', 'abrir-app'].includes(e.data?.tipo)) return;
      abrirDialogo();
      if (e.data.tipo !== 'abrir-app') {
        const [vista, seccion] = String(e.data.vista ?? 'correo').split(':');
        mostrarVista(vista, seccion ?? null);
      }
    });
  }
}

// Llegadas desde fuera: el aviso de correo (?correo), los atajos del icono
// (?pulso) o "Compartir" desde otra app (?texto, ?enlace, ?titulo).
function atenderParametros() {
  const parametros = new URLSearchParams(location.search);
  const compartido = ['titulo', 'texto', 'enlace'].map((c) => parametros.get(c)?.trim()).filter(Boolean);
  if (parametros.has('chat')) mostrarVista('chat');
  else if (parametros.has('correo')) mostrarVista('correo');
  else if (parametros.has('agenda')) mostrarVista('agenda');
  else if (parametros.has('recordatorios')) mostrarVista('recordatorios');
  else if (parametros.has('ajustes')) mostrarVista('ajustes');
  else if (parametros.has('empleo')) mostrarVista('empleo');
  else if (parametros.has('sincro')) mostrarVista('ajustes', 'sincro');
  else if (parametros.has('pulso')) chat.preguntar('Prepárame el pulso de hoy');
  else if (compartido.length) {
    mostrarVista('chat');
    chat.ofrecerTexto([...new Set(compartido)].join('\n'), 'compartido');
  }
  // Llegar con una acción abre el diálogo directamente; que recargar no la repita.
  if ([...parametros.keys()].some((c) => ['correo', 'agenda', 'recordatorios', 'ajustes', 'sincro', 'empleo', 'pulso', 'chat', 'titulo', 'texto', 'enlace'].includes(c))) {
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
