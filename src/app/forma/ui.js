// Piezas comunes de la interfaz de Forma: iconos propios (trazo recto, otro
// lenguaje que el de Kitsune), formato de números, hojas que suben desde
// abajo, avisos con «Deshacer» y gráficas en SVG.
import { arrastrarParaCerrar } from '../fluidez.js';

// La unidad de un alimento o de lo apuntado: gramos salvo las bebidas (ml).
export const unidadDe = (x) => (x?.unidad === 'ml' ? 'ml' : 'g');

export const escapar = (t) =>
  String(t ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const NF = new Map();
export function num(n, decimales = 0) {
  if (!Number.isFinite(n)) return '—';
  const k = decimales;
  if (!NF.has(k)) NF.set(k, new Intl.NumberFormat('es-ES', { maximumFractionDigits: k, minimumFractionDigits: 0 }));
  return NF.get(k).format(n);
}
export const signo = (n, d = 1) => (n > 0 ? `+${num(n, d)}` : n < 0 ? `−${num(Math.abs(n), d)}` : num(0, d));

const P = {
  diario: '<path d="M4 5h16M4 12h16M4 19h10"/><circle cx="19" cy="19" r="2"/>',
  entreno: '<path d="M2 12h3M19 12h3M5 8v8M19 8v8M8 6v12M16 6v12M8 12h8"/>',
  progreso: '<path d="M3 20h18"/><path d="M4 16l5-5 4 3 7-8"/><path d="M15 6h5v5"/>',
  perfil: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  mas: '<path d="M12 4v16M4 12h16"/>',
  menos: '<path d="M5 12h14"/>',
  cerrar: '<path d="M6 6l12 12M18 6L6 18"/>',
  atras: '<path d="M15 5l-7 7 7 7"/>',
  adelante: '<path d="M9 5l7 7-7 7"/>',
  abajo: '<path d="M6 9l6 6 6-6"/>',
  buscar: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  escaner: '<path d="M4 8V4h4M16 4h4v4M20 16v4h-4M8 20H4v-4"/><path d="M8 8v8M11 8v8M14 8v8M17 8v8"/>',
  chispa: '<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.5 6.5l2.5 2.5M15 15l2.5 2.5M17.5 6.5L15 9M9 15l-2.5 2.5"/>',
  lapiz: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  plato: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/>',
  plantilla: '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M4 10h16M10 10v10"/>',
  agua: '<path d="M12 3c3 4.5 6 7.6 6 11a6 6 0 0 1-12 0c0-3.4 3-6.5 6-11z"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
  estrella: '<path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z"/>',
  basura: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  reloj: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2M9 2h6"/>',
  camara: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  fusionar: '<path d="M6 4v4a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4"/><path d="M12 14v6M9 17l3 3 3-3"/>',
  importar: '<path d="M9 4h6v3H9z"/><path d="M15 5h3v15H6V5h3"/><path d="M12 10v6M9 13.5l3 3 3-3"/>',
  copiar: '<rect x="8" y="8" width="12" height="12" rx="1.5"/><path d="M16 8V4H4v12h4"/>',
  diana: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".6"/>',
  trofeo: '<path d="M8 4h8v5a4 4 0 0 1-8 0zM8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8 20h8"/>',
  regla: '<path d="M3 16L16 3l5 5L8 21z"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2"/>',
  foto: '<rect x="3" y="5" width="18" height="14" rx="1.5"/><path d="M3 16l5-5 4 4 3-3 6 6"/><circle cx="16" cy="9" r="1.5"/>',
  descargar: '<path d="M12 4v11M7 10l5 5 5-5M4 20h16"/>',
  zorro: '<path d="M4 4l4 5h8l4-5v9l-8 7-8-7z"/><path d="M9.5 13.5h.01M14.5 13.5h.01"/>',
  restaurante: '<path d="M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 0-3 2-3 5v5h3v8M17 3v18"/>',
  discos: '<path d="M2 12h20"/><rect x="6" y="6" width="3" height="12"/><rect x="15" y="6" width="3" height="12"/><rect x="4" y="8" width="2" height="8"/><rect x="18" y="8" width="2" height="8"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5h.01"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  menu: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  salud: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  llave: '<circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M14 9l2 2"/>',
  fuego: '<path d="M12 21a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7z"/>',
};

export function ic(nombre, tam = 20) {
  return `<svg class="f-ic" width="${tam}" height="${tam}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="square" stroke-linejoin="miter" aria-hidden="true">${P[nombre] ?? ''}</svg>`;
}

// ---------- Hojas (paneles que suben desde abajo) ----------
export function crearHojas(contenedor) {
  const pila = [];
  function cerrar(hoja = pila.at(-1)) {
    if (!hoja) return;
    const i = pila.indexOf(hoja);
    if (i >= 0) pila.splice(i, 1);
    hoja.el.classList.add('f-hoja--sale');
    hoja.alCerrar?.();
    setTimeout(() => hoja.el.remove(), 300);
    // El foco vuelve a la hoja de debajo (o a Forma): así Escape sigue cerrando la siguiente.
    const debajo = pila.at(-1)?.el.querySelector('.f-hoja__panel') ?? contenedor.closest('.forma');
    debajo?.focus({ preventScroll: true });
  }
  function abrir(html, { alCerrar, clase = '', titulo = '' } = {}) {
    const el = document.createElement('div');
    el.className = `f-hoja ${clase}`;
    el.innerHTML = `<div class="f-hoja__fondo" data-cerrar-hoja></div><section class="f-hoja__panel" role="dialog" aria-modal="true" tabindex="-1" ${titulo ? `aria-label="${escapar(titulo)}"` : ''}><span class="f-hoja__asa" aria-hidden="true"></span><div class="f-hoja__cuerpo">${html}</div></section>`;
    contenedor.append(el);
    const hoja = { el, alCerrar, cuerpo: el.querySelector('.f-hoja__cuerpo') };
    pila.push(hoja);
    el.addEventListener('click', (e) => {
      if (e.target.closest('[data-cerrar-hoja]')) cerrar(hoja);
    });
    // Arrastrar hacia abajo desde el asa o la parte de arriba para cerrar: sigue
    // al dedo y, al soltar, se cierra o vuelve según el impulso (../fluidez.js).
    const panel = el.querySelector('.f-hoja__panel');
    arrastrarParaCerrar(panel, {
      capturar: true,
      puedeEmpezar: (e) => e.clientY - panel.getBoundingClientRect().top <= 44 && !e.target.closest('input, textarea, select, button'),
      cerrar: ({ desde }) => {
        // Baja desde donde la soltó el dedo (f-baja parte del transform actual).
        panel.style.transform = `translateY(${desde}px)`;
        cerrar(hoja);
      },
    });
    return hoja;
  }
  return { abrir, cerrar, abierta: () => pila.at(-1) ?? null, cerrarTodas: () => [...pila].forEach((h) => cerrar(h)) };
}

// ---------- Aviso breve con acción ----------
export function crearTostada(el) {
  let temporizador = null;
  return function tostada(texto, { accion = null, etiqueta = 'Deshacer', ms = 4200 } = {}) {
    clearTimeout(temporizador);
    el.innerHTML = `<span>${escapar(texto)}</span>${accion ? `<button type="button" class="f-tostada__accion">${escapar(etiqueta)}</button>` : ''}`;
    el.hidden = false;
    el.classList.remove('f-tostada--sale');
    el.querySelector('button')?.addEventListener('click', () => {
      accion();
      el.hidden = true;
    });
    temporizador = setTimeout(() => {
      el.classList.add('f-tostada--sale');
      setTimeout(() => (el.hidden = true), 250);
    }, ms);
  };
}

// ---------- Gráficas ----------

// Arco del medidor de kcal: 240° de recorrido.
export function medidor(fraccion, { tam = 220, grosor = 14 } = {}) {
  const r = (tam - grosor) / 2;
  const c = tam / 2;
  const inicio = 150;
  const recorrido = 240;
  const punto = (ang) => [c + r * Math.cos((ang * Math.PI) / 180), c + r * Math.sin((ang * Math.PI) / 180)];
  const arco = (desde, hasta) => {
    const [x1, y1] = punto(desde);
    const [x2, y2] = punto(hasta);
    return `M${x1.toFixed(2)} ${y1.toFixed(2)} A${r} ${r} 0 ${hasta - desde > 180 ? 1 : 0} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
  };
  const f = Math.max(0, Math.min(1, fraccion));
  const pasado = fraccion > 1;
  const marcas = Array.from({ length: 25 }, (_, i) => {
    const ang = inicio + (recorrido * i) / 24;
    const [x1, y1] = [c + (r - grosor) * Math.cos((ang * Math.PI) / 180), c + (r - grosor) * Math.sin((ang * Math.PI) / 180)];
    const [x2, y2] = [c + (r - grosor - (i % 6 === 0 ? 8 : 4)) * Math.cos((ang * Math.PI) / 180), c + (r - grosor - (i % 6 === 0 ? 8 : 4)) * Math.sin((ang * Math.PI) / 180)];
    return `<line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }).join('');
  return `<svg class="f-medidor${pasado ? ' f-medidor--pasado' : ''}" viewBox="0 0 ${tam} ${tam}" aria-hidden="true">
    <defs><linearGradient id="f-grad-medidor" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#1f5fe0"/><stop offset="1" stop-color="#7fd6ff"/></linearGradient></defs>
    <g class="f-medidor__marcas">${marcas}</g>
    <path class="f-medidor__pista" d="${arco(inicio, inicio + recorrido)}" stroke-width="${grosor}"/>
    ${f > 0.002 ? `<path class="f-medidor__valor" d="${arco(inicio, inicio + recorrido * f)}" stroke-width="${grosor}" pathLength="1"/>` : ''}
  </svg>`;
}

