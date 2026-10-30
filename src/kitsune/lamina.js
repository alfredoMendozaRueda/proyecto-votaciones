// La ilustración del zorro como lámina animada: la imagen tal cual, movida
// con las mismas poses que el modelo 3D (saltos, aplastado, inclinación,
// vueltas, respiración) y con párpados encima de sus ojos para parpadear.
// Los fuegos fatuos siguen siendo 3D y se dibujan por encima, en el lienzo.

const RUTA = './kitsune/ilustracion.webp';
const PROPORCION = 922 / 900;
// Ojos de la imagen, en fracciones de su ancho y alto: centro y semiejes.
const OJOS = [
  { x: 0.464, y: 0.461, rx: 0.045, ry: 0.044 },
  { x: 0.615, y: 0.412, rx: 0.041, ry: 0.047 },
];
// El párpado es algo mayor que el ojo para tapar su contorno, con el borde difuminado.
const HOLGURA = 1.2;
// Trozo de frente sin rasgos (entre las cejas) del que sale el pelaje de los párpados.
const FRENTE = { x: 0.475, y: 0.29 };
// Tonos para los pelajes: la ilustración es carmesí; sombra y nieve se tiñen.
const FILTROS = {
  carmesi: 'none',
  sombra: 'grayscale(1) brightness(0.42) contrast(1.35)',
  nieve: 'grayscale(1) brightness(1.2) contrast(0.92)',
};

export class Lamina {
  constructor(contenedor) {
    this.capa = document.createElement('div');
    this.capa.style.cssText = 'position:absolute;inset:0;pointer-events:none;overflow:visible;container-type:size';
    this.figura = document.createElement('div');
    this.figura.style.cssText = [
      'position:absolute',
      'left:50%',
      'bottom:3%',
      // Lo más grande que quepa: el 90 % del alto sin salirse por los lados.
      `height:min(90cqh, ${(96 / PROPORCION).toFixed(2)}cqw)`,
      `aspect-ratio:${PROPORCION}`,
      'transform-origin:50% 100%',
      'will-change:transform',
    ].join(';');
    this.imagen = new Image();
    this.imagen.src = RUTA;
    this.imagen.alt = '';
    this.imagen.draggable = false;
    this.imagen.style.cssText = 'display:block;width:100%;height:100%;user-select:none';
    // Cada párpado es un trozo de pelaje que baja dentro del contorno del ojo.
    this.parpados = OJOS.map((ojoDibujo) => {
      const o = { ...ojoDibujo, rx: ojoDibujo.rx * HOLGURA, ry: ojoDibujo.ry * HOLGURA };
      const ojo = document.createElement('i');
      const borde = 'radial-gradient(closest-side, #000 84%, transparent)';
      ojo.style.cssText = [
        'position:absolute',
        `left:${(o.x - o.rx) * 100}%`,
        `top:${(o.y - o.ry) * 100}%`,
        `width:${o.rx * 200}%`,
        `height:${o.ry * 200}%`,
        `mask-image:${borde}`,
        `-webkit-mask-image:${borde}`,
        'visibility:hidden',
      ].join(';');
      const piel = document.createElement('b');
      piel.style.cssText = [
        'position:absolute',
        'inset:0',
        'border-radius:0 0 50% 50% / 0 0 34% 34%',
        // Sombra del pliegue sobre el pelaje de la propia ilustración.
        `background-image:linear-gradient(transparent 45%, rgba(90, 30, 8, 0.38)), url(${RUTA})`,
        `background-size:100% 100%, ${100 / (2 * o.rx)}% ${100 / (2 * o.ry)}%`,
        `background-position:0 0, ${(100 * FRENTE.x) / (1 - 2 * o.rx)}% ${(100 * FRENTE.y) / (1 - 2 * o.ry)}%`,
        'transform:translateY(-102%)',
      ].join(';');
      // Ojo cerrado: la línea de las pestañas, curvada como una sonrisa.
      const raya = document.createElement('u');
      raya.style.cssText = [
        'position:absolute',
        'left:20%',
        'right:20%',
        'top:28%',
        'height:34%',
        'border-radius:50%',
        'border:0 solid #2b150c',
        'opacity:0',
      ].join(';');
      ojo.append(piel, raya);
      return ojo;
    });
    // Sombra blanda en el suelo, que se estrecha cuando salta.
    this.sombra = document.createElement('div');
    this.sombra.style.cssText =
      'position:absolute;left:50%;bottom:2%;width:56%;height:7%;border-radius:50%;background:radial-gradient(closest-side, rgba(0,0,0,.45), transparent);transform:translateX(-50%)';
    this.figura.append(this.imagen, ...this.parpados);
    this.capa.append(this.sombra, this.figura);
    contenedor.prepend(this.capa);
    this.capa.hidden = true;

    // Silueta para saber si un toque cae sobre el zorro y no en lo transparente.
    this.alfa = null;
    this.imagen.decode?.().then(() => this._prepararAlfa()).catch(() => {});
  }

