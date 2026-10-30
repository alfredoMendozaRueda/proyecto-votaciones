import * as THREE from 'three';

const _X = new THREE.Vector3(1, 0, 0);
const _Y = new THREE.Vector3(0, 1, 0);

// Interpolación suave entre claves [[s, valor], ...] (Catmull-Rom en 1D).
export function perfil(claves) {
  return (s) => {
    const n = claves.length;
    if (s <= claves[0][0]) return claves[0][1];
    if (s >= claves[n - 1][0]) return claves[n - 1][1];
    let i = 0;
    while (s > claves[i + 1][0]) i++;
    const [s1, v1] = claves[i];
    const [s2, v2] = claves[i + 1];
    const v0 = (claves[i - 1] ?? claves[i])[1];
    const v3 = (claves[i + 2] ?? claves[i + 1])[1];
    const t = (s - s1) / (s2 - s1);
    return (
      0.5 *
      (2 * v1 + (-v0 + v2) * t + (2 * v0 - 5 * v1 + 4 * v2 - v3) * t * t + (-v0 + 3 * v1 - 3 * v2 + v3) * t * t * t)
    );
  };
}

// Cierre en cúpula: 0 en los extremos del tubo y 1 en el interior.
function casquete(s, inicio, fin) {
  const a = inicio > 0 ? Math.min(1, s / inicio) : 1;
  const b = fin > 0 ? Math.min(1, (1 - s) / fin) : 1;
  return Math.sqrt(a * (2 - a)) * Math.sqrt(b * (2 - b));
}

