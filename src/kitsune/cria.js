import * as THREE from 'three';
import { crearTubo, crearOreja, perfil, proyectarParche, prepararPelaje, pintar } from './geometria.js';
import { mallaConPelo } from './pelaje.js';
import { crearMaterialOjo, crearMaterialMarca } from './ojo.js';
import { smoothstep } from './easing.js';

// La cría de la ilustración de referencia, modelada en 3D: cabeza grande y
// redonda con mejillas blancas, ojos enormes, orejas anchas con los bordes
// oscuros, cuerpo pequeño con el pecho blanco, calcetines chocolate y nueve
// colas gordas en abanico. Devuelve las mismas piezas que construirZorro para
// que Kitsune la anime igual. Mismas coordenadas: mira a +z y el suelo es y = 0.

// Ojos: medio ancho y medio alto del ojo dibujado (antes de la escala de
// caricatura del shader) y tamaño del parche donde se dibuja.
const OJO = { medio: [0.1, 0.072], parche: [0.21, 0.18] };
const OJOS = [-1, 1].map((lado) => ({
  lado,
  centro: new THREE.Vector3(0.185 * lado, 0.06, 0.37),
  normal: new THREE.Vector3(0.4 * lado, 0.06, 0.91).normalize(),
}));

// ---------- Geometría: bola deformable con los atributos del pelaje ----------

const _d = new THREE.Vector3();

// Esfera cuyo punto en cada dirección decide forma(dir). La costura queda
// detrás (-z) para que no se vea de frente.
function crearBola(forma, { segU = 56, segV = 36 } = {}) {
  const total = (segU + 1) * (segV + 1);
  const pos = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let radio = 0;
  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV;
    const phi = v * Math.PI;
    for (let iu = 0; iu <= segU; iu++) {
      const u = iu / segU;
      const th = u * Math.PI * 2;
      _d.set(Math.sin(phi) * Math.sin(th), Math.cos(phi), -Math.sin(phi) * Math.cos(th));
      const p = forma(_d.clone());
      const i = iv * (segU + 1) + iu;
      pos.set([p.x, p.y, p.z], i * 3);
      uv.set([u, 1 - v], i * 2);
      radio += p.length() / total;
    }
  }
  const indices = [];
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * (segU + 1) + iu;
      const b = a + segU + 1;
      // Con la costura detrás, este orden deja las caras mirando hacia fuera.
      indices.push(a, a + 1, b, b, a + 1, b + 1);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setIndex(indices);
  g.computeVertexNormals();
  // Costura y polos: normales promediadas para que no se vea un corte.
  const n = g.attributes.normal;
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  for (let iv = 0; iv <= segV; iv++) {
    const i0 = iv * (segU + 1);
    a.fromBufferAttribute(n, i0).add(b.fromBufferAttribute(n, i0 + segU)).normalize();
    n.setXYZ(i0, a.x, a.y, a.z);
    n.setXYZ(i0 + segU, a.x, a.y, a.z);
  }
  for (const [polo, vecina] of [[0, 1], [segV, segV - 1]]) {
    a.set(0, 0, 0);
    for (let iu = 0; iu <= segU; iu++) a.add(b.fromBufferAttribute(n, vecina * (segU + 1) + iu));
    a.normalize();
    for (let iu = 0; iu <= segU; iu++) n.setXYZ(polo * (segU + 1) + iu, a.x, a.y, a.z);
  }
  // Peinado: el pelo cae hacia abajo y un poco hacia atrás.
  const peinado = new Float32Array(total * 3);
  const caida = new THREE.Vector3(0, -1, -0.35).normalize();
  for (let i = 0; i < total; i++) {
    a.fromBufferAttribute(n, i);
    b.copy(caida).addScaledVector(a, -caida.dot(a));
    if (b.lengthSq() < 1e-6) b.set(0, 0, -1);
    b.normalize();
    peinado.set([b.x, b.y, b.z], i * 3);
  }
  g.setAttribute('aPeinado', new THREE.BufferAttribute(peinado, 3));
  g.userData.escalaUV = [Math.PI * 2 * radio, Math.PI * radio];
  return g;
}

