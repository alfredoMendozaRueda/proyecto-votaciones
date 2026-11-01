// Movimiento de la interfaz que necesita algo de JavaScript: la onda de tinta
// al pulsar, la raya que se desliza bajo el apartado activo, la entrada de
// cada vista desde el lado hacia el que se va, las insignias que saltan, el
// avión de papel del botón de enviar y los elementos que se pliegan al
// borrarlos. Todo respeta «reducir movimiento».

const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const CURVA = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

// Dónde nace una onda de tinta al pulsar.
const CON_ONDA = [
  '.boton',
  '.boton-enviar',
  '.sugerencias button',
  '.fila__abrir',
  '.hoja__entrada',
  '.calendario__celda',
  '.filtros button',
  '.segmentado button',
  '.pelajes button',
].join(', ');

export function prepararOndas(raiz = document) {
  raiz.addEventListener(
    'pointerdown',
    (e) => {
      const el = e.target.closest?.(CON_ONDA);
      if (!el || el.disabled || reducido()) return;
      const r = el.getBoundingClientRect();
      const tam = Math.hypot(r.width, r.height) * 2;
      const onda = document.createElement('span');
      onda.className = 'onda';
      onda.style.cssText = `width:${tam}px;height:${tam}px;left:${e.clientX - r.left - tam / 2}px;top:${e.clientY - r.top - tam / 2}px`;
      el.classList.add('con-onda');
      el.append(onda);
      onda.addEventListener('animationend', () => onda.remove(), { once: true });
    },
    { passive: true },
  );
}

// La raya del apartado activo se desliza de uno a otro en vez de saltar.
export function prepararIndicador(barra) {
  const raya = document.createElement('span');
  raya.className = 'apartados__indicador';
  raya.setAttribute('aria-hidden', 'true');
  barra.append(raya);
  const mover = () => {
    const activo = [...barra.querySelectorAll('button')].find(
      (b) => b.offsetParent && (b.classList.contains('activo') || b.getAttribute('aria-selected') === 'true'),
    );
    if (!activo || !barra.offsetWidth) return;
    const primera = !raya.classList.contains('lista');
    // En escritorio la barra es un riel vertical: la raya va a su izquierda y baja.
    const vertical = getComputedStyle(barra).flexDirection === 'column';
    raya.classList.toggle('vertical', vertical);
    if (vertical) {
      const alto = Math.max(18, activo.offsetHeight * 0.5);
      raya.style.width = '';
      raya.style.height = `${alto}px`;
      raya.style.transform = `translateY(${activo.offsetTop + (activo.offsetHeight - alto) / 2}px)`;
    } else {
      const ancho = Math.max(18, activo.offsetWidth * 0.42);
      raya.style.height = '';
      raya.style.width = `${ancho}px`;
      raya.style.transform = `translateX(${activo.offsetLeft + (activo.offsetWidth - ancho) / 2}px)`;
    }
    // La primera vez se coloca sin deslizarse desde la izquierda.
    if (primera) {
      void raya.offsetWidth;
      raya.classList.add('lista');
    }
  };
  new ResizeObserver(mover).observe(barra);
  // En escritorio el activo ensancha su nombre con una transición: se recoloca al acabar.
  barra.addEventListener('transitionend', mover);
  return mover;
}

// La vista nueva llega desde el lado hacia el que se avanza.
export function entrarVista(vista, direccion) {
  vista.classList.remove('entrando');
  void vista.offsetWidth;
  vista.classList.add('entrando');
  clearTimeout(vista._finEntrada);
  vista._finEntrada = setTimeout(() => vista.classList.remove('entrando'), 1400);
  if (reducido() || !direccion) return;
  vista.animate(
    [
      { opacity: 0, transform: `translateX(${direccion * 22}px)` },
      { opacity: 1, transform: 'none' },
    ],
    { duration: 340, easing: CURVA },
  );
}

// Pasar a una pantalla más honda (leer un correo) o volver de ella.
export function deslizar(el, direccion) {
  if (reducido()) return;
  el.animate(
    [
      { opacity: 0, transform: `translateX(${direccion * 28}px)` },
      { opacity: 1, transform: 'none' },
    ],
    { duration: 320, easing: CURVA },
  );
}

// Un número que cambia salta un momento para que se note.
export function saltar(el) {
  el.classList.remove('salta');
  void el.offsetWidth;
  el.classList.add('salta');
}

// Se pliega y se va hacia un lado antes de quitarlo.
export async function retirar(el) {
  if (!reducido()) {
    const alto = el.offsetHeight;
    await el
      .animate(
        [
          { opacity: 1, transform: 'none', height: `${alto}px` },
          { opacity: 0, transform: 'translateX(40px)', height: `${alto}px`, offset: 0.55 },
          { opacity: 0, transform: 'translateX(40px)', height: '0px', paddingTop: '0px', paddingBottom: '0px', marginTop: '0px' },
        ],
        { duration: 420, easing: CURVA },
      )
      .finished.catch(() => {});
  }
  el.remove();
}

// Al enviar, el icono sale volando como un avión de papel y vuelve.
export function prepararEnvio(formulario, boton) {
  formulario.addEventListener('submit', () => {
    if (reducido()) return;
    boton.classList.remove('volando');
    void boton.offsetWidth;
    boton.classList.add('volando');
    setTimeout(() => boton.classList.remove('volando'), 600);
  });
}

// Chispas de fuego fatuo que suben despacio en la pantalla del zorro.
export function crearChispas(cantidad = 16) {
  const capa = document.createElement('div');
  capa.className = 'chispas';
  capa.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < cantidad; i++) {
    const c = document.createElement('i');
    const tam = 2 + Math.random() * 3;
    c.style.cssText = [
      `left:${5 + Math.random() * 90}%`,
      `width:${tam}px`,
      `height:${tam}px`,
      `animation-duration:${7 + Math.random() * 7}s`,
      `animation-delay:${-Math.random() * 12}s`,
      `--deriva:${(Math.random() - 0.5) * 80}px`,
    ].join(';');
    capa.append(c);
  }
  return capa;
}
