import { Kitsune } from '../kitsune/Kitsune.js';
import { crearDemo } from './demo.js';
import { crearBackendWeb } from './web/backend.js';
import { crearChat } from './chat.js';
import { crearCorreo } from './correo.js';
import { crearAjustes } from './ajustes.js';
import { icono } from './iconos.js';

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
const vistas = {
  chat: document.getElementById('vista-chat'),
  correo: document.getElementById('vista-correo'),
  ajustes: document.getElementById('vista-ajustes'),
};
const pestanas = { chat: document.getElementById('pestana-chat'), correo: document.getElementById('pestana-correo') };
document.getElementById('boton-ajustes').innerHTML = icono('ajustes');
document.getElementById('boton-cerrar').innerHTML = icono('cerrar');

let ajustes;
let kitsune;
let chat;
let correo;
let panelAjustes;
let vistaActual = 'chat';
let noLeidos = 0;
let ultimaActividad = Date.now();
let ratonDentro = false;
// En pantallas táctiles no se enfoca el chat solo: abriría el teclado sin pedirlo.
const tactil = matchMedia('(pointer: coarse)').matches;
const enfocarChat = () => !tactil && chat.enfocar();

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
  for (const [clave, pestana] of Object.entries(pestanas)) pestana.setAttribute('aria-selected', String(clave === nombre));
  document.getElementById('boton-ajustes').setAttribute('aria-pressed', String(nombre === 'ajustes'));
  if (nombre === 'ajustes') panelAjustes.abrir(seccionAjustes);
  if (nombre === 'chat') enfocarChat();
}

function abrirDialogo() {
  dialogo.classList.remove('cerrandose');
  dialogo.hidden = false;
  if (vistaActual === 'chat') enfocarChat();
}

function cerrarDialogo() {
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

  pestanas.chat.addEventListener('click', () => mostrarVista('chat'));
  pestanas.correo.addEventListener('click', () => mostrarVista('correo'));
  document.getElementById('boton-ajustes').addEventListener('click', () =>
    mostrarVista(vistaActual === 'ajustes' ? 'chat' : 'ajustes'),
  );
  document.getElementById('boton-cerrar').addEventListener('click', cerrarDialogo);

  kitsune.on('toque', () => {
    actividad();
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

  api.correo.alNuevo(() => {
    if (ajustes.avisarCorreo) {
      if (kitsune.estado === 'dormir') kitsune.setEstado('reposo');
      kitsune.reproducir('alegria');
    }
  });

  manejarAlternar = async (accion) => {
    if (accion === 'mostrar') {
      await kitsune.reproducir('aparecer');
      abrirDialogo();
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
  // Abierta desde el aviso de correo nuevo.
  if (new URLSearchParams(location.search).has('correo')) mostrarVista('correo');
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.tipo === 'abrir-correo') mostrarVista('correo');
    });
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