// Gráfica de líneas: series [{ puntos: [{ x: 'AAAA-MM-DD', y }], clase, puntosVisibles }], línea de objetivo opcional.
// lineas: [{ y, etiqueta, hecha }] horizontales (los hitos), con su texto a la izquierda.
export function grafica({ series, objetivo = null, lineas = [], alto = 170, formato = (v) => num(v, 1), vacio = 'Aún no hay datos' }) {
  const todos = series.flatMap((s) => s.puntos).filter((p) => Number.isFinite(p.y));
  if (todos.length < 2) return `<div class="f-grafica f-grafica--vacia">${escapar(vacio)}</div>`;
  lineas = lineas.filter((l) => Number.isFinite(l.y));
  const ancho = 340;
  const m = { i: 6, d: 40, a: 12, b: 22 };
  const xs = todos.map((p) => Date.parse(`${p.x}T12:00:00`));
  const x0 = Math.min(...xs);
  const x1 = Math.max(...xs);
  const ys = todos
    .map((p) => p.y)
    .concat(Number.isFinite(objetivo) ? [objetivo] : [])
    .concat(lineas.map((l) => l.y));
  let y0 = Math.min(...ys);
  let y1 = Math.max(...ys);
  const holgura = Math.max((y1 - y0) * 0.12, 0.5);
  y0 -= holgura;
  y1 += holgura;
  const X = (x) => m.i + ((Date.parse(`${x}T12:00:00`) - x0) / Math.max(1, x1 - x0)) * (ancho - m.i - m.d);
  const Y = (y) => m.a + (1 - (y - y0) / (y1 - y0)) * (alto - m.a - m.b);
  const guias = [0, 0.5, 1].map((f) => {
    const v = y0 + (y1 - y0) * f;
    return `<line class="f-grafica__guia" x1="${m.i}" x2="${ancho - m.d}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}"/><text class="f-grafica__eje" x="${ancho - m.d + 6}" y="${(Y(v) + 3).toFixed(1)}">${formato(v)}</text>`;
  });
  const fechas = [todos.reduce((a, p) => (p.x < a ? p.x : a), todos[0].x), todos.reduce((a, p) => (p.x > a ? p.x : a), todos[0].x)];
  const etiquetaFecha = (f) => {
    const d = new Date(`${f}T12:00:00`);
    return `${d.getDate()}/${d.getMonth() + 1}`;
  };
  const trazos = series
    .map((s) => {
      const pts = s.puntos.filter((p) => Number.isFinite(p.y));
      if (!pts.length) return '';
      const d = pts.map((p, i) => `${i ? 'L' : 'M'}${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)}`).join(' ');
      const area = s.area ? `<path class="f-grafica__area ${s.clase ?? ''}" d="${d} L${X(pts.at(-1).x).toFixed(1)} ${alto - m.b} L${X(pts[0].x).toFixed(1)} ${alto - m.b} Z"/>` : '';
      const circulos = s.puntosVisibles ? pts.map((p) => `<circle class="f-grafica__punto ${s.clase ?? ''}" cx="${X(p.x).toFixed(1)}" cy="${Y(p.y).toFixed(1)}" r="2.4"/>`).join('') : '';
      return `${area}${s.sinLinea ? '' : `<path class="f-grafica__linea ${s.clase ?? ''}" d="${d}"/>`}${circulos}`;
    })
    .join('');
  const meta = Number.isFinite(objetivo) && objetivo >= y0 && objetivo <= y1 ? `<line class="f-grafica__objetivo" x1="${m.i}" x2="${ancho - m.d}" y1="${Y(objetivo).toFixed(1)}" y2="${Y(objetivo).toFixed(1)}"/>` : '';
  const hitos = lineas
    .map(
      (l) =>
        `<line class="f-grafica__hito${l.hecha ? ' hecha' : ''}" x1="${m.i}" x2="${ancho - m.d}" y1="${Y(l.y).toFixed(1)}" y2="${Y(l.y).toFixed(1)}"/>` +
        (l.etiqueta ? `<text class="f-grafica__eje f-grafica__hito-texto" x="${m.i + 4}" y="${(Y(l.y) - 3).toFixed(1)}">${escapar(l.etiqueta)}</text>` : ''),
    )
    .join('');
  return `<svg class="f-grafica" viewBox="0 0 ${ancho} ${alto}" preserveAspectRatio="none" role="img" aria-label="Gráfica">
    ${guias.join('')}${meta}${hitos}${trazos}
    <text class="f-grafica__eje" x="${m.i}" y="${alto - 6}">${etiquetaFecha(fechas[0])}</text>
    <text class="f-grafica__eje" x="${ancho - m.d}" y="${alto - 6}" text-anchor="end">${etiquetaFecha(fechas[1])}</text>
  </svg>`;
}

