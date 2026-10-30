import * as THREE from 'three';
import { smoothstep } from './easing.js';
import { mallaConPelo } from './pelaje.js';

const ANILLOS = 28;
const LADOS = 16;

const EJE_X = new THREE.Vector3(1, 0, 0);
const EJE_Y = new THREE.Vector3(0, 1, 0);
const EJE_Z = new THREE.Vector3(0, 0, 1);
const _q = new THREE.Quaternion();
const _qa = new THREE.Quaternion();
const _qb = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _ax = new THREE.Vector3();
const _ay = new THREE.Vector3();
const _az = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();

// Grosor relativo a lo largo de la cola (0 = raíz, 1 = punta): estrecha en
// la raíz, se hincha hasta la mitad y se cierra en una punta redondeada.
function perfil(s) {
  const subida = 0.3 + 0.7 * Math.sin((Math.min(s / 0.5, 1) * Math.PI) / 2);
  const caida = s <= 0.5 ? 1 : Math.pow(Math.max(0, 1 - ((s - 0.5) / 0.5) ** 2), 0.5);
  return subida * caida;
}

const PERFIL = Array.from({ length: ANILLOS }, (_, j) => perfil(j / (ANILLOS - 1)));

// Una cola es un tubo cuya columna se recalcula cada fotograma por cinemática
// directa: cada segmento hereda la orientación del anterior y añade su propio
// rizo y balanceo, así la onda se propaga de la raíz a la punta.
export class Cola {
  constructor(indice, total, materiales) {
    const centro = (total - 1) / 2;
    this.indice = indice;
    this.k = (indice - centro) / centro;
    this.longitud = 2.15 - 0.3 * Math.abs(this.k);
    this.radioMax = 0.155 - 0.025 * Math.abs(this.k);
    this.fase = indice * 1.37;

    const vertices = ANILLOS * (LADOS + 1);
    this.posiciones = new Float32Array(vertices * 3);
    this.normales = new Float32Array(vertices * 3);
    this.colores = new Float32Array(vertices * 3);
    this.pelo = new Float32Array(vertices);
    this.peinado = new Float32Array(vertices * 3);
    const uv = new Float32Array(vertices * 2);
    const uvPelo = new Float32Array(vertices * 2);
    for (let j = 0; j < ANILLOS; j++) {
      for (let l = 0; l <= LADOS; l++) {
        const i = j * (LADOS + 1) + l;
        uv[i * 2] = l / LADOS;
        uv[i * 2 + 1] = j / (ANILLOS - 1);
        uvPelo[i * 2] = uv[i * 2] * 0.8;
        uvPelo[i * 2 + 1] = uv[i * 2 + 1] * this.longitud;
      }
    }

    const indices = [];
    for (let j = 0; j < ANILLOS - 1; j++) {
      for (let l = 0; l < LADOS; l++) {
        const a = j * (LADOS + 1) + l;
        const b = a + LADOS + 1;
        indices.push(a, b, a + 1, b, b + 1, a + 1);
      }
    }

    const geometria = new THREE.BufferGeometry();
    geometria.setIndex(indices);
    geometria.setAttribute(
      'position',
      new THREE.BufferAttribute(this.posiciones, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometria.setAttribute(
      'normal',
      new THREE.BufferAttribute(this.normales, 3).setUsage(THREE.DynamicDrawUsage),
    );
    geometria.setAttribute('color', new THREE.BufferAttribute(this.colores, 3));
    geometria.setAttribute('aPelo', new THREE.BufferAttribute(this.pelo, 1));
    geometria.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometria.setAttribute('aPeloUV', new THREE.BufferAttribute(uvPelo, 2));
    geometria.setAttribute(
      'aPeinado',
      new THREE.BufferAttribute(this.peinado, 3).setUsage(THREE.DynamicDrawUsage),
    );
    // Los vértices se mueven cada fotograma: una esfera fija que cubre todo el
    // recorrido evita recalcularla y mantiene funcionando el raycast de clics.
    geometria.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.8, -0.4), 2.4);
    this.geometria = geometria;

    this.malla = mallaConPelo(geometria, materiales);
    this.malla.frustumCulled = false;
  }

