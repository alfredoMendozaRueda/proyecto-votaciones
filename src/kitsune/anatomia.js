import * as THREE from 'three';
import { crearTubo, crearOreja, perfil, proyectarParche, prepararPelaje, pintar } from './geometria.js';
import { mallaConPelo } from './pelaje.js';
import { crearMaterialOjo, crearMaterialMarca, PARCHE_OJO, PARCHE_MARCA } from './ojo.js';
import { smoothstep } from './easing.js';

// Sistema de coordenadas: el zorro mira a +z, el suelo es y = 0 y el
// origen está bajo el centro del cuerpo. Medidas en las mismas unidades que
// la cámara (el zorro sentado mide unas 2 unidades hasta las orejas).

const OJOS = [-1, 1].map((lado) => ({
  lado,
  centro: new THREE.Vector3(0.105 * lado, 0.13, 0.19),
  normal: new THREE.Vector3(0.52 * lado, 0.22, 0.83).normalize(),
}));

function distanciaASegmento(p, a, b) {
  const ab = b.clone().sub(a);
  const t = Math.max(0, Math.min(1, p.clone().sub(a).dot(ab) / ab.lengthSq()));
  return p.distanceTo(a.clone().addScaledVector(ab, t));
}

const LAGRIMAS = [-1, 1].map((lado) => [
  new THREE.Vector3(0.072 * lado, 0.1, 0.205),
  new THREE.Vector3(0.06 * lado, 0.0, 0.37),
]);

// ---------- Pintores: color del pelaje y largo del pelo por vértice ----------

function pintorTorso(p, n, u, v, pal, c) {
  c.copy(pal.flanco).lerp(pal.lomo, smoothstep(-0.05, -0.6, n.z) * 0.8);
  const pecho = smoothstep(0.1, 0.5, n.z) * smoothstep(0.5, 0.8, p.y) * smoothstep(0.24, 0.1, Math.abs(p.x));
  c.lerp(pal.crema, pecho);
  return 0.9 + 0.7 * pecho;
}

function pintorCuello(p, n, u, v, pal, c) {
  c.copy(pal.flanco).lerp(pal.lomo, smoothstep(-0.1, -0.6, n.z) * 0.7);
  const garganta = smoothstep(-0.15, 0.35, n.z);
  c.lerp(pal.crema, garganta);
  return 1.2 + 0.6 * garganta;
}

function pintorCabeza(p, n, u, v, pal, c) {
  c.copy(pal.flanco).lerp(pal.lomo, smoothstep(0.35, 0.9, n.y) * smoothstep(0.25, -0.05, p.z) * 0.7);
  // Mejillas y labio superior blancos, bajo una línea que va del ojo a la boca.
  const linea = p.z > 0.06 ? 0.045 - 0.06 * smoothstep(0.06, 0.5, p.z) : 0.045 - 0.12 * smoothstep(0.06, -0.18, p.z);
  const blanco = smoothstep(linea + 0.012, linea - 0.012, p.y) * smoothstep(-0.2, -0.1, p.z);
  c.lerp(pal.crema, blanco);
  // Lágrima oscura del lagrimal hacia el hocico.
  const lado = p.x >= 0 ? 1 : 0;
  const dLagrima = distanciaASegmento(p, LAGRIMAS[lado][0], LAGRIMAS[lado][1]);
  c.lerp(pal.medias, smoothstep(0.022, 0.01, dLagrima) * 0.85);
  // Labios y trufa oscuros.
  c.lerp(pal.medias, smoothstep(-0.55, -0.85, n.y) * smoothstep(0.2, 0.35, p.z) * 0.7);
  c.lerp(pal.nariz, smoothstep(0.49, 0.53, p.z));

  let pelo = 0.7;
  pelo = THREE.MathUtils.lerp(pelo, 0.3, smoothstep(0.22, 0.4, p.z));
  // Gorguera: el pelo de las mejillas sale largo hacia los lados.
  pelo += 1.3 * blanco * smoothstep(0.12, -0.08, p.z) * smoothstep(0.5, 0.95, Math.abs(n.x));
  // Sin pelo sobre el ojo (ni sobre el ojo grande de la ilustración).
  for (const ojo of OJOS) pelo *= smoothstep(0.06, 0.1, p.distanceTo(ojo.centro));
  return pelo * (1 - smoothstep(0.47, 0.5, p.z));
}