// Barrita de evolución (sin ejes) para listas.
export function minigrafica(valores, { ancho = 72, alto = 22 } = {}) {
  const v = valores.filter(Number.isFinite);
  if (v.length < 2) return '';
  const a = Math.min(...v);
  const b = Math.max(...v);
  const d = v.map((y, i) => `${i ? 'L' : 'M'}${((i / (v.length - 1)) * ancho).toFixed(1)} ${(alto - 2 - ((y - a) / Math.max(0.0001, b - a)) * (alto - 4)).toFixed(1)}`).join(' ');
  return `<svg class="f-mini" viewBox="0 0 ${ancho} ${alto}" width="${ancho}" height="${alto}" aria-hidden="true"><path d="${d}"/></svg>`;
}

// Redimensiona una foto en el dispositivo antes de mandarla a la IA (menos tokens, más rápido).
export async function fotoReducida(archivo, lado = 1024, calidad = 0.82) {
  const url = URL.createObjectURL(archivo);
  try {
    const img = await new Promise((ok, mal) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = () => mal(new Error('No he podido abrir la foto.'));
      i.src = url;
    });
    const escala = Math.min(1, lado / Math.max(img.naturalWidth, img.naturalHeight));
    const lienzo = document.createElement('canvas');
    lienzo.width = Math.round(img.naturalWidth * escala);
    lienzo.height = Math.round(img.naturalHeight * escala);
    lienzo.getContext('2d').drawImage(img, 0, 0, lienzo.width, lienzo.height);
    const datosUrl = lienzo.toDataURL('image/jpeg', calidad);
    return { tipo: 'image/jpeg', datos: datosUrl.split(',')[1], url: datosUrl };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export const vibrar = (ms = 12) => {
  try {
    navigator.vibrate?.(ms);
  } catch {
    // No todos los dispositivos vibran.
  }
};
