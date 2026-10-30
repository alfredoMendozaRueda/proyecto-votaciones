import * as THREE from 'three';

// Estilos de dibujo del zorro. No cambian la geometría: cambian el material
// (pelo por capas o sombreado de dibujo animado), el contorno, las
// proporciones (la cría de cabeza grande) y el tamaño de la pupila.
//   realista: pelo por capas y luz suave (el de siempre).
//   anime:    sombreado en dos tonos, colores vivos y contorno marcado.
//   kawaii:   cría, colores pastel, contorno suave, pupilas grandes y coloretes.
//   tinta:    sumi-e: grises de tinta sobre papel con trazo negro; las marcas
//             y los fuegos siguen en rojo.
// Valores comunes; cada estilo cambia solo lo suyo.
const BASE = {
  pelo: true,
  toon: null,
  contorno: null,
  bebe: 0,
  dilatacion: 0,
  apertura: 1,
  bigotes: 0.7,
  caricatura: 0, // ojos de ilustración (redondos, iris marrón y brillos)
  rasgos: false, // cejas y sonrisa
  marca: true, // marca roja de la frente
  orejas: [1, 1], // ancho y alto de las orejas
  cabeza: 1, // tamaño extra de la cabeza
  patas: 1, // grosor de las patas
  hocico: 1,
  abanico: 0, // colas más abiertas en abanico
  colas: 1, // grosor de las colas
  punta: 0.86, // dónde empieza la punta clara de las colas (0 = raíz, 1 = punta)
  retoques: null, // ajustes de color sobre el pelaje elegido
};

export const ESTILOS = {
  // Como la ilustración de referencia: cría de peluche, ojos grandes y
  // redondos, cejas, sonrisa, calcetines chocolate y nueve colas en abanico
  // que pasan del naranja al crema sin banda oscura.
  ilustracion: {
    ...BASE,
    nombre: 'Ilustración',
    bebe: 1,
    colas: 1.45,
    punta: 0.62,
    dilatacion: 0.35,
    apertura: 1.15,
    bigotes: 0,
    caricatura: 1,
    rasgos: true,
    marca: false,
    orejas: [1.4, 1.12],
    cabeza: 1.12,
    patas: 1.35,
    hocico: 0.74,
    abanico: 0.45,
    retoques: (p) => ({
      bandaCola: p.flanco,
      iris: '#6e3d1c',
      medias: mezclar(p.medias, '#4a2414', 0.7),
      orejaDorso: mezclar(p.orejaDorso, '#3a1d12', 0.6),
    }),
  },
  realista: { ...BASE, nombre: 'Realista' },
  anime: {
    ...BASE,
    nombre: 'Anime',
    pelo: false,
    toon: { rampa: [0.5, 1], saturacion: 1.18 },
    contorno: { color: '#160b09', grosor: 0.011 },
    bebe: 0.25,
    dilatacion: 0.12,
    apertura: 1.1,
    bigotes: 0.9,
  },
  kawaii: {
    ...BASE,
    nombre: 'Kawaii',
    caricatura: 1,
    rasgos: true,
    hocico: 0.88,
    retoques: (p) => ({ iris: '#6e3d1c' }),
    pelo: false,
    toon: { rampa: [0.7, 0.88, 1], pastel: 0.08, saturacion: 1.08 },
    contorno: { color: '#5b2c22', grosor: 0.013 },
    bebe: 1,
    dilatacion: 0.8,
    apertura: 1.25,
    coloretes: true,
    bigotes: 0.3,
  },
  tinta: {
    ...BASE,
    nombre: 'Tinta',
    pelo: false,
    toon: { rampa: [0.38, 0.78, 1], tinta: true },
    contorno: { color: '#0a0706', grosor: 0.02 },
    bebe: 0,
    dilatacion: 0,
    apertura: 1,
    bigotes: 1,
  },
};

// Mezcla dos colores hexadecimales (t = 0, el primero; 1, el segundo).
function mezclar(a, b, t) {
  return `#${new THREE.Color(a).lerp(new THREE.Color(b), t).getHexString()}`;
}

// Escalera de luz del sombreado: pocos tonos, sin degradado entre ellos.
function crearRampa(valores) {
  const datos = new Uint8Array(valores.map((v) => Math.round(v * 255)));
  const textura = new THREE.DataTexture(datos, valores.length, 1, THREE.RedFormat);
  textura.minFilter = THREE.NearestFilter;
  textura.magFilter = THREE.NearestFilter;
  textura.generateMipmaps = false;
  textura.needsUpdate = true;
  return textura;
}

export function crearMaterialDibujo({ rampa, pastel = 0, saturacion = 1, tinta = false }) {
  const material = new THREE.MeshToonMaterial({ vertexColors: true, gradientMap: crearRampa(rampa) });
  const ajustes = [];
  if (saturacion !== 1) {
    ajustes.push(`diffuseColor.rgb = max(mix(vec3(dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114))), diffuseColor.rgb, ${saturacion.toFixed(2)}), 0.0);`);
  }
  if (pastel) ajustes.push(`diffuseColor.rgb = mix(diffuseColor.rgb * 1.1, vec3(1.0, 0.97, 0.95), ${pastel.toFixed(2)});`);
  if (tinta) {
    // Del color a la tinta: lo oscuro, negro de sumi; lo claro, papel.
    ajustes.push(`float l = smoothstep(0.04, 0.8, dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114)));
      diffuseColor.rgb = mix(vec3(0.05, 0.045, 0.045), vec3(0.9, 0.87, 0.81), l * l);`);
  }
  material.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>\n${ajustes.join('\n')}`);
  };
  material.customProgramCacheKey = () => JSON.stringify({ rampa, pastel, saturacion, tinta });
  return material;
}

// Contorno de casco invertido: la misma malla, hinchada y vista por detrás.
export function crearMaterialContorno({ color, grosor }) {
  const material = new THREE.MeshBasicMaterial({ color, side: THREE.BackSide });
  material.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace(
      '#include <begin_vertex>',
      `#include <begin_vertex>\ntransformed += normalize(normal) * ${grosor.toFixed(4)};`,
    );
  };
  material.customProgramCacheKey = () => `contorno-${grosor}`;
  return material;
}

// Coloretes de la versión kawaii: dos manchas rosadas y difusas en las mejillas.
export function crearColoretes() {
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = 64;
  const ctx = lienzo.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255, 110, 130, 1)');
  g.addColorStop(1, 'rgba(255, 120, 140, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({
    map: textura,
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const grupo = new THREE.Group();
  for (const lado of [-1, 1]) {
    const mancha = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.075), material);
    mancha.position.set(0.122 * lado, 0.035, 0.24);
    mancha.lookAt(mancha.position.clone().add(new THREE.Vector3(0.75 * lado, -0.1, 0.65)));
    mancha.renderOrder = 3;
    grupo.add(mancha);
  }
  grupo.visible = false;
  return grupo;
}
