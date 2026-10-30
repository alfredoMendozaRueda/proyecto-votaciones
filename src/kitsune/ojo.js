import * as THREE from 'three';

// Medidas del ojo en unidades de la cabeza: semiancho y semialto del almendrado.
// El parche es más grande para que quepan la raya del párpado y el trazo rojo.
const W = 0.125;
const H = 0.092;
const PARCHE = new THREE.Vector2(W * 1.6, H * 1.45);

// Parche curvo que se apoya sobre el cráneo (un elipsoide): se parte de un
// plano tangente y cada vértice se proyecta sobre la superficie, así el ojo
// queda pintado sobre la cabeza en lugar de sobresalir como una pegatina.
export function crearGeometriaOjo(centro, radios, direccion) {
  const d = direccion.clone().normalize();
  const punto = new THREE.Vector3(d.x * radios.x, d.y * radios.y, d.z * radios.z).add(centro);
  const normal = new THREE.Vector3(d.x / radios.x, d.y / radios.y, d.z / radios.z).normalize();
  const u = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), normal).normalize();
  const v = new THREE.Vector3().crossVectors(normal, u).normalize();

  const geometria = new THREE.PlaneGeometry(PARCHE.x * 2, PARCHE.y * 2, 20, 14);
  const pos = geometria.attributes.position;
  const p = new THREE.Vector3();
  const n = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    p.copy(punto).addScaledVector(u, pos.getX(i)).addScaledVector(v, pos.getY(i)).sub(centro);
    p.divideScalar(Math.hypot(p.x / radios.x, p.y / radios.y, p.z / radios.z));
    n.set(p.x / radios.x ** 2, p.y / radios.y ** 2, p.z / radios.z ** 2).normalize();
    p.add(centro).addScaledVector(n, 0.004);
    pos.setXYZ(i, p.x, p.y, p.z);
  }
  geometria.computeVertexNormals();
  return geometria;
}