  _prepararAlfa() {
    const lienzo = document.createElement('canvas');
    lienzo.width = 184;
    lienzo.height = Math.round(184 / PROPORCION);
    const ctx = lienzo.getContext('2d', { willReadFrequently: true });
    ctx.drawImage(this.imagen, 0, 0, lienzo.width, lienzo.height);
    this.alfa = { datos: ctx.getImageData(0, 0, lienzo.width, lienzo.height).data, ancho: lienzo.width, alto: lienzo.height };
  }

  set activa(valor) {
    this.capa.hidden = !valor;
  }

  get activa() {
    return !this.capa.hidden;
  }

  setPaleta(nombre) {
    this.figura.style.filter = FILTROS[nombre] ?? 'none';
  }

  // e: escala, salto (0..1), sx/sy (aplastado), giro (vuelta, rad),
  // inclinacion (rad), cabeceo, respiracion (-1..1), habla (0..1), apertura (0..1.2), alegria, bebe (0..1).
  pintar(e) {
    // En la esquina (cría) la cola en abanico ocuparía demasiado: algo más pequeño.
    e = { ...e, escala: e.escala * (1 - 0.16 * (e.bebe ?? 0)) };
    const alto = this.figura.offsetHeight || 1;
    const vuelta = Math.cos(e.giro);
    const sx = e.escala * (1 + (e.sx - 1) * 0.7) * (Math.abs(vuelta) < 0.04 ? 0.04 * Math.sign(vuelta || 1) : vuelta);
    const sy = e.escala * (1 + (e.sy - 1) * 0.7) * (1 + 0.012 * e.respiracion + 0.025 * e.habla + 0.02 * e.alegria);
    const y = -e.salto * alto * 0.32 + e.cabeceo * alto * 0.04;
    const rot = e.inclinacion * 22 + e.mirada * 2.5;
    this.figura.style.transform = `translateX(-50%) translateY(${y.toFixed(1)}px) rotate(${rot.toFixed(2)}deg) scale(${sx.toFixed(3)}, ${sy.toFixed(3)})`;
    this.figura.style.opacity = e.escala > 0.01 ? '1' : '0';
    // En reposo los ojos están abiertos del todo; al dormir o parpadear, cerrados.
    const cierre = Math.max(0, Math.min(1, 1 - e.apertura / 0.85));
    const pestana = Math.max(1, alto * 0.005);
    for (const ojo of this.parpados) {
      ojo.style.visibility = cierre > 0.02 ? 'visible' : 'hidden';
      const [piel, raya] = ojo.children;
      piel.style.transform = `translateY(${((cierre - 1) * 102).toFixed(1)}%)`;
      piel.style.boxShadow = `inset 0 -${pestana.toFixed(1)}px 0 #2b150c`;
      raya.style.borderBottomWidth = `${(pestana * 1.3).toFixed(1)}px`;
      raya.style.opacity = String(Math.max(0, (cierre - 0.8) / 0.2));
    }
    const lejos = Math.min(1, e.salto);
    this.sombra.style.transform = `translateX(-50%) scale(${(e.escala * (1 - 0.35 * lejos)).toFixed(3)})`;
    this.sombra.style.opacity = String(e.escala * (1 - 0.5 * lejos));
  }

  // ¿Cae el punto (coordenadas de pantalla) sobre el dibujo?
  toca(x, y) {
    if (!this.activa) return false;
    const r = this.figura.getBoundingClientRect();
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return false;
    if (!this.alfa) return true;
    const u = Math.floor(((x - r.left) / r.width) * this.alfa.ancho);
    const v = Math.floor(((y - r.top) / r.height) * this.alfa.alto);
    return this.alfa.datos[(v * this.alfa.ancho + u) * 4 + 3] > 40;
  }

  destruir() {
    this.capa.remove();
  }
}
