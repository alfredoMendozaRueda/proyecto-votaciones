// «Cristal líquido»: el movimiento que necesita JavaScript, compartido por
// Kitsune y Forma (ver cristal.css y forma/cristal.css).
//  - El brillo especular sigue al dedo (o al ratón) sobre el cristal.
//  - La selección de barras y pestañas es una lente que viaja de una opción a
//    otra con un muelle y se estira un poco por el camino, aunque la vista se
//    vuelva a pintar entera.
//  - Las tarjetas de una vista llegan escalonadas.
// Todo con transform/opacity y respetando «reducir movimiento».

const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

// Muelles (los mismos de cristal.css). Si el navegador no entiende linear(), una curva parecida.
const CURVAS = {
  suave: ['--muelle-suave', 515, 'cubic-bezier(0.25, 1, 0.5, 1)'],
  rebote: ['--muelle-rebote', 555, 'cubic-bezier(0.34, 1.36, 0.64, 1)'],
  hoja: ['--muelle-hoja', 530, 'cubic-bezier(0.32, 0.72, 0, 1)'],
};
const entiendeLinear = (() => {
  try {
    return CSS.supports('transition-timing-function', 'linear(0, 1)');
  } catch {
    return false;
  }
})();
export function muelle(nombre = 'suave') {
  const [variable, ms, reserva] = CURVAS[nombre] ?? CURVAS.suave;
  const css = entiendeLinear ? getComputedStyle(document.documentElement).getPropertyValue(variable).trim() : '';
  return { easing: css || reserva, duration: ms };
}

// ---------- Brillo especular ----------

// Lo que es de cristal (o tarjeta translúcida) y reacciona a la luz.
const VIDRIO = [
  '.apartados',
  '.dialogo__cabecera .icono-boton',
  '.compositor',
  '.boton-voz',
  '.bloque',
  '.grupo',
  '.hoja-mas__item',
  '.oferta',
  '.gasto',
  '.tarjeta-aviso',
  '.biblia__lectura',
  '.biblia__plan',
  '.gastos__cifra',
  '.empleo-portada',
  '.f-panel',
  '.f-barra',
  '.f-barra__mas',
  '.f-cab-boton',
  '.f-tostada',
].join(', ');

function luz(el, x, y, intensidad) {
  const r = el.getBoundingClientRect();
  if (!r.width || !r.height) return;
  el.style.setProperty('--luz-x', `${(((x - r.left) / r.width) * 100).toFixed(1)}%`);
  el.style.setProperty('--luz-y', `${(((y - r.top) / r.height) * 100).toFixed(1)}%`);
  el.style.setProperty('--luz', String(intensidad));
}

function prepararLuz() {
  let pulsado = null;
  let encima = null;
  let pendiente = null;
  const apagar = (el) => el?.style.setProperty('--luz', '0');
  document.addEventListener(
    'pointerdown',
    (e) => {
      const el = e.target.closest?.(VIDRIO);
      if (!el) return;
      pulsado = el;
      luz(el, e.clientX, e.clientY, 1);
    },
    { passive: true, capture: true },
  );
  document.addEventListener(
    'pointermove',
    (e) => {
      if (pendiente) return;
      pendiente = requestAnimationFrame(() => {
        pendiente = null;
        if (pulsado) return luz(pulsado, e.clientX, e.clientY, 1);
        // Con ratón, la luz sigue al cursor (más suave que al pulsar).
        if (e.pointerType !== 'mouse') return;
        const el = e.target.closest?.(VIDRIO);
        if (el !== encima) apagar(encima);
        encima = el;
        if (el) luz(el, e.clientX, e.clientY, 0.55);
      });
    },
    { passive: true },
  );
  const soltar = () => {
    apagar(pulsado);
    pulsado = null;
  };
  document.addEventListener('pointerup', soltar, { passive: true, capture: true });
  document.addEventListener('pointercancel', soltar, { passive: true, capture: true });
  document.addEventListener('pointerleave', () => apagar(encima), { passive: true });
}

