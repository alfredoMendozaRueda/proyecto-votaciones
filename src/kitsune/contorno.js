import * as THREE from 'three';

// Contorno de "casco invertido" con grosor constante en píxeles: se dibujan
// las caras traseras desplazadas en pantalla a lo largo de la normal. Así el
// trazo no engorda cuando el kitsune se escala ni al acercar la cámara.
export function crearMaterialContorno(color, grosorPx, resolucion) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uGrosor: { value: grosorPx },
      uResolucion: { value: resolucion },
    },
    vertexShader: /* glsl */ `
      uniform float uGrosor;
      uniform vec2 uResolucion;
      void main() {
        vec4 clip = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        vec3 nVista = normalize(normalMatrix * normal);
        vec2 dir = nVista.xy;
        float largo = length(dir);
        if (largo > 1e-5) dir /= largo;
        clip.xy += dir * uGrosor * 2.0 / uResolucion * clip.w;
        gl_Position = clip;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      void main() {
        gl_FragColor = vec4(uColor, 1.0);
        #include <colorspace_fragment>
      }
    `,
    side: THREE.BackSide,
  });
}
