import * as THREE from 'three';
import { PALETAS, PALETA_POR_DEFECTO } from './paletas.js';
import { Cola } from './cola.js';
import { FuegosFatuos } from './fuegos.js';
import { crearMaterialContorno } from './contorno.js';
import {
  clamp01,
  lerp,
  easeOutCubic,
  easeInCubic,
  easeInOutCubic,
  easeOutBack,
  easeInBack,
  tramo,
  campana,
  amortiguar,
} from './easing.js';

export const ESTADOS = ['reposo', 'escuchar', 'hablar', 'pensar', 'dormir'];
export const ACCIONES = ['aparecer', 'saludar', 'alegria', 'desaparecer'];

const NUM_COLAS = 9;

const REPOSO = {
  orejas: 0,
  inclinacion: 0,
  cabeceo: 0,
  apertura: 0.9,
  miradaX: 0,
  miradaY: 0,
  habla: 0,
  abanico: 1,
  rizo: 1,
  ondaAmp: 1,
  ondaVel: 1,
  remolino: 0,
  agachado: 0,
  respiracion: 1,
  brillo: 0.75,
  velFuego: 1,
};

// Cada estado es un conjunto de objetivos; los valores reales los persiguen
// con suavizado exponencial, así cualquier cambio de estado es interrumpible.
const OBJETIVOS = {
  reposo: REPOSO,
  escuchar: {
    ...REPOSO,
    orejas: 1,
    inclinacion: 0.2,
    cabeceo: -0.04,
    apertura: 1.08,
    abanico: 0.95,
    ondaAmp: 0.45,
    ondaVel: 0.7,
    brillo: 0.85,
  },
  hablar: {
    ...REPOSO,
    orejas: 0.35,
    inclinacion: -0.05,
    habla: 1,
    apertura: 0.95,
    abanico: 1.05,
    ondaAmp: 1.15,
    ondaVel: 1.3,
    brillo: 0.9,
  },
  pensar: {
    ...REPOSO,
    orejas: 0.45,
    inclinacion: -0.24,
    cabeceo: -0.2,
    apertura: 0.62,
    miradaX: 0.5,
    miradaY: 0.75,
    abanico: 1.1,
    rizo: 1.1,
    ondaAmp: 0.5,
    ondaVel: 0.8,
    remolino: 1,
    brillo: 1,
    velFuego: 2.6,
  },
  dormir: {
    ...REPOSO,
    orejas: -1,
    inclinacion: 0.14,
    cabeceo: 0.44,
    apertura: 0,
    abanico: 0.42,
    rizo: 0.6,
    ondaAmp: 0.3,
    ondaVel: 0.45,
    agachado: 1,
    respiracion: 0.55,
    brillo: 0.3,
    velFuego: 0.45,
  },
};

const DURACIONES = { aparecer: 1.6, saludar: 1.9, alegria: 1.15, desaparecer: 0.95 };