// Elipsoide sencillo (para ancas, zarpas y barbilla).
const elipsoide = (rx, ry, rz, extra = null) =>
  crearBola((d) => {
    const p = new THREE.Vector3(d.x * rx, d.y * ry, d.z * rz);
    return extra ? extra(p, d) : p;
  }, { segU: 36, segV: 24 });

// Cabeza de cría de zorro: frente más estrecha, mejillas anchas y un hocico
// corto que sale hacia delante con la trufa en la punta.
function formaCabeza(d) {
  let rx = 0.43;
  let ry = 0.42;
  const rz = 0.41;
  // Redonda, con las mejillas algo más anchas abajo y la frente hacia las orejas.
  rx *= 1 + 0.1 * smoothstep(0.15, -0.45, d.y) * smoothstep(-1, -0.8, d.y) - 0.06 * smoothstep(0.25, 0.9, d.y);
  ry *= 1 - 0.07 * smoothstep(0.5, 1, d.y) - 0.12 * smoothstep(-0.55, -1, d.y);
  const p = new THREE.Vector3(d.x * rx, d.y * ry, d.z * rz);
  // Hocico: sale bajo y estrecho, entre las mejillas.
  const h = Math.exp(-((d.x / 0.3) ** 2) - ((d.y + 0.34) / 0.24) ** 2) * smoothstep(0.3, 0.95, d.z);
  p.z += 0.21 * h;
  p.y -= 0.01 * h;
  return p;
}

// ---------- Pintores: color y largo del pelo por vértice ----------

function pintorCabeza(p, n, u, v, pal, c) {
  c.copy(pal.flanco).lerp(pal.lomo, smoothstep(0.4, 0.95, n.y) * smoothstep(0.1, -0.2, p.z) * 0.6);
  // Blanco: hocico y mejillas, por debajo de una línea que pasa bajo los ojos.
  const ax = Math.abs(p.x);
  const linea = -0.05 - 0.06 * smoothstep(0.03, 0.17, ax) + 0.1 * smoothstep(0.26, 0.46, ax);
  const blanco = smoothstep(linea + 0.025, linea - 0.025, p.y) * smoothstep(-0.25, -0.02, p.z);
  c.lerp(pal.crema, blanco);
  let pelo = 0.55;
  // Mechones de las mejillas: salen largos hacia los lados.
  pelo += 2.2 * blanco * smoothstep(0.55, 0.92, Math.abs(n.x)) * smoothstep(0.05, -0.15, p.y);
  pelo += 0.5 * smoothstep(0.6, 0.95, n.y);
  // Hocico corto y liso; nada de pelo sobre los ojos.
  pelo *= 1 - 0.5 * smoothstep(0.42, 0.58, p.z);
  for (const ojo of OJOS) pelo *= smoothstep(0.11, 0.145, Math.hypot(p.x - ojo.centro.x, (p.y - ojo.centro.y) * 1.05));
  return pelo;
}

function pintorMenton(p, n, u, v, pal, c) {
  c.copy(pal.crema);
  return 0.5;
}

function pintorOreja(p, n, u, v, pal, c) {
  const delante = smoothstep(0.1, 0.5, n.z);
  const borde = Math.abs(Math.cos(u * Math.PI * 2));
  c.copy(pal.flanco);
  // Dentro: pelo crema y esponjoso, con la piel en sombra en el fondo del cuenco.
  const dentro = delante * smoothstep(0.7, 0.45, borde) * smoothstep(0.92, 0.6, v);
  c.lerp(pal.orejaDentro, dentro);
  c.multiplyScalar(1 - 0.25 * dentro * smoothstep(0.5, 0.15, borde) * smoothstep(0.75, 0.3, v));
  // Bordes y punta oscuros, como en el dibujo.
  const oscuro = Math.max(smoothstep(0.72, 0.92, borde) * smoothstep(0.05, 0.35, v), smoothstep(0.58, 0.76, v));
  c.lerp(pal.orejaDorso, oscuro * 0.95);
  return 0.35 + 1.5 * dentro + 0.3 * (1 - delante);
}

