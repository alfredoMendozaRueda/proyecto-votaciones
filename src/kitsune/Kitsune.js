import * as THREE from 'three';
import { PALETAS, PALETA_POR_DEFECTO } from './paletas.js';
import { Cola } from './cola.js';
import { FuegosFatuos } from './fuegos.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { construirZorro } from './anatomia.js';
import { crearMaterialesPelaje } from './pelaje.js';
import { colorearOjo } from './ojo.js';
import { ESTILOS, crearMaterialDibujo, crearMaterialContorno, crearColoretes } from './estilos.js';
import { GestorCalidad, indiceNivel } from './rendimiento.js';
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
export const ACCIONES = ['aparecer', 'saludar', 'alegria', 'desaparecer', 'caricia', 'bostezo', 'curiosear', 'sacudir'];
// Gestos que hace solo, de vez en cuando, si está en reposo.
const GESTOS_OCIO = ['bostezo', 'curiosear', 'sacudir'];

const NUM_COLAS = 9;
const DESVIO_ZETA = new THREE.Vector3(0.35, 0.45, 0.2);

const REPOSO = {
  orejas: 0,
  inclinacion: 0,
  cabeceo: 0,
  apertura: 0.9,
  dilatacion: 0.25,
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
    dilatacion: 0.55,
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
    dilatacion: 0.12,
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

const DURACIONES = {
  aparecer: 1.6,
  saludar: 1.9,
  alegria: 1.15,
  desaparecer: 0.95,
  caricia: 2.0,
  bostezo: 2.6,
  curiosear: 2.8,
  sacudir: 1.5,
};
// Una caricia que sigue alarga el gesto, hasta este máximo.
const CARICIA_MAX = 5;
// Píxeles de arrastre sobre el zorro para que cuente como caricia y no como toque.
const UMBRAL_CARICIA = 70;

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

function texturaCorazon(color) {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 64;
  const g = lienzo.getContext('2d');
  g.fillStyle = color;
  g.shadowColor = color;
  g.shadowBlur = 8;
  g.beginPath();
  g.moveTo(32, 52);
  g.bezierCurveTo(8, 36, 10, 14, 24, 14);
  g.bezierCurveTo(29, 14, 32, 18, 32, 22);
  g.bezierCurveTo(32, 18, 35, 14, 40, 14);
  g.bezierCurveTo(54, 14, 56, 36, 32, 52);
  g.fill();
  const tex = new THREE.CanvasTexture(lienzo);
  tex.colorSpace = THREE.SRGBColorSpace;
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
      // >1 acerca la cámara: en la app el zorro llena más su hueco.
      zoom: 1,
      estilo: 'realista',
      ...opciones,
    };
    this.contenedor = contenedor;
    this._oyentes = {};

    const tactil = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
    this._ligero = tactil || (navigator.deviceMemory ?? 8) <= 4;
    // En móvil la pantalla ya es muy densa: por encima de 1.5 no se nota y cuesta mucho.
    this._densidadBase = Math.min(window.devicePixelRatio || 1, this._ligero ? 1.5 : 2);

    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(this._densidadBase);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    contenedor.appendChild(this.renderer.domElement);

    this.escena = new THREE.Scene();
    this.camara = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
    this.camara.position.set(0, 2.0, 8.4);
    this.camara.lookAt(0, 1.2, 0);

    // Luz de estudio suave para reflejos realistas en ojos y trufa.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.escena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.escena.environmentIntensity = 0.45;
    pmrem.dispose();

    this.escena.add(new THREE.HemisphereLight('#ffe8dc', '#2a0f12', 0.5));
    const clave = new THREE.DirectionalLight('#fff1e2', 2.6);
    clave.position.set(2.5, 5, 5);
    clave.castShadow = true;
    clave.shadow.mapSize.set(1024, 1024);
    this._luzClave = clave;
    Object.assign(clave.shadow.camera, { left: -2.5, right: 2.5, top: 3, bottom: -1, near: 1, far: 15 });
    clave.shadow.normalBias = 0.02;
    const relleno = new THREE.DirectionalLight('#9fb4ff', 0.35);
    relleno.position.set(-4, 1.5, 3);
    this.luzContra = new THREE.DirectionalLight('#ff5a38', 2.2);
    this.luzContra.position.set(-3, 3, -4.5);
    this.escena.add(clave, relleno, this.luzContra);

    this._construir();

    this.fuegos = new FuegosFatuos(this.escena);
    this.setPaleta(this.opciones.paleta);
    this.setEstilo(this.opciones.estilo);

    this.gestorCalidad = new GestorCalidad({
      inicial: this._ligero ? indiceNivel('media') : 0,
      aplicar: (nivel) => this._aplicarNivel(nivel),
    });

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
    this.corazones = { espera: 0 };
    // La boca sigue al texto: cada trozo que llega le da "energía" que se va apagando.
    this.voz = { energia: 0, ultimo: -10 };
    // Versión bebé (0 a 1): cabeza grande, cuerpo y colas pequeños. Se mueve hacia el objetivo con suavidad.
    this.bebe = { valor: 0, objetivo: 0 };
    this.ocio = { espera: 14 + Math.random() * 10 };
    this._caricia = null;
    // Objetos reutilizados en cada fotograma (sin basura para el recolector).
    this._pc = {};
    this._o = {};
    this._micro = { parpadeo: 1, tic: 0 };
    this._vTmp = new THREE.Vector3();
    this._despliegue = new Array(NUM_COLAS).fill(0);

    this._raycaster = new THREE.Raycaster();
    this._puntero = new THREE.Vector2();
    this._alMoverPuntero = this._alMoverPuntero.bind(this);
    this._alPulsar = this._alPulsar.bind(this);
    this._alSoltar = this._alSoltar.bind(this);
    window.addEventListener('pointermove', this._alMoverPuntero);
    window.addEventListener('pointerup', this._alSoltar);
    window.addEventListener('pointercancel', this._alSoltar);
    this.renderer.domElement.addEventListener('pointerdown', this._alPulsar);
    // Arrastrar el dedo sobre el zorro es acariciarlo, no desplazar la página.
    this.renderer.domElement.style.touchAction = 'none';

    this._observador = new ResizeObserver(() => this._ajustarTamano());
    this._observador.observe(contenedor);
    this._ajustarTamano();

    // Si el lienzo no se ve (pestaña oculta, fuera de pantalla), no se dibuja.
    this._enPantalla = true;
    this._visor = new IntersectionObserver(([entrada]) => {
      this._enPantalla = entrada.isIntersecting;
    });
    this._visor.observe(contenedor);

    this._ultimoPintado = 0;
    this._pendientePintar = true;
    this._bucle = this._bucle.bind(this);
    this._frame = requestAnimationFrame(this._bucle);
  }

  get calidad() {
    return { nivel: this.gestorCalidad.nivel.nombre, automatica: this.gestorCalidad.automatico, fps: this._fpsObjetivo() };
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

  // Llega texto de la respuesta (o una palabra de la voz): mueve la boca en proporción.
  pulsoHabla(caracteres = 4) {
    this.voz.energia = Math.min(1.25, this.voz.energia + 0.22 + Math.min(caracteres, 40) * 0.02);
    this.voz.ultimo = this.t;
  }

  setPaleta(nombre) {
    const pal = PALETAS[nombre];
    if (!pal) return;
    this.paleta = nombre;
    const colores = Object.fromEntries(
      Object.entries(pal)
        .filter(([, v]) => typeof v === 'string' && v.startsWith('#'))
        .map(([k, v]) => [k, new THREE.Color(v)]),
    );
    this.zorro.repintar(colores);
    for (const cola of this.colas) cola.setColores(pal);
    for (const ojo of this.zorro.ojos) colorearOjo(ojo, pal);
    this.zorro.marca.uniforms.uColor.value.set(pal.marca);
    const sueltos = this.zorro.materialesSueltos;
    sueltos.nariz.color.set(pal.nariz);
    sueltos.boca.color.set(pal.bocaInterior);
    sueltos.bigotes.color.set(pal.bigotes);
    this.mat.anillo.color.set(pal.fuego);
    this.luzContra.color.set(pal.luzContra);
    this.fuegos.setColores(pal.fuego, pal.fuegoNucleo);
    this._texturaZ?.dispose();
    this._texturaZ = texturaZ(pal.fuegoNucleo);
    for (const s of this.zetas3d) {
      s.material.map = this._texturaZ;
      s.material.needsUpdate = true;
    }
    this._texturaCorazon?.dispose();
    this._texturaCorazon = texturaCorazon(pal.fuego);
    for (const s of this.corazones3d) {
      s.material.map = this._texturaCorazon;
      s.material.needsUpdate = true;
    }
    this._emitir('paleta', nombre);
  }

  // Estilo de dibujo: realista, anime, kawaii o tinta (ver estilos.js).
  setEstilo(nombre) {
    const estilo = ESTILOS[nombre] ?? ESTILOS.realista;
    this.estilo = ESTILOS[nombre] ? nombre : 'realista';
    this._estilo = estilo;
    this._materialesEstilo ??= {};
    const cache = (this._materialesEstilo[this.estilo] ??= {
      dibujo: estilo.toon ? crearMaterialDibujo(estilo.toon) : null,
      contorno: estilo.contorno ? crearMaterialContorno(estilo.contorno) : null,
    });
    for (const malla of this._mallasCuerpo) {
      malla.userData.materialReal ??= malla.material;
      malla.material = cache.dibujo ?? malla.userData.materialReal;
      for (const hijo of malla.children) if (hijo.isInstancedMesh) hijo.visible = estilo.pelo;
      if (cache.contorno && !malla.userData.contorno) {
        // El contorno comparte geometría: en las colas se mueve con ellas.
        const contorno = new THREE.Mesh(malla.geometry, cache.contorno);
        contorno.frustumCulled = false;
        malla.add(contorno);
        malla.userData.contorno = contorno;
      }
      if (malla.userData.contorno) {
        malla.userData.contorno.visible = Boolean(cache.contorno);
        if (cache.contorno) malla.userData.contorno.material = cache.contorno;
      }
    }
    this.coloretes.visible = Boolean(estilo.coloretes);
    this.zorro.materialesSueltos.bigotes.opacity = estilo.bigotes;
    this._pendientePintar = true;
    this._emitir('estilo', this.estilo);
  }

  // En pequeño (en la esquina del móvil) el zorro pasa a ser una cría.
  setBebe(activo) {
    this.bebe.objetivo = activo ? 1 : 0;
    if (this.opciones.movimientoReducido) this.bebe.valor = this.bebe.objetivo;
  }

  setOpcion(clave, valor) {
    this.opciones[clave] = valor;
  }

  // 'auto' deja que el gestor ajuste la calidad; 'alta', 'media' o 'baja' la fijan.
  setCalidad(nivel) {
    this.gestorCalidad.fijar(nivel);
  }

  _aplicarNivel(nivel) {
    this.renderer.setPixelRatio(this._densidadBase * nivel.resolucion);
    this._ajustarTamano();
    this._aplicarFraccionPelo(nivel.pelo);
    const luz = this._luzClave;
    const conSombras = nivel.sombras > 0;
    if (conSombras && luz.shadow.mapSize.x !== nivel.sombras) {
      luz.shadow.map?.dispose();
      luz.shadow.map = null;
      luz.shadow.mapSize.set(nivel.sombras, nivel.sombras);
    }
    luz.castShadow = conSombras;
    this._pendientePintar = true;
  }

  // Menos capas de pelo = menos trabajo para la tarjeta gráfica.
  _aplicarFraccionPelo(fraccion) {
    for (const materiales of [this.mat.cuerpo, this.mat.colas]) {
      const capas = Math.max(3, Math.round(materiales.capas * fraccion));
      materiales.uniforms.uCapas.value = capas;
      this.raiz.traverse((o) => {
        if (o.isInstancedMesh && o.material === materiales.pelo) o.count = capas;
      });
    }
  }

  // ¿Hay zorro bajo este punto de la pantalla? (coordenadas de cliente)
  tocaEn(x, y) {
    return this.visible && this._tocaKitsune({ clientX: x, clientY: y });
  }

  destruir() {
    cancelAnimationFrame(this._frame);
    this._observador.disconnect();
    this._visor.disconnect();
    window.removeEventListener('pointermove', this._alMoverPuntero);
    window.removeEventListener('pointerup', this._alSoltar);
    window.removeEventListener('pointercancel', this._alSoltar);
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }

  // ---------- Construcción ----------

  _construir() {
    this.mat = {
      cuerpo: crearMaterialesPelaje({ largo: 0.028, capas: 12, densidad: 110 }),
      colas: crearMaterialesPelaje({ largo: 0.07, capas: 14, densidad: 75, gravedad: 0.3 }),
      anillo: new THREE.MeshBasicMaterial({
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        opacity: 0,
      }),
      sombra: new THREE.MeshBasicMaterial({
        map: texturaRadial('rgba(10,4,6,0.45)', 'rgba(10,4,6,0)'),
        transparent: true,
        depthWrite: false,
      }),
    };

    this.zorro = construirZorro(this.mat.cuerpo);
    const z = this.zorro;
    this.raiz = z.raiz;
    this.raiz.rotation.y = 0.32;
    this.escena.add(this.raiz);
    Object.assign(this, {
      cuerpo: z.cuerpo,
      pecho: z.pecho,
      cabeza: z.cabeza,
      mandibula: z.mandibula,
      boca: z.boca,
      orejas: z.orejas,
      patas: z.patas,
      colasBase: z.colasBase,
    });

    const suelo = new THREE.Mesh(new THREE.PlaneGeometry(5, 5), new THREE.ShadowMaterial({ opacity: 0.32 }));
    suelo.rotation.x = -Math.PI / 2;
    suelo.position.y = 0.001;
    suelo.receiveShadow = true;
    this.raiz.add(suelo);

    this.sombra = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 1.2), this.mat.sombra);
    this.sombra.rotation.x = -Math.PI / 2;
    this.sombra.position.set(0, 0.002, -0.05);
    this.raiz.add(this.sombra);

    this.anillo = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 72), this.mat.anillo);
    this.anillo.rotation.x = -Math.PI / 2;
    this.anillo.position.y = 0.01;
    this.escena.add(this.anillo);

    this.colas = Array.from({ length: NUM_COLAS }, (_, i) => {
      const cola = new Cola(i, NUM_COLAS, this.mat.colas);
      this.colasBase.add(cola.malla);
      return cola;
    });

    const particulas = (cantidad) =>
      Array.from({ length: cantidad }, () => {
        const s = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false }));
        s.visible = false;
        s.userData = { vida: 0, origen: new THREE.Vector3(), fase: 0 };
        this.escena.add(s);
        return s;
      });
    this.zetas3d = particulas(3);
    this.corazones3d = particulas(5);

    this._mallasCuerpo = [...z.mallas, ...this.colas.map((c) => c.malla)];

    this.coloretes = crearColoretes();
    this.cabeza.add(this.coloretes);
  }

  // ---------- Bucle ----------

  _ajustarTamano() {
    const { clientWidth: ancho, clientHeight: alto } = this.contenedor;
    if (!ancho || !alto) return;
    this.renderer.setSize(ancho, alto, false);
    this.camara.aspect = ancho / alto;
    // En marcos estrechos se aleja la cámara para que el abanico de colas quepa.
    const distancia = (8.4 * Math.max(1, 0.82 / this.camara.aspect)) / this.opciones.zoom;
    this.camara.position.set(0, 2.0, distancia);
    this.camara.lookAt(0, 1.2, 0);
    this.camara.updateProjectionMatrix();
  }

  // Ritmo según lo que esté haciendo: a tope cuando hay acción o conversación,
  // más tranquilo en reposo y dormido, y nada si no se ve.
  _fpsObjetivo() {
    if (!this._enPantalla || document.hidden) return 0;
    if (!this.visible && !this.accion) return this._pendientePintar ? 30 : 0;
    if (this.accion || this.estado === 'hablar' || this.estado === 'pensar' || this.estado === 'escuchar') return 60;
    if (Math.abs(this.bebe.objetivo - this.bebe.valor) > 0.01) return 60;
    if (this.estado === 'dormir') return 20;
    if (this.opciones.movimientoReducido) return 30;
    return this.t - this.mirada.ultimoMovimiento < 1.5 ? 60 : 30;
  }

  _bucle(ahora) {
    this._frame = requestAnimationFrame(this._bucle);
    const fps = this._fpsObjetivo();
    if (fps === 0) {
      this._ultimoPintado = 0;
      return;
    }
    const objetivo = 1000 / fps;
    const transcurrido = this._ultimoPintado ? ahora - this._ultimoPintado : objetivo;
    if (transcurrido < objetivo - 3) return;
    // Solo mide fotogramas consecutivos (las pausas reinician _ultimoPintado).
    if (this._ultimoPintado) this.gestorCalidad.registrar(transcurrido / objetivo, transcurrido);
    this._ultimoPintado = ahora;
    this.actualizar(Math.min(transcurrido / 1000, 1 / 20));
    this.renderer.render(this.escena, this.camara);
    if (!this.visible && !this.accion) this._pendientePintar = false;
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
    // Un animal real apenas se deforma: el squash & stretch se queda a la mitad.
    const sx = 1 + (o.sx - 1) * 0.5;
    const sy = 1 + (o.sy - 1) * 0.5;
    this.cuerpo.scale.set(sx, sy * encogido, sx);
    const respiracion = Math.sin(this.relojRespiracion);
    const ampRespiracion = 0.014 + 0.016 * p.agachado;
    this.pecho.scale.set(
      1 + ampRespiracion * respiracion * 0.7,
      1 + ampRespiracion * respiracion * 0.3,
      1 + ampRespiracion * respiracion,
    );
    this.pecho.rotation.x = 0.1 * p.agachado;
    // Cría: el pecho y las colas encogen y la cabeza (con sus ojos) crece.
    this.bebe.valor += (this.bebe.objetivo - this.bebe.valor) * Math.min(1, dt * 5);
    // Cría al encogerse en la esquina, o siempre en el estilo kawaii.
    const bebe = Math.max(this.bebe.valor, this._estilo.bebe);
    this.pecho.scale.multiplyScalar(1 - 0.12 * bebe);
    this.colasBase.scale.setScalar(1 - 0.3 * bebe);
    this.cuerpo.rotation.z = 0.015 * Math.sin(t * 0.7) * reducido;

    // Cabeza
    const habla = this._habla(dt, p.habla);
    this.cabeza.position.set(0, 1.37 - 0.12 * p.agachado + respiracion * 0.006 + 0.05 * bebe, 0.17 + 0.05 * p.agachado);
    this.cabeza.scale.setScalar(1 + 0.42 * bebe);
    this.cabeza.rotation.set(
      p.cabeceo + o.cabeceo + this.mirada.y * -0.28 + p.habla * 0.04 * Math.sin(t * 6.8) - 0.05 * habla,
      this.mirada.x * 0.55 + o.giro,
      p.inclinacion + o.inclinacion + 0.03 * Math.sin(t * 0.5) * reducido,
    );
    // Hasta 1 al hablar; el bostezo la abre más.
    const abertura = Math.min(1.7, Math.max(0, habla * 0.9 + o.boca));
    this.mandibula.rotation.x = abertura * 0.45;
    // El interior de la boca crece con ella: si no, al abrirla se vería el hueco.
    this.boca.scale.y = 0.013 + 0.03 * abertura;
    this.boca.position.y = -0.03 - 0.03 * abertura;

    const apertura = Math.max(0, Math.min(1.25, p.apertura * o.apertura * micro.parpadeo * this._estilo.apertura));
    for (const ojo of this.zorro.ojos) {
      ojo.uniforms.uApertura.value = apertura;
      ojo.uniforms.uAlegria.value = clamp01(o.alegria);
      ojo.uniforms.uDilatacion.value = clamp01(p.dilatacion + 0.4 * o.alegria + this._estilo.dilatacion);
      ojo.uniforms.uMirada.value.set(
        Math.max(-1, Math.min(1, p.miradaX + this.mirada.x * 0.8 + o.giro * 0.7)),
        Math.max(-1, Math.min(1, p.miradaY + this.mirada.y * 0.8)),
      );
    }
    this.zorro.marca.uniforms.uBrillo.value = p.remolino * (0.5 + 0.5 * Math.sin(t * 5));

    const orejas = Math.max(-1.2, Math.min(1.4, p.orejas + o.orejas));
    for (const oreja of this.orejas) {
      const alerta = Math.max(0, orejas);
      const caida = Math.max(0, -orejas);
      const tic = micro.tic * (oreja.lado === this.tic.lado ? 1 : 0);
      oreja.pivote.rotation.set(
        -0.18 + 0.22 * alerta - 0.6 * caida,
        0,
        -oreja.lado * (0.24 - 0.1 * alerta + 0.3 * caida) + tic * oreja.lado,
      );
    }

    // Patas: el saludo levanta la derecha del zorro y agita la zarpa
    const [, derecha] = this.patas;
    derecha.hombro.rotation.x = -1.25 * o.pata + o.ondaPata * 0.16;
    derecha.antebrazo.rotation.x = 0.85 * o.pata + o.ondaPata * 0.35;

    // Colas
    const pc = Object.assign(this._pc, p);
    pc.abanico = p.abanico + o.abanico;
    pc.ondaAmp = p.ondaAmp * reducido;
    pc.remolino = p.remolino * reducido;
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
    this._actualizarCorazones(dt);
    this._gestosOcio(dt);
  }

  // Apertura de la boca al hablar. Si llega texto, sigue su ritmo (sílabas
  // sobre la energía que deja cada trozo); si no (voz sin marcas de palabra),
  // un balbuceo de respaldo para que nunca hable con la boca cerrada.
  _habla(dt, nivel) {
    const v = this.voz;
    v.energia *= Math.exp(-3.2 * dt);
    if (nivel < 0.01) return 0;
    const t = this.t;
    const silabas = 0.55 + 0.45 * Math.sin(t * 14.3) * Math.sin(t * 5.1 + 0.7);
    if (t - v.ultimo < 0.9) return nivel * clamp01(v.energia) * silabas;
    return nivel * Math.max(0, Math.sin(t * 13.7) * 0.6 + Math.sin(t * 7.9 + 1.3) * 0.4) * (Math.sin(t * 1.9) > -0.55 ? 1 : 0.15);
  }

  // De vez en cuando, en reposo, un gesto propio: bostezar (más de noche),
  // mirar alrededor o sacudir las colas. Así nunca parece una imagen en bucle.
  _gestosOcio(dt) {
    const g = this.ocio;
    if (this.estado !== 'reposo' || !this.visible || this.accion || this.opciones.movimientoReducido) return;
    g.espera -= dt;
    if (g.espera > 0) return;
    g.espera = 18 + Math.random() * 22;
    const hora = new Date().getHours();
    const noche = hora >= 22 || hora < 7;
    const r = Math.random();
    this.reproducir(r < (noche ? 0.5 : 0.18) ? 'bostezo' : r < (noche ? 0.75 : 0.62) ? 'curiosear' : 'sacudir');
  }

  _rellenarDespliegue(calcular) {
    for (let i = 0; i < NUM_COLAS; i++) this._despliegue[i] = calcular(i);
    return this._despliegue;
  }

  // Devuelve los ajustes que la acción en curso suma (o impone) sobre el estado.
  _superposicionAccion(dt, reducido) {
    const o = Object.assign(this._o, {
      escala: null,
      saltoY: 0,
      sx: 1,
      sy: 1,
      despliegue: null,
      abanico: 0,
      apertura: 1,
      alegria: 0,
      orejas: 0,
      inclinacion: 0,
      cabeceo: 0,
      boca: 0,
      giro: 0,
      pata: 0,
      ondaPata: 0,
      ondaVel: 1,
      anillo: 0,
      radioFuego: null,
      fuegoVis: null,
      velFuego: 1,
    });
    const a = this.accion;
    if (!a) return o;

    a.t += dt;
    const u = a.t;

    if (a.nombre === 'aparecer') {
      o.escala = u < 0.38 ? 0 : easeOutBack(tramo(u, 0.38, 0.95), 2.0);
      o.despliegue = this._rellenarDespliegue((i) => {
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
      o.despliegue = this._rellenarDespliegue((i) => {
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
      o.alegria = 0.9 * o.pata;
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
      o.alegria = Math.min(1, 1.6 * aire);
      o.boca = 0.32 * aire;
      o.orejas = 0.8 * aire;
    } else if (a.nombre === 'caricia') {
      // Cierra los ojos a gusto, echa las orejas atrás y se apoya en la mano.
      const k = easeOutCubic(tramo(u, 0, 0.35)) * (1 - easeInOutCubic(tramo(u, a.dur - 0.5, a.dur)));
      o.apertura = 1 - 0.78 * k;
      o.alegria = k;
      o.orejas = -0.6 * k;
      o.inclinacion = (0.2 + 0.06 * Math.sin(u * 4.2)) * k * reducido;
      o.cabeceo = 0.09 * k;
      o.ondaVel = 1 + 0.9 * k;
      o.abanico = 0.12 * k;
      o.boca = 0.1 * k;
      o.sy = 1 - 0.03 * k;
    } else if (a.nombre === 'bostezo') {
      const abre = campana(tramo(u, 0.15, 2.1));
      o.boca = 1.6 * abre;
      o.apertura = 1 - 0.92 * campana(tramo(u, 0.05, 2.3));
      // Poco hacia atrás: con la cabeza muy levantada la boca abierta no se ve desde la cámara.
      o.cabeceo = -0.07 * abre;
      o.orejas = -0.55 * abre;
      o.sy = 1 + 0.05 * abre * reducido;
      o.abanico = 0.1 * abre;
      o.ondaVel = 1 - 0.4 * abre;
    } else if (a.nombre === 'curiosear') {
      // Mira a un lado, luego al otro, con la cabeza ladeada, y vuelve.
      const giro =
        -0.45 * easeInOutCubic(tramo(u, 0, 0.45)) +
        0.8 * easeInOutCubic(tramo(u, 1.1, 1.65)) -
        0.35 * easeInOutCubic(tramo(u, 2.2, 2.8));
      o.giro = giro * reducido;
      o.inclinacion = 0.16 * campana(tramo(u, 0.3, 1.2)) - 0.14 * campana(tramo(u, 1.5, 2.4));
      o.orejas = 0.7 * campana(tramo(u, 0, 2.8));
    } else if (a.nombre === 'sacudir') {
      const fuerza = campana(tramo(u, 0, 1.5));
      o.ondaVel = 1 + 2.2 * fuerza;
      o.abanico = 0.3 * fuerza;
      o.inclinacion = 0.05 * Math.sin(u * 18) * fuerza * reducido;
      o.orejas = 0.3 * fuerza;
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
    const r = this._micro;
    r.parpadeo = 1;
    r.tic = 0;
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
    if (this._caricia) this._seguirCaricia(evento);
    const rect = this.renderer.domElement.getBoundingClientRect();
    if (!rect.width) return;
    const cabeza = this._vTmp;
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

  // Pulsar y soltar sin moverse es un toque; arrastrar por encima, una caricia.
  _alPulsar(evento) {
    if (!this.visible || !this._tocaKitsune(evento)) return;
    this._caricia = { id: evento.pointerId, x: evento.clientX, y: evento.clientY, recorrido: 0, hecha: false };
  }

  _seguirCaricia(evento) {
    const c = this._caricia;
    if (!c || evento.pointerId !== c.id) return;
    c.recorrido += Math.hypot(evento.clientX - c.x, evento.clientY - c.y);
    c.x = evento.clientX;
    c.y = evento.clientY;
    if (c.recorrido < UMBRAL_CARICIA) return;
    const a = this.accion;
    if (a?.nombre === 'caricia') {
      // Mientras sigue acariciando, el gesto no se acaba.
      a.dur = Math.min(CARICIA_MAX, Math.max(a.dur, a.t + 1.1));
    } else if (!c.hecha && (!a || GESTOS_OCIO.includes(a.nombre))) {
      this.reproducir('caricia');
      this._emitir('caricia');
    }
    c.hecha = true;
  }

  _alSoltar(evento) {
    const c = this._caricia;
    if (!c || evento.pointerId !== c.id) return;
    this._caricia = null;
    if (!c.hecha && c.recorrido < 14 && evento.type === 'pointerup') this._emitir('toque');
  }

  _actualizarZetas(dt) {
    const z = this.zetas;
    if (this.estado === 'dormir' && this.visible && !this.accion) {
      z.espera -= dt;
      if (z.espera <= 0) {
        const libre = this.zetas3d.find((s) => !s.visible);
        if (libre) {
          libre.visible = true;
          libre.userData.vida = 0;
          this.cabeza.getWorldPosition(libre.userData.origen).add(DESVIO_ZETA);
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
      s.position.copy(s.userData.origen);
      s.position.x += 0.25 * Math.sin(v * 5);
      s.position.y += 0.9 * v;
      s.scale.setScalar(0.16 + 0.22 * v);
      s.material.opacity = campana(v) * 0.9;
    }
  }

  _actualizarCorazones(dt) {
    const c = this.corazones;
    if (this.accion?.nombre === 'caricia' && this.visible) {
      c.espera -= dt;
      if (c.espera <= 0) {
        const libre = this.corazones3d.find((s) => !s.visible);
        if (libre) {
          libre.visible = true;
          libre.userData.vida = 0;
          libre.userData.fase = Math.random() * Math.PI * 2;
          this.cabeza.getWorldPosition(libre.userData.origen);
          // A los lados de la cabeza: encima quedarían tapados por el diálogo.
          libre.userData.origen.x += (Math.random() < 0.5 ? -1 : 1) * (0.32 + Math.random() * 0.2);
          libre.userData.origen.y += 0.05;
        }
        c.espera = 0.38;
      }
    }
    for (const s of this.corazones3d) {
      if (!s.visible) continue;
      s.userData.vida += dt;
      const v = s.userData.vida / 1.8;
      if (v >= 1) {
        s.visible = false;
        continue;
      }
      s.position.copy(s.userData.origen);
      s.position.x += 0.12 * Math.sin(v * 7 + s.userData.fase);
      s.position.y += 0.45 * easeOutCubic(v);
      s.scale.setScalar(0.1 + 0.12 * easeOutBack(Math.min(1, v * 3), 2));
      s.material.opacity = Math.min(1, v * 6) * (1 - easeInCubic(v));
    }
  }

  _emitir(evento, dato) {
    for (const fn of this._oyentes[evento] || []) fn(dato);
  }
}