// ---------- La lente que viaja ----------

// Pistas con una opción elegida.
const PISTAS = '.apartados, .segmentado, .subapartados, .filtros, .f-segmento, .f-barra, .f-chips';
const ELEGIDA = ':scope > :is([aria-selected="true"], [aria-pressed="true"], [aria-current="page"])';

// Cómo volver a encontrar una pista aunque la vista se haya repintado entera.
function huellaDe(pista) {
  const ancla = pista.parentElement?.closest('[id], [data-cuerpo], .forma') ?? document.body;
  const clase = [...pista.classList].find((c) => document.querySelectorAll(`.${CSS.escape(c)}`).length) ?? pista.classList[0];
  const iguales = [...ancla.querySelectorAll(`.${CSS.escape(clase)}`)];
  return { ancla, anclaId: ancla.id, clase, i: iguales.indexOf(pista) };
}
function buscar(h) {
  const ancla = h.anclaId ? document.getElementById(h.anclaId) : h.ancla.isConnected ? h.ancla : null;
  return ancla?.querySelectorAll(`.${CSS.escape(h.clase)}`)[h.i] ?? null;
}

function viajar(pista, desde, hasta) {
  const pr = pista.getBoundingClientRect();
  const a = desde;
  const b = hasta.getBoundingClientRect();
  if (!b.width || (Math.abs(a.left - b.left) < 1 && Math.abs(a.top - b.top) < 1)) return;
  const estilo = getComputedStyle(hasta);
  // Sin fondo propio (otra forma de marcar la elegida): no hay lente que mover.
  if (estilo.backgroundImage === 'none' && /rgba\(0, 0, 0, 0\)|transparent/.test(estilo.backgroundColor)) return;
  const lente = document.createElement('span');
  lente.className = 'lente-viaja';
  lente.setAttribute('aria-hidden', 'true');
  const bordes = { x: pista.clientLeft, y: pista.clientTop };
  Object.assign(lente.style, {
    left: `${b.left - pr.left - bordes.x + pista.scrollLeft}px`,
    top: `${b.top - pr.top - bordes.y + pista.scrollTop}px`,
    width: `${b.width}px`,
    height: `${b.height}px`,
    borderRadius: estilo.borderRadius,
    background: estilo.background,
    boxShadow: estilo.boxShadow,
  });
  if (getComputedStyle(pista).position === 'static') pista.style.position = 'relative';
  pista.classList.add('con-lente');
  pista.prepend(lente);
  hasta.classList.add('lente-llegando');
  const dx = a.left - b.left;
  const dy = a.top - b.top;
  const sx = a.width / b.width;
  const sy = a.height / b.height;
  const { easing, duration } = muelle('rebote');
  // Se estira en la dirección del viaje y se recoge al llegar (como una gota).
  const estira = Math.min(1.22, 1 + Math.abs(dx) / Math.max(400, pr.width * 2));
  const anim = lente.animate(
    [
      { transform: `translate(${dx}px, ${dy}px) scale(${sx}, ${sy})`, transformOrigin: '0 0' },
      { transform: `translate(${dx * 0.45}px, ${dy * 0.45}px) scale(${((sx + 1) / 2) * estira}, ${((sy + 1) / 2) / estira ** 0.5})`, transformOrigin: '0 0', offset: 0.35 },
      { transform: 'none', transformOrigin: '0 0' },
    ],
    { duration, easing },
  );
  const fin = () => {
    lente.remove();
    hasta.classList.remove('lente-llegando');
  };
  anim.onfinish = fin;
  anim.oncancel = fin;
  // Si la pista desaparece (otra vista), se limpia sola.
  setTimeout(fin, duration + 200);
}