function pintorTorso(p, n, u, v, pal, c) {
  c.copy(pal.flanco).lerp(pal.lomo, smoothstep(-0.1, -0.7, n.z) * 0.5);
  // Peto blanco del cuello a la tripa, entre las patas.
  const pecho = smoothstep(0.05, 0.45, n.z) * smoothstep(0.24 + 0.05 * (p.y - 0.6), 0.12, Math.abs(p.x)) * smoothstep(0.18, 0.4, p.y);
  c.lerp(pal.crema, pecho);
  return 0.85 + 1.0 * pecho;
}

function pintorAnca(p, n, u, v, pal, c) {
  c.copy(pal.flanco).lerp(pal.lomo, smoothstep(0.2, 0.9, n.y) * 0.35);
  return 1.05;
}

function pintorPata(p, n, u, v, pal, c) {
  // Calcetín chocolate desde media pata, con un degradado suave.
  c.copy(pal.flanco).lerp(pal.medias, smoothstep(0.32, 0.52, v));
  return 0.7 - 0.25 * smoothstep(0.4, 0.6, v);
}

function pintorZarpa(p, n, u, v, pal, c) {
  c.copy(pal.medias);
  // Surcos entre los dedos, por delante.
  const surco = smoothstep(0.012, 0.003, Math.abs(Math.abs(p.x) - 0.04)) * smoothstep(0.2, 0.7, n.z) * smoothstep(0.0, 0.05, p.z);
  c.multiplyScalar(1 - 0.45 * surco);
  return 0.4;
}

// ---------- Utilidades ----------

const _rayo = new THREE.Raycaster();

