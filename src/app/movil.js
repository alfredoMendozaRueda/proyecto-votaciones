import { crearChispas } from './animaciones.js';

// Disposición de móvil de la versión web (la PWA). Al abrir la app solo está
// el zorro, grande en el centro; al tocarlo se encoge (se vuelve una cría),
// se va abajo a la derecha y el diálogo le sale de la boca, casi a pantalla
// completa, con los cinco apartados en una barra inferior. Tocarlo otra vez (o
// la X) lo cierra por el mismo camino, y la app se ajusta al teclado. En Electron y en pantallas
// anchas no cambia nada.

const MOVIL = '(max-width: 600px)';
// Curva de las hojas de iOS: arranca rápida y se posa sin rebote.
const CURVA = 'cubic-bezier(0.32, 0.72, 0, 1)';
const DURACION = 560;

const enApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const esIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export function prepararMovil({ escena, dialogo, zorro, kitsune, mostrarVista, obtenerVista, nuevaConversacion, vibrar, alAbrir }) {
  const consulta = matchMedia(MOVIL);
  const raiz = document.documentElement;
  let instalacion = null;

  // ---------- El zorro: grande y solo, o cría en la esquina con el diálogo ----------

  // Dónde acaba el zorro al abrir (lo coloca el CSS) y la invitación a tocarlo.
  const hueco = document.createElement('div');
  hueco.className = 'zorro-hueco';
  hueco.setAttribute('aria-hidden', 'true');
  const pista = document.createElement('p');
  pista.className = 'pista-zorro';
  pista.textContent = 'Toca a Kitsune';
  escena.append(crearChispas(), hueco, pista);

  function aplicarModo() {
    raiz.classList.toggle('movil', consulta.matches);
    if (!consulta.matches) {
      delete escena.dataset.modo;
      kitsune.setBebe(false);
      return;
    }
    escena.dataset.modo = dialogo.hidden ? 'solo' : 'abierto';
    kitsune.setBebe(!dialogo.hidden);
  }
  consulta.addEventListener('change', aplicarModo);
  aplicarModo();

  let animacion = null;
  let enCurso = Promise.resolve();

  // FLIP inverso: el contenedor conserva su tamaño grande mientras se mueve y
  // encoge con transform (nítido y sin redimensionar el lienzo cada fotograma);
  // al terminar se coloca en su sitio con su tamaño real.
  function moverZorro(desde, hasta, alReves = false) {
    animacion?.cancel();
    const s = hasta.width / desde.width;
    const destino = `translate(${hasta.left - desde.left}px, ${hasta.top - desde.top}px) scale(${s})`;
    const fotogramas = alReves ? [{ transform: destino }, { transform: 'none' }] : [{ transform: 'none' }, { transform: destino }];
    animacion = zorro.animate(fotogramas, { duration: reducido() ? 1 : DURACION, easing: CURVA, fill: 'forwards' });
    return animacion.finished.catch(() => {});
  }

  function abrir() {
    if (escena.dataset.modo === 'abierto' || escena.dataset.modo === 'abriendo') return enCurso;
    enCurso = enCurso.then(async () => {
      const grande = zorro.getBoundingClientRect();
      const pequeno = hueco.getBoundingClientRect();
      escena.dataset.modo = 'abriendo';
      dialogo.classList.remove('cerrandose');
      dialogo.hidden = false;
      kitsune.setBebe(true);
      vibrar(10);
      // El diálogo sale de la boca: el zorro la abre mientras tanto.
      setTimeout(() => kitsune.pulsoHabla(30), 120);
      setTimeout(() => kitsune.pulsoHabla(20), 300);
      alAbrir?.();
      await moverZorro(grande, pequeno);
      escena.dataset.modo = 'abierto';
      animacion?.cancel();
    });
    return enCurso;
  }

  function cerrar() {
    if (escena.dataset.modo !== 'abierto' && escena.dataset.modo !== 'abriendo') return enCurso;
    enCurso = enCurso.then(async () => {
      // Primero el diálogo vuelve a la boca; luego el zorro crece hasta el centro.
      dialogo.classList.add('cerrandose');
      kitsune.pulsoHabla(20);
      await esperar(reducido() ? 0 : 200);
      const pequeno = zorro.getBoundingClientRect();
      escena.dataset.modo = 'cerrando';
      dialogo.hidden = true;
      dialogo.classList.remove('cerrandose');
      kitsune.setBebe(false);
      const grande = zorro.getBoundingClientRect();
      await moverZorro(grande, pequeno, true);
      escena.dataset.modo = 'solo';
      animacion?.cancel();
    });
    return enCurso;
  }

  // ---------- Teclado: la app ocupa solo lo que queda visible ----------

  // En el iPhone el teclado tapa la página en vez de encogerla: se sigue el
  // viewport visual y la escena se ajusta a él.
  const vv = window.visualViewport;
  if (vv) {
    const ajustar = () => {
      raiz.style.setProperty('--vv-alto', `${Math.round(vv.height)}px`);
      raiz.style.setProperty('--vv-arriba', `${Math.round(vv.offsetTop)}px`);
    };
    vv.addEventListener('resize', ajustar);
    vv.addEventListener('scroll', ajustar);
    ajustar();
  }

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    instalacion = e;
  });
  window.addEventListener('appinstalled', () => (instalacion = null));

  function alCambiarVista(nombre) {
    escena.dataset.vista = nombre;
  }

  // Instalar Kitsune como app: Android trae el aviso del navegador; en el iPhone hay que explicarlo.
  const puedeInstalar = () => (instalacion ? 'aviso' : esIphone() && !enApp() ? 'iphone' : null);
  async function instalar() {
    if (!instalacion) return false;
    instalacion.prompt();
    const { outcome } = await instalacion.userChoice.catch(() => ({}));
    if (outcome === 'accepted') instalacion = null;
    return outcome === 'accepted';
  }
  alCambiarVista(obtenerVista());

  return {
    activo: () => consulta.matches,
    abierto: () => escena.dataset.modo === 'abierto' || escena.dataset.modo === 'abriendo',
    abrir,
    cerrar,
    alternar: () => (escena.dataset.modo === 'abierto' || escena.dataset.modo === 'abriendo' ? cerrar() : abrir()),
    alCambiarVista,
    puedeInstalar,
    instalar,
  };
}
