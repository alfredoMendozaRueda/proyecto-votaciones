import * as THREE from 'three';

// Ojo de zorro: almendra estrecha y oblicua, borde negro, casi sin blanco,
// iris ámbar que llena la abertura y pupila en rendija vertical.
const W = 0.064;
const H = 0.04;
export const PARCHE_OJO = { mitadU: W * 1.75, mitadV: H * 1.75 };

// lado: +1 para el ojo en +x, -1 para el de -x. Todo se dibuja en el shader:
// parpadear, entornar, mirar o dilatar la pupila es cambiar un uniform.
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
      uParche: { value: new THREE.Vector2(PARCHE_OJO.mitadU, PARCHE_OJO.mitadV) },
      uApertura: { value: 1 },
      uAlegria: { value: 0 },
      uDilatacion: { value: 0.25 },
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
      uniform float uDilatacion;
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
        float xn = q.x * uLado / W;          // +1 = rabillo exterior
        float x = clamp(xn, -1.0, 1.0);
        float aa = max(fwidth(q.y), 1e-5);

        // Párpados: almendra oblicua, con el rabillo exterior más alto.
        float incl = 0.32 * H * x;
        float sup = incl + curva(x, 0.78 * H, 0.55);
        float inf = incl - curva(x, 0.52 * H, 0.8);
        float cerrado = inf + curva(x, 0.12 * H, 1.0);
        float abierto = clamp(uApertura, 0.0, 1.0);
        float supEf = mix(cerrado, sup, abierto) + max(uApertura - 1.0, 0.0) * curva(x, 0.6 * H, 0.55);
        // Alegría: los ojos se entornan desde abajo, como al sonreír.
        float f = pow(max(1.0 - x * x, 0.0), 0.6);
        supEf = mix(supEf, min(supEf, incl + 0.36 * H * f), uAlegria);
        float infEf = mix(inf, incl - 0.02 * H * f, uAlegria * 0.85);
        float dentro = banda(q.y, infEf, supEf, aa) * step(abs(xn), 1.0);

        // Iris: llena la abertura; aro oscuro, fibras y reflejo del cielo arriba.
        float rI = 0.98 * H;
        vec2 cI = vec2(uMirada.x * 0.016, uMirada.y * 0.01 + 0.1 * H);
        vec2 dI = q - cI;
        float t = length(dI) / rI;
        float aaT = max(fwidth(t), 1e-4);
        float enIris = 1.0 - smoothstep(1.0 - aaT, 1.0 + aaT, t);
        vec3 iris = mix(uIrisClaro, uIris, smoothstep(0.15, 0.65, t));
        iris = mix(iris, uIrisOscuro, smoothstep(0.7, 1.0, t));
        float fibras = sin(atan(dI.y, dI.x) * 26.0) * 0.5 + sin(atan(dI.y, dI.x) * 61.0) * 0.5;
        iris *= 1.0 + 0.1 * fibras * smoothstep(0.3, 0.85, t);
        iris += 0.12 * smoothstep(-0.2, 0.9, dI.y / rI) * (1.0 - t) * vec3(1.0, 0.95, 0.85);

        // Pupila en rendija vertical, más redonda al dilatarse.
        float anchoP = rI * (0.12 + 0.3 * uDilatacion);
        float altoP = rI * (0.82 - 0.1 * uDilatacion);
        float pu = abs(dI.x) / anchoP + (dI.y / altoP) * (dI.y / altoP);
        float aaP = max(fwidth(pu), 1e-4);
        iris = mix(iris, uPupila, 1.0 - smoothstep(1.0 - aaP, 1.0 + aaP, pu));
        vec3 color = mix(uEsclera, iris, enIris);

        // Sombra que proyecta el párpado sobre el globo ocular.
        color *= mix(0.3, 1.0, smoothstep(0.0, 0.35 * H, supEf - q.y));

        // Brillos de la córnea: uno nítido de la luz principal y otro tenue.
        float b1 = 1.0 - smoothstep(0.7, 1.0, length((q - cI - vec2(0.3 * rI, 0.38 * rI)) / vec2(0.17, 0.13) / rI));
        float b2 = 1.0 - smoothstep(0.6, 1.0, length(q - cI - vec2(-0.32 * rI, -0.4 * rI)) / (0.07 * rI));
        color = mix(color, vec3(1.0), (0.95 * b1 + 0.6 * b2) * dentro);

        // Borde negro de los párpados, más grueso arriba.
        float gs = (0.0045 + 0.004 * smoothstep(-0.5, 1.0, xn)) * smoothstep(-1.05, -0.8, xn);
        float gi = 0.0035 * smoothstep(-1.0, -0.6, xn);
        float extra = max(xn - 1.0, 0.0);
        float baseSup = supEf + extra * 0.35 * H;
        float bordeSup = banda(q.y, baseSup - 0.3 * gs, baseSup + gs * (1.0 - smoothstep(0.0, 0.22, extra)), aa)
          * step(-1.0, xn) * step(xn, 1.22);
        float bordeInf = banda(q.y, infEf - gi, infEf + 0.2 * gi, aa) * step(-1.0, xn) * step(xn, 1.0)
          * smoothstep(0.05, 0.4, uApertura);

        // Lagrimal: la muesca oscura que baja hacia el hocico, típica del zorro.
        float tLag = clamp((-0.85 - xn) / 0.55, 0.0, 1.0);
        float yLag = incl * 0.0 - 0.32 * H - tLag * 0.85 * H;
        float gLag = 0.006 * (1.0 - tLag);
        float lagrimal = banda(q.y, yLag - gLag, yLag + gLag, aa) * step(xn, -0.85) * step(-1.4, xn);

        // Pincelada roja de kitsune sobre el rabillo.
        float baseMarca = baseSup + gs + 0.004 + extra * 0.3 * H;
        float gm = 0.0042 * smoothstep(0.35, 0.75, xn) * (1.0 - smoothstep(1.15, 1.6, xn));
        float marca = banda(q.y, baseMarca, baseMarca + gm, aa);

        float linea = max(max(bordeSup, bordeInf), lagrimal);
        vec4 c = vec4(color, dentro);
        c.rgb = mix(c.rgb, uLinea, linea);
        c.a = max(c.a, linea);
        c.rgb = mix(c.rgb, uMarca, marca);
        c.a = max(c.a, marca);
        c.a *= step(-1.4, xn);
        if (c.a < 0.01) discard;
        gl_FragColor = c;
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}

