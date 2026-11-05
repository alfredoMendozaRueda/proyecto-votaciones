// Disposición de móvil de la versión web (la PWA): la app a pantalla completa,
// con los apartados en una barra inferior, que se ajusta al teclado. En
// Electron y en pantallas anchas no cambia nada.

const MOVIL = '(max-width: 600px)';

const enApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const esIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

export function prepararMovil({ escena, dialogo, obtenerVista, alAbrir }) {
  const consulta = matchMedia(MOVIL);
  const raiz = document.documentElement;
  let instalacion = null;

  // ---------- La app a pantalla completa ----------
  // Sin zorro: Kitsune se abre directamente en el apartado y no se «cierra»
  // (para salir está el gesto de inicio del sistema).

  function aplicarModo() {
    raiz.classList.toggle('movil', consulta.matches);
    if (!consulta.matches) {
      delete escena.dataset.modo;
      return;
    }
    escena.dataset.modo = dialogo.hidden ? 'solo' : 'abierto';
  }
  consulta.addEventListener('change', aplicarModo);
  aplicarModo();

  function abrir() {
    dialogo.classList.remove('cerrandose');
    dialogo.hidden = false;
    escena.dataset.modo = 'abierto';
    alAbrir?.();
    return Promise.resolve();
  }

  const cerrar = () => Promise.resolve();

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
    alternar: abrir,
    alCambiarVista,
    puedeInstalar,
    instalar,
  };
}