function pintorMandibula(p, n, u, v, pal, c) {
  c.copy(pal.crema).lerp(pal.medias, smoothstep(0.4, 0.9, n.y) * 0.5);
  return 0.45;
}

function pintorOreja(p, n, u, v, pal, c) {
  const delante = smoothstep(0.15, 0.55, n.z);
  const detras = smoothstep(0.05, -0.45, n.z);
  c.copy(pal.flanco);
  c.lerp(pal.orejaDorso, detras * smoothstep(0.2, 0.42, v));
  // Dentro del cuenco la piel queda en sombra; el pelo blanco sale de los bordes interiores.
  const borde = Math.abs(Math.cos(u * Math.PI * 2));
  c.multiplyScalar(1 - 0.45 * delante * smoothstep(0.6, 0.2, borde));
  const mechones = delante * smoothstep(0.3, 0.55, borde) * smoothstep(0.92, 0.75, borde) * smoothstep(0.7, 0.35, v);
  c.lerp(pal.crema, mechones * 0.85);
  c.lerp(pal.orejaDorso, smoothstep(0.78, 0.88, v));
  return 0.4 + 1.3 * mechones;
}

function pintorBrazo(p, n, u, v, pal, c) {
  c.copy(pal.flanco);
  return 0.75;
}

function pintorAntebrazo(p, n, u, v, pal, c) {
  c.copy(pal.flanco).lerp(pal.medias, smoothstep(0.08, 0.32, v));
  return 0.45;
}

function pintorZarpa(p, n, u, v, pal, c) {
  c.copy(pal.medias);
  return 0.35;
}

function pintorMuslo(p, n, u, v, pal, c) {
  c.copy(pal.flanco).lerp(pal.lomo, smoothstep(0.2, 0.8, n.y) * 0.6);
  c.lerp(pal.crema, smoothstep(0.3, 0.8, -n.y) * 0.5);
  return 1.15;
}

function pintorPata(p, n, u, v, pal, c) {
  c.copy(pal.flanco).lerp(pal.medias, smoothstep(0.1, 0.5, v));
  return 0.45;
}

// ---------- Montaje ----------

// Un trazo pegado a la cabeza: cada punto se proyecta sobre la superficie
// siguiendo una dirección y se separa un poco para que no se hunda.
function trazoSobre(geometria, puntos, direccion, { radio, color }) {
  const malla = new THREE.Mesh(geometria, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }));
  const rayo = new THREE.Raycaster();
  const dir = direccion.clone().normalize();
  const pegados = puntos.map((p) => {
    rayo.set(p.clone().addScaledVector(dir, 0.4), dir.clone().negate());
    const golpe = rayo.intersectObject(malla, false)[0];
    return golpe ? golpe.point.addScaledVector(dir, 0.004) : p;
  });
  const curva = new THREE.CatmullRomCurve3(pegados);
  const tubo = new THREE.TubeGeometry(curva, 24, radio, 6, false);
  return new THREE.Mesh(tubo, new THREE.MeshBasicMaterial({ color }));
}