export function colorearOjo(material, paleta) {
  const u = material.uniforms;
  u.uIris.value.set(paleta.iris);
  u.uIrisClaro.value.set(paleta.iris).lerp(new THREE.Color('#fff0b8'), 0.5);
  u.uIrisOscuro.value.set(paleta.iris).multiplyScalar(0.3);
  u.uPupila.value.set('#050303');
  u.uEsclera.value.set(paleta.esclera);
  u.uLinea.value.set('#0a0605');
  u.uMarca.value.set(paleta.marca);
}

// Marca de la frente: llama central y dos pinceladas laterales, como en las
// máscaras de kitsune. uBrillo la hace latir cuando el zorro piensa.
export const PARCHE_MARCA = { mitadU: 0.075, mitadV: 0.075 };

export function crearMaterialMarca() {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    uniforms: {
      uColor: { value: new THREE.Color() },
      uBrillo: { value: 0 },
      uParche: { value: new THREE.Vector2(PARCHE_MARCA.mitadU, PARCHE_MARCA.mitadV) },
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
      uniform vec3 uColor;
      uniform float uBrillo;
      varying vec2 vQ;

      // Gota alargada: base redonda en 'base', punta afilada hacia 'dir'.
      float gota(vec2 p, vec2 base, vec2 dir, float largo, float ancho) {
        vec2 d = normalize(dir);
        vec2 r = p - base;
        float t = dot(r, d) / largo;
        float lateral = abs(r.x * d.y - r.y * d.x);
        float w = ancho * pow(max(sin(3.14159 * clamp(t, 0.0, 1.0)), 0.0), 0.5) * pow(max(1.0 - t, 0.0), 0.7);
        return w - lateral;
      }

      void main() {
        vec2 p = vQ;
        float sd = gota(p, vec2(0.0, -0.045), vec2(0.0, 1.0), 0.1, 0.019);
        sd = max(sd, gota(p, vec2(-0.03, -0.03), vec2(-0.55, 1.0), 0.055, 0.009));
        sd = max(sd, gota(p, vec2(0.03, -0.03), vec2(0.55, 1.0), 0.055, 0.009));
        float aa = max(fwidth(sd), 1e-5);
        float a = smoothstep(-aa, aa, sd) * 0.92;
        if (a < 0.01) discard;
        vec3 color = uColor * (1.0 + 0.6 * uBrillo);
        gl_FragColor = vec4(color, a);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }
    `,
  });
}
