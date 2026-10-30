import * as THREE from 'three';

// Pelo por capas ("shell texturing"): la misma malla se dibuja varias veces
// inflada a lo largo de la normal; en cada capa solo sobreviven los puntos
// donde hay un pelo, y cada vez menos hacia la punta. Una sola llamada de
// dibujo por pieza gracias al instanciado: gl_InstanceID es el número de capa.
export function crearMaterialesPelaje({ largo, capas, densidad, gravedad = 0.5 }) {
  const base = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 });
  base.onBeforeCompile = (sh) => {
    // La piel bajo el pelo queda en sombra: base más oscura que las puntas.
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n diffuseColor.rgb *= 0.62;',
    );
  };

  const uniforms = {
    uLargo: { value: largo },
    uCapas: { value: capas },
    uDensidad: { value: densidad },
    uGravedad: { value: gravedad },
  };
  const pelo = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 });
  pelo.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, uniforms);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
        attribute float aPelo;
        attribute vec2 aPeloUV;
        attribute vec3 aPeinado;
        uniform float uLargo;
        uniform float uCapas;
        uniform float uGravedad;
        varying float vCapa;
        varying float vPelo;
        varying vec2 vPeloUV;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
        float capa = (float(gl_InstanceID) + 1.0) / uCapas;
        vCapa = capa;
        vPelo = aPelo;
        vPeloUV = aPeloUV;
        // Sale de la piel y se tumba a favor del peinado: así no parece un erizo.
        transformed += objectNormal * uLargo * aPelo * capa * 0.75;
        transformed += aPeinado * uLargo * aPelo * capa * capa * 1.6;
        transformed.y -= uGravedad * uLargo * aPelo * capa * capa;`,
      );
    sh.fragmentShader = sh.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
        uniform float uDensidad;
        varying float vCapa;
        varying float vPelo;
        varying vec2 vPeloUV;
        float azar(vec2 p) {
          p = fract(p * vec2(123.34, 456.21));
          p += dot(p, p + 45.32);
          return fract(p.x * p.y);
        }`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
        vec2 celda = vPeloUV * uDensidad;
        vec2 id = floor(celda);
        vec2 f = fract(celda) - 0.5;
        float h = azar(id);
        vec2 centro = (vec2(azar(id + 7.1), azar(id + 3.7)) - 0.5) * 0.85;
        float radio = (1.0 - vCapa) * (0.45 + 0.2 * h);
        if (length(f - centro) > radio || vCapa > vPelo * (0.6 + 0.4 * h)) discard;
        diffuseColor.rgb *= mix(0.66, 1.12, vCapa);`,
      );
  };
  return { base, pelo, capas, uniforms };
}

// Pieza con pelo: malla base (proyecta sombra y recibe clics) + capas instanciadas.
export function mallaConPelo(geometria, materiales) {
  const base = new THREE.Mesh(geometria, materiales.base);
  base.castShadow = true;
  const capas = new THREE.InstancedMesh(geometria, materiales.pelo, materiales.capas);
  const identidad = new THREE.Matrix4();
  for (let i = 0; i < materiales.capas; i++) capas.setMatrixAt(i, identidad);
  capas.frustumCulled = false;
  base.add(capas);
  return base;
}