function prepararLente() {
  let espera = null;
  document.addEventListener(
    'pointerdown',
    (e) => {
      const boton = e.target.closest?.('button, a, [role="tab"]');
      const pista = boton?.parentElement?.closest(PISTAS);
      if (!pista || reducido()) return;
      const antes = pista.querySelector(ELEGIDA);
      if (!antes || antes === boton) return (espera = null);
      espera = { huella: huellaDe(pista), rect: antes.getBoundingClientRect(), t: performance.now() };
    },
    { passive: true, capture: true },
  );
  document.addEventListener(
    'click',
    () => {
      const e = espera;
      espera = null;
      if (!e || performance.now() - e.t > 1500) return;
      // La app cambia la elegida (y a veces repinta) justo después: se mira en cuanto se pueda.
      let intentos = 0;
      const mirar = () => {
        const pista = buscar(e.huella);
        const nueva = pista?.querySelector(ELEGIDA);
        if (nueva) {
          const r = nueva.getBoundingClientRect();
          if (Math.abs(r.left - e.rect.left) > 1 || Math.abs(r.top - e.rect.top) > 1) return viajar(pista, e.rect, nueva);
        }
        if (++intentos < 8) requestAnimationFrame(mirar);
      };
      setTimeout(mirar, 0);
    },
    { passive: true },
  );
}

// ---------- Llegada escalonada ----------

const LLEGAN = [
  '.bloque',
  '.grupo',
  '.fila',
  '.oferta',
  '.gasto',
  '.tarjeta-aviso',
  '.burbuja',
  '.biblia__lectura',
  '.biblia__plan',
  '.gastos__cifra',
  '.empleo-portada',
  '.ajustes-temas',
  '.f-panel',
  '.f-rejilla-2',
  '.f-titulo',
  '.f-segmento',
].join(', ');

// Las primeras tarjetas visibles llegan una tras otra (como mucho 10). Si la
// vista se pinta un momento después (datos que llegan), lo nuevo también
// llega escalonado; lo que ya llegó no se repite.
const llegados = new WeakSet();
export function escalonar(contenedor, opciones = {}) {
  if (!contenedor || reducido()) return;
  const lanzar = () => escalonarAhora(contenedor, opciones);
  requestAnimationFrame(lanzar);
  // Durante medio segundo, lo que se pinte de nuevo también llega.
  let pendiente = false;
  const vigia = new MutationObserver(() => {
    if (pendiente) return;
    pendiente = true;
    requestAnimationFrame(() => {
      pendiente = false;
      lanzar();
    });
  });
  vigia.observe(contenedor, { childList: true, subtree: true });
  setTimeout(() => vigia.disconnect(), 500);
}

function escalonarAhora(contenedor, { max = 10, paso = 32 } = {}) {
  const alto = innerHeight;
  const { easing, duration } = muelle('suave');
  let i = 0;
  for (const el of contenedor.querySelectorAll(LLEGAN)) {
    if (i >= max) break;
    if (llegados.has(el)) {
      i++;
      continue;
    }
    // Solo lo de primer nivel (no las tarjetas dentro de otras).
    if (el.parentElement?.closest(LLEGAN) && contenedor.contains(el.parentElement.closest(LLEGAN))) continue;
    const r = el.getBoundingClientRect();
    if (!r.height || r.top > alto) continue;
    try {
      el.animate(
        [
          { opacity: 0, transform: 'translateY(14px) scale(0.975)' },
          { opacity: 1, transform: 'none' },
        ],
        { duration, easing, delay: i * paso, fill: 'backwards' },
      );
      llegados.add(el);
    } catch {
      /* navegador sin WAAPI: sin animación */
    }
    i++;
  }
}

let preparado = false;
export function prepararFluidez() {
  if (preparado) return;
  preparado = true;
  prepararLuz();
  prepararLente();
}

// ---------- Hojas que se arrastran para cerrar ----------