// lado: +1 ojo derecho del zorro (a la izquierda en pantalla), -1 el izquierdo.
// Todo el dibujo es procedural en el shader: forma, párpado, iris, pupila,
// brillos y trazos; así parpadear, entornar o mirar es cambiar un uniform.
export function crearMaterialOjo(lado) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: {
      uLado: { value: lado },
      uMedio: { value: new THREE.Vector2(W, H) },
      uParche: { value: PARCHE },
      uApertura: { value: 1 },
      uAlegria: { value: 0 },
      uMirada: { value: new THREE.Vector2() },
      uIris: { value: new THREE.Color() },
      uIrisClaro: { value: new THREE.Color() },
      uIrisOscuro: { value: new THREE.Color() },
      uPupila: { value: new THREE.Color() },
      uEsclera: { value: new THREE.Color() },
      uLinea: { value: new THREE.Color() },
      uMarca: { value: new THREE.Color() },
    },
    vertexShader: /* glsl */ `
      uniform vec2 uParche;
      varying vec2 vQ;
      void main() {
        vQ = (uv * 2.0 - 1.0) * uParche;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uLado;
      uniform vec2 uMedio;
      uniform float uApertura;
      uniform float uAlegria;
      uniform vec2 uMirada;
      uniform vec3 uIris;
      uniform vec3 uIrisClaro;
      uniform vec3 uIrisOscuro;
      uniform vec3 uPupila;
      uniform vec3 uEsclera;
      uniform vec3 uLinea;
      uniform vec3 uMarca;
      varying vec2 vQ;

      float curva(float x, float alto, float potencia) {
        return alto * pow(max(1.0 - x * x, 0.0), potencia);
      }

      float banda(float y, float desde, float hasta, float aa) {
        return smoothstep(desde - aa, desde + aa, y) * (1.0 - smoothstep(hasta - aa, hasta + aa, y));
      }

      void main() {
        float W = uMedio.x;
        float H = uMedio.y;
        vec2 q = vQ;
        // xn = +1 en el rabillo exterior de cada ojo (espejo según el lado).
        float xn = q.x * uLado / W;
        float x = clamp(xn, -1.0, 1.0);
        float aa = max(fwidth(q.y), 1e-4);

        // Párpados: almendra con el rabillo exterior levantado.
        float incl = 0.24 * H * x;
        float sup = incl + curva(x, 0.8 * H, 0.5);
        float inf = incl - curva(x, 0.62 * H, 0.75);
        float cerrado = inf + curva(x, 0.14 * H, 1.0);
        float abierto = clamp(uApertura, 0.0, 1.0);
        float supEf = mix(cerrado, sup, abierto) + max(uApertura - 1.0, 0.0) * curva(x, 0.7 * H, 0.5);
        float infEf = inf;
        // Alegría: el párpado inferior sube hasta dejar un arco ^.
        float arco = incl + curva(x, 0.45 * H, 0.7) - 0.06 * H;
        supEf = mix(supEf, arco, uAlegria);
        infEf = mix(infEf, arco - 0.001, uAlegria);

        float dentro = banda(q.y, infEf, supEf, aa) * step(abs(xn), 1.0);

        // Iris grande con degradado, fibras y pupila ovalada vertical.
        float rI = 0.8 * H;
        vec2 cI = vec2(uMirada.x * 0.026, uMirada.y * 0.016 + 0.04 * H);
        vec2 dI = q - cI;
        float t = length(dI) / rI;
        float aaT = max(fwidth(t), 1e-4);
        float enIris = 1.0 - smoothstep(1.0 - aaT, 1.0 + aaT, t);
        vec3 iris = mix(uIrisClaro, uIris, smoothstep(0.1, 0.7, t));
        iris = mix(iris, uIrisOscuro, smoothstep(0.74, 1.0, t));
        iris *= 1.0 + 0.08 * sin(atan(dI.y, dI.x) * 22.0) * smoothstep(0.35, 0.8, t);
        iris = mix(iris, uIrisClaro, 0.45 * smoothstep(0.1, 0.9, -dI.y / rI) * (1.0 - smoothstep(0.8, 1.0, t)));
        float pu = length(dI / vec2(0.3 * rI, 0.64 * rI));
        float aaP = max(fwidth(pu), 1e-4);
        iris = mix(iris, uPupila, 1.0 - smoothstep(1.0 - aaP, 1.0 + aaP, pu));
        vec3 color = mix(uEsclera, iris, enIris);

        // Sombra que proyecta el párpado superior: da profundidad al ojo.
        color *= mix(0.5, 1.0, smoothstep(0.0, 0.03, supEf - q.y));

        // Brillos (mismo lado en los dos ojos, como una sola fuente de luz).
        float b1 = 1.0 - smoothstep(0.8, 1.0, length(q - cI - vec2(0.022, 0.024)) / (0.27 * rI));
        float b2 = 1.0 - smoothstep(0.75, 1.0, length(q - cI - vec2(-0.02, -0.022)) / (0.12 * rI));
        color = mix(color, vec3(1.0), max(b1, 0.85 * b2) * enIris);

        // Raya del párpado superior, que se prolonga en un rabillo afilado.
        float extra = max(xn - 1.0, 0.0);
        float grosor = (0.011 + 0.012 * smoothstep(-0.6, 0.9, xn)) * smoothstep(-1.02, -0.7, xn);
        grosor *= 1.0 - smoothstep(0.0, 0.32, extra);
        float baseRaya = supEf + extra * 0.55 * H;
        float raya = banda(q.y, baseRaya - 0.25 * grosor, baseRaya + grosor, aa)
          * step(xn, 1.32) * step(-1.0, xn);

        // Trazo rojo de máscara kitsune por encima del rabillo.
        float baseMarca = baseRaya + grosor + 0.011 + extra * 0.35 * H;
        float grosorMarca = 0.011 * smoothstep(0.45, 0.8, xn) * (1.0 - smoothstep(1.15, 1.5, xn));
        float marca = banda(q.y, baseMarca, baseMarca + grosorMarca, aa) * (1.0 - uAlegria * 0.4);

        // Línea fina del párpado inferior, se apaga al cerrar o entornar.
        float lineaInf = banda(q.y, infEf - 0.006, infEf + 0.001, aa)
          * smoothstep(-0.4, 0.2, xn) * step(xn, 1.0)
          * smoothstep(0.15, 0.6, uApertura) * (1.0 - uAlegria);

        float alfaLinea = max(raya, 0.8 * lineaInf);
        vec4 c = vec4(color, dentro);
        c.rgb = mix(c.rgb, uLinea, alfaLinea);
        c.a = max(c.a, alfaLinea);
        c.rgb = mix(c.rgb, uMarca, marca);
        c.a = max(c.a, marca);
        // Nada se dibuja más allá del lagrimal: ahí el parche solo es hueco.
        c.a *= step(-1.0, xn);
        if (c.a < 0.01) discard;
        gl_FragColor = c;
        #include <colorspace_fragment>
      }
    `,
  });
}

// Deriva los tonos del iris a partir de un color base de la paleta.
export function colorearOjo(material, paleta) {
  const u = material.uniforms;
  u.uIris.value.set(paleta.iris);
  u.uIrisClaro.value.set(paleta.iris).lerp(new THREE.Color('#fff4d6'), 0.55);
  u.uIrisOscuro.value.set(paleta.iris).multiplyScalar(0.35);
  u.uPupila.value.set(paleta.pupila);
  u.uEsclera.value.set(paleta.esclera);
  u.uLinea.value.set(paleta.linea);
  u.uMarca.value.set(paleta.marca);
}