  // Cola de zorro: rojiza, con una banda de pelo oscuro antes de la punta blanca.
  setColores(paleta) {
    for (let j = 0; j < ANILLOS; j++) {
      const s = j / (ANILLOS - 1);
      _c.set(paleta.flanco).lerp(new THREE.Color(paleta.lomo), smoothstep(0.0, 0.35, s) * 0.6);
      _c.lerp(new THREE.Color(paleta.bandaCola), smoothstep(0.66, 0.8, s) * 0.7);
      _c.lerp(new THREE.Color(paleta.puntaCola), smoothstep(0.86, 0.92, s));
      const largo = 0.7 + 0.6 * Math.sqrt(Math.sin(Math.PI * Math.min(s * 1.1, 1)));
      for (let l = 0; l <= LADOS; l++) {
        const i = j * (LADOS + 1) + l;
        this.colores[i * 3] = _c.r;
        this.colores[i * 3 + 1] = _c.g;
        this.colores[i * 3 + 2] = _c.b;
        this.pelo[i] = largo;
      }
    }
    this.geometria.attributes.color.needsUpdate = true;
    this.geometria.attributes.aPelo.needsUpdate = true;
  }

  // tOnda: reloj acumulado del balanceo (avanza a p.ondaVel para que cambiar
  // de velocidad no provoque saltos de fase). despliegue: 0 = recogida, 1 = abierta.
  actualizar(tOnda, t, p, despliegue) {
    if (despliegue <= 0.001) {
      this.malla.visible = false;
      return;
    }
    this.malla.visible = true;

    const d = despliegue;
    const remolino = p.remolino * 0.55 * Math.sin(t * 2.1 - this.indice * 0.75);
    const abanico = (this.k * 1.3 * p.abanico + remolino) * (0.2 + 0.8 * d);
    // Barrido: las colas salen abiertas desde la cadera y se curvan de vuelta
    // hacia arriba, como un abanico; si salieran rectas parecerían brazos.
    const barrido = (-this.k * 1.05 * p.abanico * d) / (ANILLOS - 1);

    _qa.setFromAxisAngle(EJE_Z, abanico);
    _qb.setFromAxisAngle(EJE_X, -1.0 - 0.15 * Math.abs(this.k));
    _q.copy(_qa).multiply(_qb);

    const largo = this.longitud * (0.12 + 0.88 * d) * (1 + 0.03 * Math.sin(tOnda * 0.9 + this.fase));
    const seg = largo / (ANILLOS - 1);
    const rizoTotal = 1.45 * p.rizo * (0.35 + 0.65 * d);
    const escalaRadio = this.radioMax * (0.35 + 0.65 * d);

    _p.set(0, 0, 0);
    for (let j = 0; j < ANILLOS; j++) {
      const s = j / (ANILLOS - 1);
      _ax.copy(EJE_X).applyQuaternion(_q);
      _ay.copy(EJE_Y).applyQuaternion(_q);
      _az.copy(EJE_Z).applyQuaternion(_q);

      const r = PERFIL[j] * escalaRadio;
      const antes = PERFIL[Math.max(0, j - 1)];
      const despues = PERFIL[Math.min(ANILLOS - 1, j + 1)];
      const pendiente = Math.max(-4, Math.min(4, ((despues - antes) * escalaRadio) / (2 * seg)));

      for (let l = 0; l <= LADOS; l++) {
        const th = (l / LADOS) * Math.PI * 2;
        const c = Math.cos(th);
        const sn = Math.sin(th);
        const i = (j * (LADOS + 1) + l) * 3;

        _n.set(0, 0, 0).addScaledVector(_ax, c).addScaledVector(_az, sn);
        this.posiciones[i] = _p.x + _n.x * r;
        this.posiciones[i + 1] = _p.y + _n.y * r;
        this.posiciones[i + 2] = _p.z + _n.z * r;

        _n.addScaledVector(_ay, -pendiente).normalize();
        this.normales[i] = _n.x;
        this.normales[i + 1] = _n.y;
        this.normales[i + 2] = _n.z;
        this.peinado[i] = _ay.x;
        this.peinado[i + 1] = _ay.y;
        this.peinado[i + 2] = _ay.z;
      }

      if (j < ANILLOS - 1) {
        const amp = p.ondaAmp * (0.35 + s);
        const rizo =
          rizoTotal / (ANILLOS - 1) + amp * 0.03 * Math.sin(tOnda * 1.7 + this.fase - s * 3.2);
        const lateral = barrido + amp * 0.028 * Math.sin(tOnda * 1.25 + this.fase * 1.7 - s * 2.6);
        _p.addScaledVector(_ay, seg);
        _q.multiply(_qa.setFromAxisAngle(EJE_X, rizo));
        _q.multiply(_qb.setFromAxisAngle(EJE_Z, lateral));
      }
    }

    this.geometria.attributes.position.needsUpdate = true;
    this.geometria.attributes.normal.needsUpdate = true;
    this.geometria.attributes.aPeinado.needsUpdate = true;
  }
}