export function construirZorro(materialesCuerpo) {
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

  // El pecho va en su propio grupo para poder "respirar" escalándolo.
  const pecho = new THREE.Group();
  pecho.position.set(0, 0.75, 0);
  cuerpo.add(pecho);

  pieza(
    crearTubo({
      puntos: [
        [0, 0.24, -0.38],
        [0, 0.5, -0.3],
        [0, 0.76, -0.15],
        [0, 0.96, -0.01],
        [0, 1.12, 0.08],
        [0, 1.24, 0.13],
      ].map(([x, y, z]) => [x, y - 0.75, z]),
      ancho: perfil([[0, 0.25], [0.15, 0.27], [0.42, 0.21], [0.7, 0.23], [0.9, 0.2], [1, 0.17]]),
      alto: perfil([[0, 0.28], [0.15, 0.29], [0.42, 0.24], [0.7, 0.29], [0.9, 0.24], [1, 0.19]]),
      seccion: (th, s) => [1, 1 + 0.12 * Math.sin(th) * smoothstep(0.4, 0.75, s)],
      peinado: -1,
      cierre: [0.12, 0.08],
      anillos: 44,
      lados: 36,
    }),
    pintorTorso,
    pecho,
  );

  pieza(
    crearTubo({
      puntos: [
        [0, 1.02, 0.05],
        [0, 1.22, 0.12],
        [0, 1.38, 0.16],
      ].map(([x, y, z]) => [x, y - 0.75, z]),
      ancho: perfil([[0, 0.21], [0.5, 0.18], [1, 0.16]]),
      alto: perfil([[0, 0.24], [0.5, 0.2], [1, 0.17]]),
      peinado: -1,
      cierre: [0.05, 0.1],
      anillos: 24,
      lados: 32,
    }),
    pintorCuello,
    pecho,
  );

  // Patas traseras: muslo grande plegado, caña y pie apoyado en el suelo.
  for (const lado of [-1, 1]) {
    const x = (v) => v * lado;
    pieza(
      crearTubo({
        puntos: [
          [x(0.16), 0.42, -0.31],
          [x(0.205), 0.31, -0.15],
          [x(0.215), 0.21, 0.0],
          [x(0.21), 0.17, 0.06],
        ],
        ancho: perfil([[0, 0.13], [0.35, 0.165], [0.75, 0.12], [1, 0.08]]),
        alto: perfil([[0, 0.22], [0.35, 0.2], [0.75, 0.13], [1, 0.08]]),
        cierre: [0.15, 0.15],
        peinado: -1,
      }),
      pintorMuslo,
      cuerpo,
    );
    pieza(
      crearTubo({
        puntos: [
          [x(0.215), 0.19, 0.05],
          [x(0.225), 0.11, -0.08],
          [x(0.23), 0.07, -0.19],
        ],
        ancho: perfil([[0, 0.065], [1, 0.045]]),
        alto: perfil([[0, 0.065], [1, 0.045]]),
        cierre: [0.2, 0.2],
        anillos: 16,
        lados: 20,
      }),
      pintorPata,
      cuerpo,
    );
    pieza(
      crearTubo({
        puntos: [
          [x(0.235), 0.06, -0.2],
          [x(0.245), 0.042, 0.02],
          [x(0.25), 0.035, 0.17],
        ],
        ancho: perfil([[0, 0.045], [0.6, 0.052], [1, 0.042]]),
        alto: perfil([[0, 0.04], [0.6, 0.034], [1, 0.025]]),
        cierre: [0.2, 0.25],
        anillos: 18,
        lados: 20,
      }),
      pintorZarpa,
      cuerpo,
    );
  }

  // Patas delanteras: hombro → codo → zarpa, articuladas para el saludo.
  const patas = [-1, 1].map((lado) => {
    const hombro = new THREE.Group();
    hombro.position.set(0.115 * lado, 0.98, 0.16);
    cuerpo.add(hombro);
    pieza(
      crearTubo({
        puntos: [
          [0, 0.02, 0],
          [0, -0.18, 0.03],
          [0, -0.34, 0.03],
        ],
        ancho: perfil([[0, 0.08], [0.5, 0.07], [1, 0.058]]),
        alto: perfil([[0, 0.09], [0.5, 0.076], [1, 0.06]]),
        cierre: [0.15, 0.12],
        anillos: 18,
        lados: 24,
      }),
      pintorBrazo,
      hombro,
    );
    const antebrazo = new THREE.Group();
    antebrazo.position.set(0, -0.33, 0.03);
    hombro.add(antebrazo);
    pieza(
      crearTubo({
        puntos: [
          [0, 0.03, 0],
          [0, -0.24, 0.01],
          [0, -0.5, 0.02],
        ],
        ancho: perfil([[0, 0.056], [0.5, 0.046], [1, 0.042]]),
        alto: perfil([[0, 0.06], [0.5, 0.05], [1, 0.045]]),
        cierre: [0.1, 0.1],
        anillos: 22,
        lados: 22,
      }),
      pintorAntebrazo,
      antebrazo,
    );
    pieza(
      crearTubo({
        puntos: [
          [0, -0.49, 0.0],
          [0, -0.56, 0.06],
          [0, -0.585, 0.14],
        ],
        ancho: perfil([[0, 0.048], [0.5, 0.055], [1, 0.045]]),
        alto: perfil([[0, 0.045], [0.5, 0.036], [1, 0.026]]),
        cierre: [0.2, 0.25],
        anillos: 16,
        lados: 22,
      }),
      pintorZarpa,
      antebrazo,
    );
    return { hombro, antebrazo };
  });

  // ---------- Cabeza ----------
  const cabeza = new THREE.Group();
  cabeza.rotation.order = 'YXZ';
  cabeza.position.set(0, 1.37, 0.17);
  cuerpo.add(cabeza);

  const geoCabeza = crearTubo({
    puntos: [
      [0, 0.1, -0.2],
      [0, 0.12, -0.06],
      [0, 0.11, 0.08],
      [0, 0.06, 0.22],
      [0, 0.03, 0.36],
      [0, 0.015, 0.5],
      [0, 0.01, 0.56],
    ],
    ancho: perfil([[0, 0.15], [0.12, 0.2], [0.3, 0.215], [0.45, 0.16], [0.62, 0.095], [0.8, 0.066], [1, 0.04]]),
    alto: perfil([[0, 0.15], [0.12, 0.19], [0.3, 0.175], [0.45, 0.125], [0.62, 0.082], [0.8, 0.062], [1, 0.04]]),
    // El hocico tiene sección de triángulo redondeado: más estrecho arriba.
    seccion: (th, s) => [1 - 0.22 * Math.max(0, -Math.sin(th)) * smoothstep(0.45, 0.7, s), 1],
    cierre: [0.14, 0.05],
    peinado: -1,
    anillos: 64,
    lados: 48,
  });
  pieza(geoCabeza, pintorCabeza, cabeza);

  const mandibula = new THREE.Group();
  mandibula.position.set(0, -0.021, 0.2);
  cabeza.add(mandibula);
  pieza(
    crearTubo({
      puntos: [
        [0, 0.0, -0.1],
        [0, -0.012, 0.12],
        [0, -0.018, 0.3],
      ],
      ancho: perfil([[0, 0.08], [0.5, 0.055], [1, 0.03]]),
      alto: perfil([[0, 0.04], [0.5, 0.03], [1, 0.02]]),
      cierre: [0.15, 0.25],
      peinado: -1,
      anillos: 20,
      lados: 24,
    }),
    pintorMandibula,
    mandibula,
  );

  const boca = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 14),
    new THREE.MeshStandardMaterial({ roughness: 0.6 }),
  );
  boca.scale.set(0.045, 0.013, 0.12);
  boca.position.set(0, -0.03, 0.34);
  cabeza.add(boca);

  const nariz = new THREE.Mesh(
    new THREE.SphereGeometry(1, 24, 16),
    new THREE.MeshPhysicalMaterial({ roughness: 0.42, clearcoat: 0.35, clearcoatRoughness: 0.35 }),
  );
  nariz.scale.set(0.029, 0.022, 0.026);
  nariz.position.set(0, 0.016, 0.538);
  cabeza.add(nariz);

  const orejas = [-1, 1].map((lado) => {
    const pivote = new THREE.Group();
    pivote.position.set(0.12 * lado, 0.25, -0.07);
    cabeza.add(pivote);
    pieza(crearOreja({ alto: 0.34, ancho: 0.2, grosor: 0.075 }), pintorOreja, pivote);
    return { pivote, lado };
  });

  const ojos = OJOS.map(({ lado, centro, normal }) => {
    const material = crearMaterialOjo(lado);
    const malla = new THREE.Mesh(
      proyectarParche(geoCabeza, centro, normal, PARCHE_OJO.mitadU, PARCHE_OJO.mitadV),
      material,
    );
    malla.renderOrder = 2;
    cabeza.add(malla);
    return material;
  });

  const marca = crearMaterialMarca();
  const mallaMarca = new THREE.Mesh(
    proyectarParche(
      geoCabeza,
      new THREE.Vector3(0, 0.27, 0.06),
      new THREE.Vector3(0, 0.75, 0.66),
      PARCHE_MARCA.mitadU,
      PARCHE_MARCA.mitadV,
    ),
    marca,
  );
  mallaMarca.renderOrder = 2;
  cabeza.add(mallaMarca);

  // Rasgos de ilustración (cejas y sonrisa): solo en los estilos que los usan.
  const rasgos = new THREE.Group();
  rasgos.visible = false;
  cabeza.add(rasgos);
  for (const lado of [-1, 1]) {
    const ceja = [
      [0.05, 0.222],
      [0.08, 0.243],
      [0.115, 0.249],
      [0.152, 0.234],
    ].map(([x, y]) => new THREE.Vector3(x * lado, y, 0.2));
    rasgos.add(trazoSobre(geoCabeza, ceja, new THREE.Vector3(0.4 * lado, 0.45, 0.8), { radio: 0.0058, color: '#3a1d12' }));
  }
  const sonrisa = [
    [-0.062, -0.006],
    [-0.042, -0.026],
    [-0.018, -0.032],
    [0, -0.024],
    [0.018, -0.032],
    [0.042, -0.026],
    [0.062, -0.006],
  ].map(([x, y]) => new THREE.Vector3(x, y, 0.5));
  rasgos.add(trazoSobre(geoCabeza, sonrisa, new THREE.Vector3(0, -0.15, 1), { radio: 0.0042, color: '#2a1610' }));
  rasgos.add(
    trazoSobre(geoCabeza, [new THREE.Vector3(0, 0.002, 0.53), new THREE.Vector3(0, -0.012, 0.52), new THREE.Vector3(0, -0.024, 0.51)], new THREE.Vector3(0, -0.1, 1), {
      radio: 0.0038,
      color: '#2a1610',
    }),
  );

  // Bigotes: líneas finas que salen del labio superior.
  const materialBigotes = new THREE.LineBasicMaterial({ transparent: true, opacity: 0.7 });
  for (const lado of [-1, 1]) {
    for (let i = 0; i < 4; i++) {
      const raizBigote = new THREE.Vector3(0.05 * lado, 0.0 - i * 0.012, 0.42 + i * 0.012);
      const fin = new THREE.Vector3((0.32 + i * 0.03) * lado, -0.03 - i * 0.05, 0.36 - i * 0.04);
      const medio = raizBigote.clone().lerp(fin, 0.5).add(new THREE.Vector3(0.02 * lado, 0.03, 0.02));
      const curva = new THREE.QuadraticBezierCurve3(raizBigote, medio, fin);
      cabeza.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(curva.getPoints(10)), materialBigotes));
    }
  }

  const colasBase = new THREE.Group();
  colasBase.position.set(0, 0.3, -0.36);
  colasBase.rotation.y = -0.28;
  cuerpo.add(colasBase);

  return {
    raiz,
    cuerpo,
    pecho,
    cabeza,
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
