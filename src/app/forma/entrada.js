// La puerta entre Kitsune y Forma. Esto es lo único que Kitsune carga siempre:
// el resto de Forma (pantallas, estilos, tipografía) llega la primera vez que
// la abres. La transformación es un círculo azul que crece desde el botón
// (View Transitions) y, al volver, se cierra sobre el botón de Kitsune.
const CLAVE_MODO = 'kitsune-modo';
const COLOR_FORMA = '#03060c';

const leerModo = () => {
  try {
    return localStorage.getItem(CLAVE_MODO);
  } catch {
    return null;
  }
};
const guardarModo = (modo) => {
  try {
    if (modo) localStorage.setItem(CLAVE_MODO, modo);
    else localStorage.removeItem(CLAVE_MODO);
  } catch {
    // Sin almacenamiento: no se recuerda el modo.
  }
};

export function prepararForma({ api, boton, contenedor, antesDeAbrir = () => {}, alCambiar = () => {} }) {
  let forma = null;
  let cargando = null;
  let raiz = null;
  const meta = document.querySelector('meta[name="theme-color"]');
  const colorKitsune = meta?.content ?? '#0d0909';
  const html = document.documentElement;

  function cargar() {
    if (forma) return Promise.resolve(forma);
    cargando ??= (async () => {
      raiz = document.createElement('div');
      raiz.className = 'forma';
      raiz.id = 'forma';
      raiz.hidden = true;
      contenedor.append(raiz);
      const { montarForma } = await import('./forma.js');
      forma = await montarForma({ raiz, api, salir: (el) => transformar(false, el) });
      return forma;
    })().catch((error) => {
      cargando = null;
      raiz?.remove();
      raiz = null;
      throw error;
    });
    return cargando;
  }

  function centro(el) {
    const r = el?.getBoundingClientRect?.();
    if (!r || !r.width) return null;
    return [r.left + r.width / 2, r.top + r.height / 2];
  }

  const activo = () => html.classList.contains('en-forma');

  async function transformar(aForma, origen = null, { animar = true } = {}) {
    if (aForma === activo() && (!aForma || !raiz?.hidden)) return;
    if (aForma) {
      try {
        await cargar();
      } catch (error) {
        console.error(error);
        return;
      }
    }
    const aplicar = () => {
      html.classList.toggle('en-forma', aForma);
      if (aForma) forma.mostrar();
      else forma?.ocultar();
      if (meta) meta.content = aForma ? COLOR_FORMA : colorKitsune;
      guardarModo(aForma ? 'forma' : null);
      alCambiar(aForma);
    };
    const reducido = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!animar || reducido) return aplicar();
    // Al volver, el círculo se cierra hacia el botón «Kitsune» de Forma o, si no, arriba.
    const punto = centro(origen) ?? [innerWidth / 2, aForma ? innerHeight * 0.8 : 40];
    html.style.setProperty('--f-x', `${punto[0]}px`);
    html.style.setProperty('--f-y', `${punto[1]}px`);
    if (document.startViewTransition) {
      html.dataset.transformacion = aForma ? 'forma' : 'kitsune';
      try {
        const t = document.startViewTransition(aplicar);
        await t.finished;
      } catch {
        // Si la transición falla, el cambio ya está aplicado.
      } finally {
        delete html.dataset.transformacion;
      }
    } else {
      const cortina = document.createElement('div');
      cortina.className = 'f-cortina';
      document.body.append(cortina);
      setTimeout(aplicar, 430);
      setTimeout(() => cortina.remove(), 950);
    }
    if (aForma && raiz) {
      raiz.classList.add('recien');
      setTimeout(() => raiz?.classList.remove('recien'), 1600);
    }
  }

  boton?.addEventListener('click', () => {
    // El punto de partida, antes de que se cierre la hoja donde está el botón.
    const punto = centro(boton);
    antesDeAbrir();
    transformar(true, punto ? { getBoundingClientRect: () => ({ left: punto[0], top: punto[1], width: 1, height: 1 }) } : null);
  });

  return {
    transformar,
    activo,
    // Al abrir la app: vuelve a Forma si la dejaste ahí, o hace una acción de un atajo (?forma=agua).
    async arrancar(parametro) {
      if (parametro === null && leerModo() !== 'forma') return false;
      await transformar(true, null, { animar: false });
      if (parametro) forma?.accion(parametro);
      return true;
    },
    olvidar: () => guardarModo(null),
  };
}