// Resistencia al pasarse del borde (cuanto más lejos, menos sigue al dedo).
export const elastico = (exceso, dimension, c = 0.55) => (exceso * dimension * c) / (dimension + c * Math.abs(exceso));
// Dónde acabaría lo lanzado con esa velocidad (px/s), como el desplazamiento de iOS.
export const proyectar = (velocidad, deceleracion = 0.998) => ((velocidad / 1000) * deceleracion) / (1 - deceleracion);

// La hoja sigue al dedo 1:1 hacia abajo (y resiste hacia arriba). Al soltar,
// se proyecta el impulso: si la hoja «acabaría» por debajo de su mitad, o se
// lanzó hacia abajo con fuerza, se cierra desde donde está y con su velocidad;
// si no, vuelve con un muelle. Se puede volver a agarrar a medio camino.
// cerrar({ desde, velocidad }) cierra la hoja; puedeEmpezar(e) dice si ese
// toque puede arrastrarla (por ejemplo, solo desde el asa).
export function arrastrarParaCerrar(panel, { cerrar, puedeEmpezar = () => true, umbral = 8, capturar = false }) {
  let a = null;
  // Mientras dura el gesto se escucha en toda la ventana: el dedo puede salir
  // del panel (por arriba, al estirarlo) sin que se pierda el arrastre.
  const mover = (e) => {
    if (!a || e.pointerId !== a.id) return;
    const recorrido = e.clientY - a.y0;
    if (!a.moviendo && Math.abs(recorrido) < umbral) return;
    a.moviendo = true;
    let dy = a.base + recorrido;
    if (dy < 0) dy = -elastico(-dy, panel.offsetHeight || 400);
    a.dy = dy;
    a.historia.push({ y: e.clientY, t: e.timeStamp });
    if (a.historia.length > 6) a.historia.shift();
    panel.style.transform = `translateY(${dy}px)`;
  };
  const soltar = (e) => {
    if (!a || (e && e.pointerId !== a.id)) return;
    removeEventListener('pointermove', mover);
    removeEventListener('pointerup', soltar);
    removeEventListener('pointercancel', soltar);
    const { dy, moviendo, historia } = a;
    a = null;
    if (!moviendo) return;
    // Tras arrastrar, el toque no cuenta como pulsar lo que hubiera debajo.
    if (Math.abs(dy) > 10) {
      const tragar = (ev) => ev.stopPropagation();
      panel.addEventListener('click', tragar, { capture: true, once: true });
      setTimeout(() => panel.removeEventListener('click', tragar, { capture: true }), 400);
    }
    const ultimo = historia.at(-1);
    const previo = historia.find((h) => ultimo.t - h.t < 100) ?? historia[0];
    const velocidad = ultimo.t > previo.t ? ((ultimo.y - previo.y) / (ultimo.t - previo.t)) * 1000 : 0;
    const alto = panel.offsetHeight || 400;
    if (dy + proyectar(velocidad) > alto * 0.5 || (velocidad > 900 && dy > 12)) {
      cerrar({ desde: dy, velocidad });
      return;
    }
    panel.style.transform = '';
    if (reducido() || !dy) return;
    panel._vuelta = panel.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }], muelle('hoja'));
  };
  panel.addEventListener('pointerdown', (e) => {
    if (e.button > 0 || a || !puedeEmpezar(e)) return;
    // Interrumpible: si estaba volviendo, se agarra desde donde va.
    const vuelta = panel._vuelta;
    let base = 0;
    if (vuelta && vuelta.playState === 'running') {
      base = new DOMMatrixReadOnly(getComputedStyle(panel).transform).m42 || 0;
      vuelta.cancel();
      panel.style.transform = base ? `translateY(${base}px)` : '';
    }
    a = { id: e.pointerId, y0: e.clientY, base, dy: base, moviendo: Boolean(base), historia: [{ y: e.clientY, t: e.timeStamp }] };
    if (capturar) panel.setPointerCapture?.(e.pointerId);
    addEventListener('pointermove', mover);
    addEventListener('pointerup', soltar);
    addEventListener('pointercancel', soltar);
  });
}
