import * as THREE from 'three';
import { smoothstep } from './easing.js';

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
const _c1 = new THREE.Color();
const _c2 = new THREE.Color();

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
  constructor(indice, total, material, materialContorno) {
    const centro = (total - 1) / 2;
    this.indice = indice;
    this.k = (indice - centro) / centro;
    this.longitud = 2.15 - 0.3 * Math.abs(this.k);
    this.radioMax = 0.24 - 0.04 * Math.abs(this.k);
    this.fase = indice * 1.37;

    const vertices = ANILLOS * (LADOS + 1);
    this.posiciones = new Float32Array(vertices * 3);
    this.normales = new Float32Array(vertices * 3);
    this.colores = new Float32Array(vertices * 3);

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
    // Los vértices se mueven cada fotograma: una esfera fija que cubre todo el
    // recorrido evita recalcularla y mantiene funcionando el raycast de clics.
    geometria.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0.8, -0.4), 2.4);
    this.geometria = geometria;

    this.malla = new THREE.Mesh(geometria, material);
    this.malla.frustumCulled = false;
    const contorno = new THREE.Mesh(geometria, materialContorno);
    contorno.frustumCulled = false;
    this.malla.add(contorno);
  }

  setColores(pelaje, punta) {
    _c1.set(pelaje);
    _c2.set(punta);
    for (let j = 0; j < ANILLOS; j++) {
      const mezcla = smoothstep(0.8, 0.85, j / (ANILLOS - 1));
      const r = _c1.r + (_c2.r - _c1.r) * mezcla;
      const g = _c1.g + (_c2.g - _c1.g) * mezcla;
      const b = _c1.b + (_c2.b - _c1.b) * mezcla;
      for (let l = 0; l <= LADOS; l++) {
        const i = (j * (LADOS + 1) + l) * 3;
        this.colores[i] = r;
        this.colores[i + 1] = g;
        this.colores[i + 2] = b;
      }
    }
    this.geometria.attributes.color.needsUpdate = true;
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
        const mechon = 1 + 0.055 * Math.sin(5 * th + s * 9 + this.fase);
        const i = (j * (LADOS + 1) + l) * 3;

        _n.set(0, 0, 0).addScaledVector(_ax, c).addScaledVector(_az, sn);
        this.posiciones[i] = _p.x + _n.x * r * mechon;
        this.posiciones[i + 1] = _p.y + _n.y * r * mechon;
        this.posiciones[i + 2] = _p.z + _n.z * r * mechon;

        _n.addScaledVector(_ay, -pendiente).normalize();
        this.normales[i] = _n.x;
        this.normales[i + 1] = _n.y;
        this.normales[i + 2] = _n.z;
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
  }
}