// Punto de la superficie en la dirección indicada (desde fuera hacia dentro).
function sobre(geometria, punto, direccion, separacion = 0.003) {
  const malla = new THREE.Mesh(geometria, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const dir = direccion.clone().normalize();
  _rayo.set(punto.clone().addScaledVector(dir, 0.6), dir.clone().negate());
  const golpe = _rayo.intersectObject(malla, false)[0];
  return golpe ? golpe.point.addScaledVector(dir, separacion) : punto.clone();
}

// Trazo dibujado sobre la cabeza (cejas, sonrisa): tubo que se adelgaza en las puntas.
function trazo(geometria, puntos, direccion, { radio, color }) {
  const pegados = puntos.map(([x, y, z]) => sobre(geometria, new THREE.Vector3(x, y, z), direccion, 0.006));
  const curva = new THREE.CatmullRomCurve3(pegados);
  const tubo = new THREE.TubeGeometry(curva, 32, radio, 8, false);
  // Puntas finas: se encoge cada anillo según su posición en el trazo.
  const pos = tubo.attributes.position;
  const centro = new THREE.Vector3();
  const q = new THREE.Vector3();
  for (let j = 0; j <= 32; j++) {
    const s = j / 32;
    curva.getPointAt(s, centro);
    const k = 0.25 + 0.75 * Math.sin(Math.PI * s) ** 0.6;
    for (let l = 0; l <= 8; l++) {
      const i = j * 9 + l;
      q.fromBufferAttribute(pos, i).sub(centro).multiplyScalar(k).add(centro);
      pos.setXYZ(i, q.x, q.y, q.z);
    }
  }
  tubo.computeVertexNormals();
  return new THREE.Mesh(tubo, new THREE.MeshStandardMaterial({ color, roughness: 0.6 }));
}

// ---------- Montaje ----------

export function construirCria(materialesCuerpo) {
  const piezas = [];
  const mallas = [];
  const pieza = (geometria, pintor, padre, { pos = [0, 0, 0], rot = [0, 0, 0] } = {}) => {
    prepararPelaje(geometria);
    const malla = mallaConPelo(geometria, materialesCuerpo);
    malla.position.set(...pos);
    malla.rotation.set(...rot);
    padre.add(malla);
    piezas.push({ geometria, pintor });
    mallas.push(malla);
    return malla;
  };

  const raiz = new THREE.Group();
  const cuerpo = new THREE.Group();
  raiz.add(cuerpo);

  // Torso: pera pequeña y erguida (sentado); el pecho respira.
  const pecho = new THREE.Group();
  pecho.position.set(0, 0.6, 0);
  cuerpo.add(pecho);
  pieza(
    crearTubo({
      puntos: [
        [0, 0.08, -0.12],
        [0, 0.26, -0.08],
        [0, 0.47, 0.0],
        [0, 0.67, 0.06],
        [0, 0.86, 0.08],
      ].map(([x, y, z]) => [x, y - 0.6, z]),
      ancho: perfil([[0, 0.3], [0.25, 0.32], [0.55, 0.27], [0.8, 0.23], [1, 0.2]]),
      alto: perfil([[0, 0.28], [0.25, 0.3], [0.55, 0.25], [0.8, 0.22], [1, 0.19]]),
      cierre: [0.2, 0.15],
      peinado: -1,
      anillos: 40,
      lados: 36,
    }),
    // El pintor trabaja en coordenadas de la pieza: se le devuelve la altura real.
    (p, n, u, v, pal, c) => pintorTorso(new THREE.Vector3(p.x, p.y + 0.6, p.z), n, u, v, pal, c),
    pecho,
  );

  // Ancas redondas a los lados y pies traseros chocolate asomando delante.
  for (const lado of [-1, 1]) {
    pieza(elipsoide(0.2, 0.25, 0.3), pintorAnca, cuerpo, { pos: [0.25 * lado, 0.25, -0.04], rot: [0, 0.25 * lado, 0] });
    pieza(elipsoide(0.11, 0.07, 0.15), pintorZarpa, cuerpo, { pos: [0.33 * lado, 0.065, 0.2], rot: [0, 0.3 * lado, 0] });
  }

  // Patas delanteras: rectas hasta el suelo, gorditas, con calcetín y zarpa.
  const patas = [-1, 1].map((lado) => {
    const hombro = new THREE.Group();
    hombro.position.set(0.125 * lado, 0.63, 0.14);
    cuerpo.add(hombro);
    pieza(
      crearTubo({
        puntos: [
          [0, 0.06, 0],
          [0, -0.12, 0.02],
          [0, -0.3, 0.03],
        ],
        ancho: perfil([[0, 0.12], [0.5, 0.105], [1, 0.1]]),
        alto: perfil([[0, 0.13], [0.5, 0.11], [1, 0.1]]),
        cierre: [0.2, 0.1],
        anillos: 18,
        lados: 24,
      }),
      (p, n, u, v, pal, c) => {
        c.copy(pal.flanco);
        return 0.8;
      },
      hombro,
    );
    const antebrazo = new THREE.Group();
    antebrazo.position.set(0, -0.28, 0.03);
    hombro.add(antebrazo);
    pieza(
      crearTubo({
        puntos: [
          [0, 0.05, 0],
          [0, -0.1, 0.005],
          [0, -0.25, 0.01],
        ],
        ancho: perfil([[0, 0.1], [0.5, 0.095], [1, 0.094]]),
        alto: perfil([[0, 0.102], [0.5, 0.096], [1, 0.094]]),
        cierre: [0.1, 0.1],
        anillos: 20,
        lados: 22,
      }),
      // v recorre la pata entera de arriba abajo: el calcetín empieza a media altura.
      (p, n, u, v, pal, c) => pintorPata(p, n, u, 0.3 + 0.7 * v, pal, c),
      antebrazo,
    );
    pieza(elipsoide(0.12, 0.07, 0.15), pintorZarpa, antebrazo, { pos: [0, -0.28, 0.06] });
    return { hombro, antebrazo };
  });

  // ---------- Cabeza ----------
  const cabeza = new THREE.Group();
  cabeza.rotation.order = 'YXZ';
  const posCabeza = new THREE.Vector3(0, 1.2, 0.14);
  cabeza.position.copy(posCabeza);
  cuerpo.add(cabeza);

  const geoCabeza = crearBola(formaCabeza, { segU: 72, segV: 48 });
  pieza(geoCabeza, pintorCabeza, cabeza);

  const mandibula = new THREE.Group();
  mandibula.position.set(0, -0.22, 0.36);
  cabeza.add(mandibula);
  pieza(elipsoide(0.11, 0.05, 0.11), pintorMenton, mandibula, { pos: [0, 0, 0.05] });

  // Interior de la boca: asoma al hablar, entre el hocico y la barbilla.
  const boca = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 14), new THREE.MeshStandardMaterial({ roughness: 0.6 }));
  const bocaY = -0.185;
  boca.scale.set(0.07, 0.012, 0.07);
  boca.position.set(0, bocaY, 0.5);
  cabeza.add(boca);

  // Trufa: botón negro y brillante, algo más ancho que alto.
  const nariz = new THREE.Mesh(
    new THREE.SphereGeometry(1, 28, 18),
    new THREE.MeshPhysicalMaterial({ roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
  );
  nariz.scale.set(0.068, 0.047, 0.05);
  nariz.position.copy(sobre(geoCabeza, new THREE.Vector3(0, -0.075, 0.5), new THREE.Vector3(0, 0.15, 1), 0.016));
  cabeza.add(nariz);

  // Orejas grandes y anchas, abiertas hacia los lados.
  const orejas = [-1, 1].map((lado) => {
    const pivote = new THREE.Group();
    pivote.position.set(0.21 * lado, 0.28, -0.07);
    cabeza.add(pivote);
    const apertura = new THREE.Group();
    apertura.rotation.set(-0.08, 0.28 * lado, -0.2 * lado);
    pivote.add(apertura);
    pieza(crearOreja({ alto: 0.56, ancho: 0.54, grosor: 0.14 }), pintorOreja, apertura);
    return { pivote, lado };
  });

  // Ojos grandes de ilustración (el shader en modo caricatura).
  const ojos = OJOS.map(({ lado, centro, normal }) => {
    const material = crearMaterialOjo(lado, OJO);
    material.uniforms.uCaricatura.value = 1;
    const c = sobre(geoCabeza, centro, normal, 0);
    const malla = new THREE.Mesh(proyectarParche(geoCabeza, c, normal, OJO.parche[0], OJO.parche[1], 28, 24), material);
    malla.renderOrder = 2;
    cabeza.add(malla);
    return material;
  });

  // La cría no lleva marca en la frente, pero Kitsune espera el material.
  const marca = crearMaterialMarca();
  const mallaMarca = new THREE.Group();
  mallaMarca.visible = false;

  // Cejas, sonrisa y la rayita que baja de la trufa.
  const rasgos = new THREE.Group();
  cabeza.add(rasgos);
  const colorTrazo = '#2b150c';
  for (const lado of [-1, 1]) {
    const ceja = [
      [0.11, 0.22, 0.35],
      [0.16, 0.25, 0.35],
      [0.21, 0.255, 0.33],
      [0.27, 0.235, 0.3],
    ].map(([x, y, z]) => [x * lado, y, z]);
    rasgos.add(trazo(geoCabeza, ceja, new THREE.Vector3(0.3 * lado, 0.35, 1), { radio: 0.019, color: colorTrazo }));
  }
  const sonrisa = [
    [-0.14, -0.13],
    [-0.1, -0.168],
    [-0.05, -0.182],
    [0, -0.17],
    [0.05, -0.182],
    [0.1, -0.168],
    [0.14, -0.13],
  ].map(([x, y]) => [x, y, 0.55]);
  rasgos.add(trazo(geoCabeza, sonrisa, new THREE.Vector3(0, -0.1, 1), { radio: 0.008, color: colorTrazo }));
  rasgos.add(trazo(geoCabeza, [[0, -0.11, 0.6], [0, -0.14, 0.59], [0, -0.17, 0.58]], new THREE.Vector3(0, -0.1, 1), { radio: 0.0065, color: colorTrazo }));

  // Sin bigotes: el material existe para que Kitsune pueda ajustarlo.
  const materialBigotes = new THREE.LineBasicMaterial({ transparent: true, opacity: 0 });

  // Las colas nacen de la parte baja de la espalda.
  const colasBase = new THREE.Group();
  colasBase.position.set(0, 0.36, -0.22);
  cuerpo.add(colasBase);

  return {
    raiz,
    cuerpo,
    pecho,
    cabeza,
    posCabeza,
    bocaY,
    mandibula,
    boca,
    orejas,
    patas,
    ojos,
    marca,
    mallaMarca,
    rasgos,
    colasBase,
    mallas,
    materialesSueltos: { boca: boca.material, nariz: nariz.material, bigotes: materialBigotes },
    repintar(paleta) {
      for (const { geometria, pintor } of piezas) pintar(geometria, pintor, paleta);
    },
  };
}