function indicesRejilla(anillos, lados) {
  const indices = [];
  for (let j = 0; j < anillos - 1; j++) {
    for (let l = 0; l < lados; l++) {
      const a = j * (lados + 1) + l;
      const b = a + lados + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  return indices;
}

// Une la costura (primer y último vértice de cada anillo) para que no se vea
// un corte de sombreado, y orienta los polos según la tangente.
function soldarCostura(geometria, anillos, lados, tangentes) {
  const n = geometria.attributes.normal;
  const v = new THREE.Vector3();
  const w = new THREE.Vector3();
  for (let j = 0; j < anillos; j++) {
    const a = j * (lados + 1);
    const b = a + lados;
    if (tangentes && (j === 0 || j === anillos - 1)) {
      const t = tangentes[j].clone().multiplyScalar(j === 0 ? -1 : 1);
      for (let l = 0; l <= lados; l++) n.setXYZ(a + l, t.x, t.y, t.z);
      continue;
    }
    v.fromBufferAttribute(n, a).add(w.fromBufferAttribute(n, b)).normalize();
    n.setXYZ(a, v.x, v.y, v.z);
    n.setXYZ(b, v.x, v.y, v.z);
  }
  n.needsUpdate = true;
}

// Tubo de sección elíptica a lo largo de una curva. Es la pieza básica de la
// anatomía: torso, cuello, cabeza, patas... Cada uno es un "cilindro
// generalizado" con su propio perfil de ancho y alto.
// peinado: +1 si el pelo cae hacia el final del tubo, -1 hacia el principio.
export function crearTubo({ puntos, ancho, alto, anillos = 40, lados = 32, seccion = null, cierre = [0.1, 0.1], peinado = 1 }) {
  const curva = new THREE.CatmullRomCurve3(
    puntos.map((p) => new THREE.Vector3(...p)),
    false,
    'centripetal',
  );
  const total = anillos * (lados + 1);
  const pos = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const tangente = new Float32Array(total * 3);
  const C = new THREE.Vector3();
  const T = new THREE.Vector3();
  const L = new THREE.Vector3();
  const N = new THREE.Vector3();
  const tangentes = [];
  let perimetro = 0;

  for (let j = 0; j < anillos; j++) {
    const s = j / (anillos - 1);
    curva.getPointAt(s, C);
    curva.getTangentAt(s, T);
    tangentes.push(T.clone());
    L.copy(_X).addScaledVector(T, -_X.dot(T)).normalize();
    N.crossVectors(L, T).normalize();
    const k = casquete(s, cierre[0], cierre[1]);
    const w = ancho(s) * k;
    const h = alto(s) * k;
    perimetro += (Math.PI * (ancho(s) + alto(s))) / anillos;
    for (let l = 0; l <= lados; l++) {
      const th = (l / lados) * Math.PI * 2;
      const [fx, fy] = seccion ? seccion(th, s) : [1, 1];
      const c = Math.cos(th) * w * fx;
      const sn = Math.sin(th) * h * fy;
      const i = j * (lados + 1) + l;
      pos[i * 3] = C.x + L.x * c + N.x * sn;
      pos[i * 3 + 1] = C.y + L.y * c + N.y * sn;
      pos[i * 3 + 2] = C.z + L.z * c + N.z * sn;
      uv[i * 2] = l / lados;
      uv[i * 2 + 1] = s;
      tangente[i * 3] = T.x * peinado;
      tangente[i * 3 + 1] = T.y * peinado;
      tangente[i * 3 + 2] = T.z * peinado;
    }
  }

  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometria.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometria.setAttribute('aPeinado', new THREE.BufferAttribute(tangente, 3));
  geometria.setIndex(indicesRejilla(anillos, lados));
  geometria.computeVertexNormals();
  soldarCostura(geometria, anillos, lados, tangentes);
  geometria.userData.escalaUV = [perimetro, curva.getLength()];
  return geometria;
}

// Oreja de zorro: triángulo alto con la cara delantera en forma de cuenco.
export function crearOreja({ alto = 0.34, ancho = 0.2, grosor = 0.07, anillos = 22, lados = 28 }) {
  const total = anillos * (lados + 1);
  const pos = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  const peinado = new Float32Array(total * 3);
  for (let i = 0; i < total; i++) peinado[i * 3 + 1] = 1;
  for (let j = 0; j < anillos; j++) {
    const v = j / (anillos - 1);
    const r = Math.pow(1 - v, 0.85);
    for (let l = 0; l <= lados; l++) {
      const th = (l / lados) * Math.PI * 2;
      const c = Math.cos(th);
      const s = Math.sin(th);
      // Delante (+z) se hunde hacia dentro: el cuenco de la oreja.
      const hundido = s > 0 ? 1 - 1.55 * (1 - Math.abs(c)) : 1;
      const i = j * (lados + 1) + l;
      pos[i * 3] = (ancho / 2) * r * c;
      pos[i * 3 + 1] = alto * v;
      pos[i * 3 + 2] = (grosor / 2) * r * s * hundido;
      uv[i * 2] = l / lados;
      uv[i * 2 + 1] = v;
    }
  }
  const geometria = new THREE.BufferGeometry();
  geometria.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geometria.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  geometria.setAttribute('aPeinado', new THREE.BufferAttribute(peinado, 3));
  geometria.setIndex(indicesRejilla(anillos, lados));
  geometria.computeVertexNormals();
  soldarCostura(geometria, anillos, lados, null);
  geometria.userData.escalaUV = [ancho * 2.2, alto];
  return geometria;
}

// Parche que se proyecta sobre una superficie lanzando un rayo por vértice:
// sirve para "pintar" ojos y marcas encima de la cabeza siguiendo su forma.
export function proyectarParche(geometriaDestino, centro, normal, mitadU, mitadV, segU = 22, segV = 16) {
  const destino = new THREE.Mesh(geometriaDestino, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  destino.updateMatrixWorld();
  const n = normal.clone().normalize();
  const u = new THREE.Vector3().crossVectors(_Y, n).normalize();
  const v = new THREE.Vector3().crossVectors(n, u).normalize();
  const geometria = new THREE.PlaneGeometry(mitadU * 2, mitadV * 2, segU, segV);
  const pos = geometria.attributes.position;
  const rayo = new THREE.Raycaster();
  const p = new THREE.Vector3();
  const origen = new THREE.Vector3();
  const dir = n.clone().negate();
  rayo.far = 0.8;
  for (let i = 0; i < pos.count; i++) {
    p.copy(centro).addScaledVector(u, pos.getX(i)).addScaledVector(v, pos.getY(i));
    origen.copy(p).addScaledVector(n, 0.3);
    rayo.set(origen, dir);
    const impacto = rayo.intersectObject(destino, false)[0];
    if (impacto) p.copy(impacto.point).addScaledVector(impacto.face.normal, 0.0025);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geometria.computeVertexNormals();
  return geometria;
}

// Añade los atributos de pelaje (color, longitud del pelo y UV escaladas a
// unidades reales para que la densidad de pelos sea la misma en todo el cuerpo).
export function prepararPelaje(geometria) {
  const n = geometria.attributes.position.count;
  const [eu, ev] = geometria.userData.escalaUV;
  const uv = geometria.attributes.uv;
  const uvPelo = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) {
    uvPelo[i * 2] = uv.getX(i) * eu;
    uvPelo[i * 2 + 1] = uv.getY(i) * ev;
  }
  geometria.setAttribute('aPeloUV', new THREE.BufferAttribute(uvPelo, 2));
  geometria.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geometria.setAttribute('aPelo', new THREE.BufferAttribute(new Float32Array(n), 1));
  return geometria;
}

const _p = new THREE.Vector3();
const _n = new THREE.Vector3();
const _c = new THREE.Color();

// Ejecuta un "pintor" por vértice: decide el color del pelaje y lo largo que
// es el pelo según la posición y la normal de ese punto.
export function pintar(geometria, pintor, paleta) {
  const pos = geometria.attributes.position;
  const nor = geometria.attributes.normal;
  const uv = geometria.attributes.uv;
  const color = geometria.attributes.color;
  const pelo = geometria.attributes.aPelo;
  for (let i = 0; i < pos.count; i++) {
    _p.fromBufferAttribute(pos, i);
    _n.fromBufferAttribute(nor, i);
    const largo = pintor(_p, _n, uv.getX(i), uv.getY(i), paleta, _c);
    color.setXYZ(i, _c.r, _c.g, _c.b);
    pelo.setX(i, largo);
  }
  color.needsUpdate = true;
  pelo.needsUpdate = true;
}