function texturaRadial(interior, exterior, tam = 128) {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = tam;
  const g = lienzo.getContext('2d');
  const grad = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
  grad.addColorStop(0, interior);
  grad.addColorStop(1, exterior);
  g.fillStyle = grad;
  g.fillRect(0, 0, tam, tam);
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function texturaZ(color) {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 64;
  const g = lienzo.getContext('2d');
  g.fillStyle = color;
  g.font = 'bold 46px Georgia, serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('z', 32, 30);
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function gradienteToon() {
  const datos = new Uint8Array([86, 168, 255]);
  const tex = new THREE.DataTexture(datos, datos.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  return tex;
}

export class Kitsune {
  constructor(contenedor, opciones = {}) {
    const reducido =
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.opciones = {
      paleta: PALETA_POR_DEFECTO,
      seguirCursor: true,
      fuegos: true,
      visible: false,
      movimientoReducido: reducido,
      ...opciones,
    };
    this.contenedor = contenedor;
    this._oyentes = {};

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    contenedor.appendChild(this.renderer.domElement);

    this.escena = new THREE.Scene();
    this.camara = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    this.camara.position.set(0, 2.0, 8.4);
    this.camara.lookAt(0, 1.2, 0);

    this.escena.add(new THREE.HemisphereLight('#ffe9e2', '#3a1418', 1.15));
    const clave = new THREE.DirectionalLight('#fff4ea', 2.3);
    clave.position.set(3, 5, 6);
    this.luzContra = new THREE.DirectionalLight('#ff3048', 2.2);
    this.luzContra.position.set(-4, 3, -5);
    this.escena.add(clave, this.luzContra);

    this.resolucion = new THREE.Vector2(1, 1);
    this._crearMateriales();
    this._construir();

    this.fuegos = new FuegosFatuos(this.escena);
    this.setPaleta(this.opciones.paleta);

    this.estado = 'reposo';
    this.p = { ...REPOSO };
    this.visible = this.opciones.visible;
    this.accion = null;
    this.relojOnda = 0;
    this.relojRespiracion = 0;
    this.t = 0;
    this.parpadeo = { espera: 1.8, t: -1, doble: false };
    this.tic = { espera: 4, t: -1, lado: 1 };
    this.mirada = { x: 0, y: 0, objetivoX: 0, objetivoY: 0, ultimoMovimiento: -10 };
    this.zetas = { espera: 0.6, activas: [] };

    this._raycaster = new THREE.Raycaster();
    this._puntero = new THREE.Vector2();
    this._alMoverPuntero = this._alMoverPuntero.bind(this);
    this._alPulsar = this._alPulsar.bind(this);
    window.addEventListener('pointermove', this._alMoverPuntero);
    this.renderer.domElement.addEventListener('pointerdown', this._alPulsar);

    this._observador = new ResizeObserver(() => this._ajustarTamano());
    this._observador.observe(contenedor);
    this._ajustarTamano();

    this._reloj = new THREE.Clock();
    this._bucle = this._bucle.bind(this);
    this._frame = requestAnimationFrame(this._bucle);
  }

  // ---------- API pública ----------

  on(evento, fn) {
    (this._oyentes[evento] ||= []).push(fn);
    return () => {
      this._oyentes[evento] = this._oyentes[evento].filter((f) => f !== fn);
    };
  }

  setEstado(nombre) {
    if (!OBJETIVOS[nombre] || nombre === this.estado) return;
    this.estado = nombre;
    this._emitir('estado', nombre);
  }

  reproducir(nombre) {
    if (!DURACIONES[nombre]) return Promise.resolve();
    if (this.accion) this._cerrarAccion();
    if (nombre === 'aparecer') this.visible = true;
    return new Promise((resolver) => {
      this.accion = { nombre, t: 0, dur: DURACIONES[nombre], resolver };
      this._emitir('accion', nombre);
    });
  }

  setPaleta(nombre) {
    const pal = PALETAS[nombre];
    if (!pal) return;
    this.paleta = nombre;
    for (const clave of ['pelaje', 'crema', 'negro', 'orejaInterior', 'bocaInterior', 'collar', 'cascabel']) {
      this.mat[clave].color.set(pal[clave]);
    }
    this.mat.marca.color.set(pal.marca);
    this.mat.iris.color.set(pal.iris);
    this.mat.pupila.color.set(pal.pupila);
    this.mat.contorno.uniforms.uColor.value.set(pal.contorno);
    this.mat.anillo.color.set(pal.fuego);
    this.luzContra.color.set(pal.luzContra);
    for (const cola of this.colas) cola.setColores(pal.pelaje, pal.puntaCola);
    this.fuegos.setColores(pal.fuego, pal.fuegoNucleo);
    this._texturaZ?.dispose();
    this._texturaZ = texturaZ(pal.fuegoNucleo);
    for (const s of this.zetas3d) {
      s.material.map = this._texturaZ;
      s.material.needsUpdate = true;
    }
    this._emitir('paleta', nombre);
  }

  setOpcion(clave, valor) {
    this.opciones[clave] = valor;
  }

  destruir() {
    cancelAnimationFrame(this._frame);
    this._observador.disconnect();
    window.removeEventListener('pointermove', this._alMoverPuntero);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------- Construcción ----------

  _crearMateriales() {
    const gradiente = gradienteToon();
    const toon = (extra = {}) => new THREE.MeshToonMaterial({ gradientMap: gradiente, ...extra });
    const grosor = 2.4 * this.renderer.getPixelRatio();
    this.mat = {
      pelaje: toon(),
      crema: toon(),
      negro: toon(),
      orejaInterior: toon(),
      bocaInterior: toon(),
      collar: toon(),
      cascabel: toon(),
      cola: toon({ vertexColors: true }),
      marca: new THREE.MeshBasicMaterial(),
      iris: new THREE.MeshBasicMaterial(),
      pupila: new THREE.MeshBasicMaterial(),
      brillo: new THREE.MeshBasicMaterial({ color: '#ffffff' }),
      contorno: crearMaterialContorno('#000000', grosor, this.resolucion),
      anillo: new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: 0,
      }),
      sombra: new THREE.MeshBasicMaterial({
        map: texturaRadial('rgba(10,4,6,0.55)', 'rgba(10,4,6,0)'),
        transparent: true,
        depthWrite: false,
      }),
    };
  }

  _parte(geometria, material, padre, { pos = [0, 0, 0], esc = [1, 1, 1], rot = [0, 0, 0], contorno = true } = {}) {
    const malla = new THREE.Mesh(geometria, material);
    malla.position.set(...pos);
    malla.scale.set(...esc);
    malla.rotation.set(...rot);
    if (contorno) malla.add(new THREE.Mesh(geometria, this.mat.contorno));
    padre.add(malla);
    return malla;
  }

  _construir() {
    const m = this.mat;
    const esfera = new THREE.SphereGeometry(1, 40, 28);

    this.raiz = new THREE.Group();
    this.raiz.rotation.y = 0.32;
    this.escena.add(this.raiz);

    this.sombra = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.3), m.sombra);
    this.sombra.rotation.x = -Math.PI / 2;
    this.sombra.position.set(0, 0.002, -0.05);
    this.raiz.add(this.sombra);

    this.anillo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 72), m.anillo);
    this.anillo.rotation.x = -Math.PI / 2;
    this.anillo.position.y = 0.01;
    this.escena.add(this.anillo);

    // El cuerpo escala desde el suelo: el squash & stretch de los saltos no lo despega.
    this.cuerpo = new THREE.Group();
    this.raiz.add(this.cuerpo);

    this.torso = this._parte(esfera, m.pelaje, this.cuerpo, {
      pos: [0, 0.78, -0.02],
      esc: [0.5, 0.68, 0.46],
      rot: [0.18, 0, 0],
    });
    this.pecho = this._parte(esfera, m.crema, this.cuerpo, {
      pos: [0, 0.9, 0.22],
      esc: [0.34, 0.5, 0.26],
      rot: [0.25, 0, 0],
    });
    for (const lado of [-1, 1]) {
      this._parte(esfera, m.pelaje, this.cuerpo, { pos: [0.27 * lado, 0.3, -0.12], esc: [0.3, 0.3, 0.36] });
      this._parte(esfera, m.negro, this.cuerpo, { pos: [0.34 * lado, 0.06, 0.12], esc: [0.11, 0.07, 0.19] });
    }

    const capsulaAlta = new THREE.CapsuleGeometry(0.085, 0.32, 8, 16);
    const capsulaBaja = new THREE.CapsuleGeometry(0.08, 0.3, 8, 16);
    this.patas = [-1, 1].map((lado) => {
      const hombro = new THREE.Group();
      hombro.position.set(0.17 * lado, 0.78, 0.2);
      this.cuerpo.add(hombro);
      this._parte(capsulaAlta, m.pelaje, hombro, { pos: [0, -0.2, 0] });
      const antebrazo = new THREE.Group();
      antebrazo.position.y = -0.36;
      hombro.add(antebrazo);
      this._parte(capsulaBaja, m.pelaje, antebrazo, { pos: [0, -0.14, 0] });
      this._parte(esfera, m.negro, antebrazo, { pos: [0, -0.355, 0.05], esc: [0.1, 0.065, 0.14] });
      return { hombro, antebrazo };
    });

    this.collar = this._parte(new THREE.TorusGeometry(0.36, 0.055, 14, 48), m.collar, this.cuerpo, {
      pos: [0, 1.24, 0.14],
      rot: [Math.PI / 2 + 0.42, 0, 0],
    });
    this.cascabel = new THREE.Group();
    this.cascabel.position.set(0, 1.1, 0.5);
    this.cuerpo.add(this.cascabel);
    this._parte(esfera, m.cascabel, this.cascabel, { pos: [0, -0.06, 0.02], esc: [0.075, 0.075, 0.075] });
    this._parte(new THREE.BoxGeometry(0.09, 0.012, 0.02), m.negro, this.cascabel, {
      pos: [0, -0.085, 0.085],
      contorno: false,
    });

    this._construirCabeza(esfera);

    this.colasBase = new THREE.Group();
    this.colasBase.position.set(0, 0.34, -0.28);
    // El abanico se gira hacia la cámara para que las nueve colas se vean repartidas.
    this.colasBase.rotation.y = -0.28;
    this.cuerpo.add(this.colasBase);
    this.colas = Array.from({ length: NUM_COLAS }, (_, i) => {
      const cola = new Cola(i, NUM_COLAS, m.cola, m.contorno);
      this.colasBase.add(cola.malla);
      return cola;
    });

    this.zetas3d = Array.from({ length: 3 }, () => {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
      s.visible = false;
      this.escena.add(s);
      return s;
    });

    this._mallasCuerpo = [];
    this.cuerpo.traverse((o) => {
      if (o.isMesh && o.material !== m.contorno) this._mallasCuerpo.push(o);
    });
  }

  _construirCabeza(esfera) {
    const m = this.mat;
    this.cabeza = new THREE.Group();
    this.cabeza.rotation.order = 'YXZ';
    this.cabeza.position.set(0, 1.44, 0.1);
    this.cabeza.scale.setScalar(1.12);
    this.cuerpo.add(this.cabeza);

    const centro = new THREE.Vector3(0, 0.2, 0);
    const radios = new THREE.Vector3(0.42, 0.38, 0.38);
    this._parte(esfera, m.pelaje, this.cabeza, { pos: centro.toArray(), esc: radios.toArray() });

    for (const lado of [-1, 1]) {
      this._parte(esfera, m.crema, this.cabeza, {
        pos: [0.25 * lado, 0.03, 0.09],
        esc: [0.2, 0.13, 0.17],
        rot: [0, 0, -0.5 * lado],
      });
      this._parte(new THREE.ConeGeometry(0.085, 0.3, 16), m.crema, this.cabeza, {
        pos: [0.43 * lado, -0.05, 0.02],
        esc: [1, 1, 0.55],
        rot: [0, 0, -lado * (Math.PI / 2 + 0.75)],
      });
    }

    this._parte(esfera, m.pelaje, this.cabeza, { pos: [0, 0.13, 0.3], esc: [0.12, 0.1, 0.28], rot: [0.22, 0, 0] });
    this._parte(esfera, m.crema, this.cabeza, { pos: [0, 0.05, 0.34], esc: [0.13, 0.09, 0.27] });
    this._parte(esfera, m.negro, this.cabeza, { pos: [0, 0.1, 0.6], esc: [0.05, 0.038, 0.042] });
    this._parte(esfera, m.bocaInterior, this.cabeza, {
      pos: [0, 0.0, 0.36],
      esc: [0.075, 0.03, 0.16],
      contorno: false,
    });

    this.mandibula = new THREE.Group();
    this.mandibula.position.set(0, -0.02, 0.2);
    this.cabeza.add(this.mandibula);
    this._parte(esfera, m.crema, this.mandibula, { pos: [0, -0.01, 0.17], esc: [0.105, 0.045, 0.21] });

    const enSuperficie = (x, y, z) => {
      const d = new THREE.Vector3(x, y, z).normalize();
      const punto = new THREE.Vector3(d.x * radios.x, d.y * radios.y, d.z * radios.z).add(centro);
      const normal = new THREE.Vector3(d.x / radios.x, d.y / radios.y, d.z / radios.z).normalize();
      return { punto, normal };
    };
    const Z = new THREE.Vector3(0, 0, 1);

    this.ojos = [-1, 1].map((lado) => {
      const { punto, normal } = enSuperficie(0.42 * lado, 0.12, 0.9);
      const ojo = new THREE.Group();
      ojo.position.copy(punto).addScaledVector(normal, -0.012);
      ojo.quaternion.setFromUnitVectors(Z, normal);
      this.cabeza.add(ojo);

      const parpado = new THREE.Group();
      parpado.rotation.z = 0.28 * lado;
      ojo.add(parpado);
      this._parte(esfera, m.negro, parpado, { esc: [0.09, 0.112, 0.045], contorno: false });
      const iris = new THREE.Group();
      parpado.add(iris);
      this._parte(esfera, m.iris, iris, { pos: [0, 0, 0.022], esc: [0.072, 0.092, 0.03], contorno: false });
      this._parte(esfera, m.pupila, iris, { pos: [0, 0, 0.042], esc: [0.015, 0.062, 0.02], contorno: false });
      this._parte(esfera, m.brillo, iris, { pos: [0.024, 0.036, 0.052], esc: [0.019, 0.019, 0.012], contorno: false });
      this._parte(esfera, m.brillo, iris, { pos: [-0.02, -0.03, 0.05], esc: [0.008, 0.008, 0.006], contorno: false });

      // Trazo rojo en el rabillo del ojo, como en las máscaras de kitsune.
      this._parte(esfera, m.marca, ojo, {
        pos: [0.095 * lado, 0.04, 0.012],
        esc: [0.075, 0.013, 0.012],
        rot: [0, 0, 0.5 * lado],
        contorno: false,
      });
      return { parpado, iris };
    });

    const frente = enSuperficie(0, 0.55, 0.83);
    this.marcaFrente = new THREE.Group();
    this.marcaFrente.position.copy(frente.punto).addScaledVector(frente.normal, -0.006);
    this.marcaFrente.quaternion.setFromUnitVectors(Z, frente.normal);
    this.cabeza.add(this.marcaFrente);
    this._parte(esfera, m.marca, this.marcaFrente, { esc: [0.036, 0.085, 0.016], contorno: false });
    for (const lado of [-1, 1]) {
      this._parte(esfera, m.marca, this.marcaFrente, {
        pos: [0.055 * lado, -0.03, -0.004],
        esc: [0.018, 0.05, 0.012],
        rot: [0, 0, 0.45 * lado],
        contorno: false,
      });
    }

    const conoOreja = new THREE.ConeGeometry(0.15, 0.44, 24);
    const conoInterior = new THREE.ConeGeometry(0.1, 0.3, 20);
    const conoPunta = new THREE.ConeGeometry(0.054, 0.15, 20);
    this.orejas = [-1, 1].map((lado) => {
      const pivote = new THREE.Group();
      pivote.position.set(0.2 * lado, 0.5, -0.04);
      this.cabeza.add(pivote);
      this._parte(conoOreja, m.pelaje, pivote, { pos: [0, 0.22, 0], esc: [1, 1, 0.5] });
      this._parte(conoInterior, m.orejaInterior, pivote, { pos: [0, 0.16, 0.035], esc: [1, 1, 0.35], contorno: false });
      this._parte(conoPunta, m.negro, pivote, { pos: [0, 0.365, 0], esc: [1.04, 1, 0.53], contorno: false });
      return { pivote, lado };
    });
  }

  // ---------- Bucle ----------

  _ajustarTamano() {
    const { clientWidth: ancho, clientHeight: alto } = this.contenedor;
    if (!ancho || !alto) return;
    this.renderer.setSize(ancho, alto, false);
    this.camara.aspect = ancho / alto;
    // En marcos estrechos se aleja la cámara para que el abanico de colas quepa.
    const distancia = 8.4 * Math.max(1, 0.82 / this.camara.aspect);
    this.camara.position.set(0, 2.0, distancia);
    this.camara.lookAt(0, 1.2, 0);
    this.camara.updateProjectionMatrix();
    this.renderer.getDrawingBufferSize(this.resolucion);
  }

  _bucle() {
    this._frame = requestAnimationFrame(this._bucle);
    const dt = Math.min(this._reloj.getDelta(), 1 / 20);
    this.actualizar(dt);
    this.renderer.render(this.escena, this.camara);
  }

  actualizar(dt) {
    this.t += dt;
    const t = this.t;
    const obj = OBJETIVOS[this.estado];
    for (const clave in obj) {
      const vel = clave === 'orejas' ? 9 : clave === 'apertura' ? 10 : 5;
      this.p[clave] = amortiguar(this.p[clave], obj[clave], vel, dt);
    }
    const p = this.p;
    const reducido = this.opciones.movimientoReducido ? 0.35 : 1;

    const o = this._superposicionAccion(dt, reducido);
    // Relojes acumulados: si cambia la velocidad, la fase sigue siendo continua.
    this.relojOnda += dt * p.ondaVel * o.ondaVel;
    this.relojRespiracion += dt * Math.PI * 2 * (0.3 * p.respiracion + 0.05);
    const micro = this._microgestos(dt, o);
    this._actualizarMirada(dt);

    // Visibilidad global
    const escala = o.escala ?? (this.visible ? 1 : 0);
    this.raiz.scale.setScalar(Math.max(escala, 0.0001));
    this.raiz.visible = escala > 0.002;

    // Cuerpo: salto, squash & stretch, respiración, encogido al dormir
    this.cuerpo.position.y = o.saltoY;
    const encogido = 1 - 0.06 * p.agachado;
    this.cuerpo.scale.set(o.sx, o.sy * encogido, o.sx);
    const respiracion = Math.sin(this.relojRespiracion);
    const ampRespiracion = 0.012 + 0.016 * p.agachado;
    this.torso.scale.y = 0.68 * (1 + ampRespiracion * respiracion);
    this.pecho.scale.y = 0.5 * (1 + ampRespiracion * respiracion);
    this.torso.rotation.x = 0.18 + 0.12 * p.agachado;
    this.cuerpo.rotation.z = 0.015 * Math.sin(t * 0.7) * reducido;

    // Cabeza
    const habla = p.habla * Math.max(0, Math.sin(t * 13.7) * 0.6 + Math.sin(t * 7.9 + 1.3) * 0.4) * (Math.sin(t * 1.9) > -0.55 ? 1 : 0.15);
    this.cabeza.position.set(0, 1.44 - 0.12 * p.agachado + respiracion * 0.008, 0.1 + 0.05 * p.agachado);
    this.cabeza.rotation.set(
      p.cabeceo + o.cabeceo + this.mirada.y * -0.28 + p.habla * 0.04 * Math.sin(t * 6.8),
      this.mirada.x * 0.55,
      p.inclinacion + o.inclinacion + 0.03 * Math.sin(t * 0.5) * reducido,
    );
    this.mandibula.rotation.x = clamp01(habla * 0.9 + o.boca) * 0.45;

    const apertura = Math.max(0.06, Math.min(1.2, p.apertura * o.apertura * micro.parpadeo));
    for (const ojo of this.ojos) {
      ojo.parpado.scale.set(1 + 0.04 * (p.apertura - 1), apertura, 1);
      ojo.iris.position.set(
        (p.miradaX + this.mirada.x * 0.6) * 0.016,
        (p.miradaY + this.mirada.y * 0.6) * 0.02,
        0,
      );
    }
    const pulsoMarca = 1 + 0.08 * p.remolino * Math.sin(t * 5);
    this.marcaFrente.scale.setScalar(pulsoMarca);

    const orejas = Math.max(-1.2, Math.min(1.4, p.orejas + o.orejas));
    for (const oreja of this.orejas) {
      const alerta = Math.max(0, orejas);
      const caida = Math.max(0, -orejas);
      const tic = micro.tic * (oreja.lado === this.tic.lado ? 1 : 0);
      oreja.pivote.rotation.set(
        -0.12 + 0.2 * alerta - 0.55 * caida,
        0,
        -oreja.lado * (0.3 - 0.1 * alerta + 0.28 * caida) + tic * oreja.lado,
      );
    }

    // Patas: el saludo levanta la derecha del zorro y agita la zarpa
    const [, derecha] = this.patas;
    derecha.hombro.rotation.x = -1.25 * o.pata + o.ondaPata * 0.16;
    derecha.antebrazo.rotation.x = 0.85 * o.pata + o.ondaPata * 0.35;
    this.cascabel.rotation.x = o.cascabel + 0.05 * Math.sin(t * 2.3) * reducido;

    // Colas
    const pc = {
      ...p,
      abanico: p.abanico + o.abanico,
      ondaAmp: p.ondaAmp * reducido,
      remolino: p.remolino * reducido,
    };
    this.colas.forEach((cola, i) => {
      const despliegue = o.despliegue ? o.despliegue[i] : this.visible ? 1 : 0;
      cola.actualizar(this.relojOnda, t, pc, despliegue);
    });

    // Sombra en el suelo: se encoge y aclara al saltar
    const altura = clamp01(o.saltoY / 0.6);
    this.sombra.scale.setScalar(1 - 0.35 * altura);
    this.mat.sombra.opacity = 1 - 0.5 * altura;

    // Anillo de invocación
    this.anillo.visible = o.anillo > 0;
    if (o.anillo > 0) {
      const progreso = o.anillo;
      this.anillo.scale.setScalar(0.4 + 1.8 * easeOutCubic(progreso));
      this.mat.anillo.opacity = 0.85 * (1 - progreso);
    }

    // Fuegos fatuos
    const visFuegos = (this.opciones.fuegos ? 1 : 0) * (o.fuegoVis ?? (this.visible ? 1 : 0));
    this.fuegos.actualizar(dt, t, {
      brillo: p.brillo,
      velocidad: p.velFuego * o.velFuego * (this.opciones.movimientoReducido ? 0.5 : 1),
      radio: o.radioFuego ?? 1.3,
      visibilidad: visFuegos,
      centroY: 1.15 + o.saltoY * 0.5,
    });

    this._actualizarZetas(dt);
  }

  // Devuelve los ajustes que la acción en curso suma (o impone) sobre el estado.
  _superposicionAccion(dt, reducido) {
    const o = {
      escala: null,
      saltoY: 0,
      sx: 1,
      sy: 1,
      despliegue: null,
      abanico: 0,
      apertura: 1,
      orejas: 0,
      inclinacion: 0,
      cabeceo: 0,
      boca: 0,
      pata: 0,
      ondaPata: 0,
      ondaVel: 1,
      cascabel: 0,
      anillo: 0,
      radioFuego: null,
      fuegoVis: null,
      velFuego: 1,
    };
    const a = this.accion;
    if (!a) return o;

    a.t += dt;
    const u = a.t;

    if (a.nombre === 'aparecer') {
      o.escala = u < 0.38 ? 0 : easeOutBack(tramo(u, 0.38, 0.95), 2.0);
      o.despliegue = this.colas.map((_, i) => {
        const inicio = 0.6 + Math.abs(i - 4) * 0.07;
        return easeOutCubic(tramo(u, inicio, inicio + 0.5));
      });
      o.radioFuego = lerp(2.9, 1.3, easeInOutCubic(tramo(u, 0, 0.65)));
      o.fuegoVis = tramo(u, 0, 0.25);
      o.velFuego = lerp(5, 1, tramo(u, 0, 0.8));
      o.anillo = u > 0.36 && u < 0.95 ? tramo(u, 0.36, 0.95) : 0;
      o.orejas = u < 0.9 ? -1 * (1 - tramo(u, 0.55, 0.9)) : 0.8 * campana(tramo(u, 0.9, 1.4));
      o.apertura = tramo(u, 0.85, 1.0);
    } else if (a.nombre === 'desaparecer') {
      o.despliegue = this.colas.map((_, i) => {
        const inicio = (4 - Math.abs(i - 4)) * 0.05;
        return 1 - easeInCubic(tramo(u, inicio, inicio + 0.35));
      });
      const anticipo = campana(tramo(u, 0.28, 0.46));
      o.sy = 1 - 0.12 * anticipo * reducido;
      o.sx = 1 + 0.08 * anticipo * reducido;
      o.escala = Math.max(0, 1 - easeInBack(tramo(u, 0.42, 0.88), 1.6));
      o.radioFuego = lerp(1.3, 3.1, easeOutCubic(tramo(u, 0.4, 0.95)));
      o.fuegoVis = 1 - tramo(u, 0.55, 0.95);
      o.velFuego = lerp(1, 4, tramo(u, 0.3, 0.9));
      o.anillo = u > 0.5 && u < 0.95 ? tramo(u, 0.5, 0.95) : 0;
      o.apertura = 1 - tramo(u, 0.2, 0.35);
      o.orejas = -0.8 * tramo(u, 0.1, 0.4);
    } else if (a.nombre === 'saludar') {
      const sube = easeOutCubic(tramo(u, 0, 0.3));
      const baja = easeInOutCubic(tramo(u, 1.45, 1.9));
      o.pata = sube * (1 - baja);
      o.ondaPata = u > 0.3 && u < 1.45 ? Math.sin((u - 0.3) * Math.PI * 2 * 2.4) * o.pata : 0;
      o.inclinacion = 0.22 * o.pata;
      o.orejas = 0.6 * o.pata;
      o.ondaVel = 1 + 1.2 * o.pata;
      o.abanico = 0.1 * o.pata;
      o.boca = 0.2 * o.pata;
      o.apertura = 1 - 0.4 * o.pata;
    } else if (a.nombre === 'alegria') {
      const preparacion = tramo(u, 0, 0.16);
      const sube = tramo(u, 0.16, 0.5);
      const cae = tramo(u, 0.5, 0.78);
      const aterriza = tramo(u, 0.78, 1.05);
      let estiramiento;
      if (u < 0.16) {
        estiramiento = -0.15 * easeOutCubic(preparacion);
        o.saltoY = 0;
      } else if (u < 0.5) {
        estiramiento = sube < 0.15 ? lerp(-0.15, 0.12, sube / 0.15) : 0.12 * (1 - (sube - 0.15) / 0.85);
        o.saltoY = 0.55 * easeOutCubic(sube);
      } else if (u < 0.78) {
        estiramiento = 0.08 * cae;
        o.saltoY = 0.55 * (1 - easeInCubic(cae));
      } else {
        estiramiento = -0.14 * campana(aterriza);
        o.saltoY = 0;
      }
      o.saltoY *= reducido;
      o.sy = 1 + estiramiento * reducido;
      o.sx = 1 - estiramiento * 0.5 * reducido;
      const aire = campana(tramo(u, 0.1, 0.95));
      o.abanico = 0.35 * aire;
      o.ondaVel = 1 + aire;
      o.apertura = 1 - 0.62 * aire;
      o.boca = 0.32 * aire;
      o.orejas = 0.8 * aire;
      o.cascabel = 0.6 * Math.sin(u * Math.PI * 2 * 3) * (1 - clamp01(u / 1.15));
    }

    if (a.t >= a.dur) this._cerrarAccion();
    return o;
  }

  _cerrarAccion() {
    const a = this.accion;
    if (!a) return;
    if (a.nombre === 'desaparecer') this.visible = false;
    if (a.nombre === 'aparecer') this.visible = true;
    this.accion = null;
    a.resolver();
    this._emitir('accion-fin', a.nombre);
  }

  _microgestos(dt, o) {
    const r = { parpadeo: 1, tic: 0 };
    const dormido = this.p.apertura < 0.25;

    const b = this.parpadeo;
    if (b.t < 0) {
      b.espera -= dt;
      if (b.espera <= 0 && !dormido) {
        b.t = 0;
        b.doble = Math.random() < 0.2;
      }
    } else {
      b.t += dt;
      const fin = b.doble ? 0.36 : 0.16;
      const fase = b.t < 0.16 ? b.t / 0.16 : b.doble && b.t > 0.2 ? (b.t - 0.2) / 0.16 : 0;
      r.parpadeo = 1 - 0.94 * campana(fase);
      if (b.t >= fin) {
        b.t = -1;
        b.espera = 2.2 + Math.random() * 4;
      }
    }

    const e = this.tic;
    if (e.t < 0) {
      e.espera -= dt;
      if (e.espera <= 0 && !dormido && !this.accion) {
        e.t = 0;
        e.lado = Math.random() < 0.5 ? -1 : 1;
      }
    } else {
      e.t += dt;
      r.tic = 0.35 * campana(e.t / 0.28);
      if (e.t >= 0.28) {
        e.t = -1;
        e.espera = 3.5 + Math.random() * 5;
      }
    }
    return r;
  }

  _actualizarMirada(dt) {
    const m = this.mirada;
    let x = m.objetivoX;
    let y = m.objetivoY;
    const quieto = this.t - m.ultimoMovimiento > 4;
    if (!this.opciones.seguirCursor || quieto || this.estado === 'dormir' || this.estado === 'pensar') {
      // Sin cursor: deriva lenta para que nunca parezca congelado.
      x = 0.18 * Math.sin(this.t * 0.37) + 0.1 * Math.sin(this.t * 0.83);
      y = 0.08 * Math.sin(this.t * 0.51);
      if (this.estado === 'dormir' || this.estado === 'pensar') {
        x *= 0.3;
        y *= 0.3;
      }
    }
    m.x = amortiguar(m.x, x, 4, dt);
    m.y = amortiguar(m.y, y, 4, dt);
  }

  _alMoverPuntero(evento) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width) return;
    const cabeza = new THREE.Vector3();
    this.cabeza.getWorldPosition(cabeza);
    cabeza.y += 0.2 * this.raiz.scale.y;
    cabeza.project(this.camara);
    const cx = rect.left + ((cabeza.x + 1) / 2) * rect.width;
    const cy = rect.top + ((1 - cabeza.y) / 2) * rect.height;
    const escalaPx = Math.max(240, rect.height * 0.9);
    // La cabeza ya mira 0.32 rad a la derecha por el giro del cuerpo: se compensa.
    this.mirada.objetivoX = Math.max(-0.75, Math.min(0.55, (evento.clientX - cx) / escalaPx - 0.15));
    this.mirada.objetivoY = Math.max(-0.5, Math.min(0.5, -(evento.clientY - cy) / escalaPx));
    this.mirada.ultimoMovimiento = this.t;

    if (this.visible && evento.target === this.renderer.domElement) {
      this.renderer.domElement.style.cursor = this._tocaKitsune(evento) ? 'pointer' : '';
    }
  }

  _tocaKitsune(evento) {
    const rect = this.renderer.domElement.getBoundingClientRect();
    this._puntero.set(
      ((evento.clientX - rect.left) / rect.width) * 2 - 1,
      -((evento.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this._raycaster.setFromCamera(this._puntero, this.camara);
    return this._raycaster.intersectObjects(this._mallasCuerpo, false).length > 0;
  }

  _alPulsar(evento) {
    if (this.visible && this._tocaKitsune(evento)) this._emitir('toque');
  }

  _actualizarZetas(dt) {
    const z = this.zetas;
    if (this.estado === 'dormir' && this.visible && !this.accion) {
      z.espera -= dt;
      if (z.espera <= 0) {
        const libre = this.zetas3d.find((s) => !s.visible);
        if (libre) {
          const origen = new THREE.Vector3();
          this.cabeza.getWorldPosition(origen);
          libre.visible = true;
          libre.userData = { vida: 0, origen: origen.add(new THREE.Vector3(0.35, 0.45, 0.2)) };
        }
        z.espera = 1.4;
      }
    }
    for (const s of this.zetas3d) {
      if (!s.visible) continue;
      s.userData.vida += dt;
      const v = s.userData.vida / 2.6;
      if (v >= 1) {
        s.visible = false;
        continue;
      }
      s.position.copy(s.userData.origen).add(new THREE.Vector3(0.25 * Math.sin(v * 5), 0.9 * v, 0));
      s.scale.setScalar(0.16 + 0.22 * v);
      s.material.opacity = campana(v) * 0.9;
    }
  }

  _emitir(evento, dato) {
    for (const fn of this._oyentes[evento] || []) fn(dato);
  }
}
