import * as THREE from 'three';

const PASOS_HISTORIAL = 30;
const ESTELA = 7;

function rgba(hex, alfa) {
  const c = new THREE.Color(hex);
  return `rgba(${Math.round(c.r * 255)}, ${Math.round(c.g * 255)}, ${Math.round(c.b * 255)}, ${alfa})`;
}

// Llama en forma de lágrima con halo y núcleo claro, dibujada en un canvas:
// sin imágenes externas, y se regenera al cambiar de paleta.
function texturaLlama(exterior, nucleo) {
  const lienzo = document.createElement('canvas');
  lienzo.width = 128;
  lienzo.height = 192;
  const g = lienzo.getContext('2d');

  const halo = g.createRadialGradient(64, 124, 6, 64, 124, 64);
  halo.addColorStop(0, rgba(exterior, 0.5));
  halo.addColorStop(1, rgba(exterior, 0));
  g.fillStyle = halo;
  g.fillRect(0, 0, 128, 192);

  g.beginPath();
  g.moveTo(64, 14);
  g.bezierCurveTo(80, 58, 102, 88, 98, 124);
  g.bezierCurveTo(94, 160, 34, 160, 30, 124);
  g.bezierCurveTo(26, 88, 48, 58, 64, 14);
  const cuerpo = g.createLinearGradient(0, 14, 0, 160);
  cuerpo.addColorStop(0, rgba(exterior, 0));
  cuerpo.addColorStop(0.35, rgba(exterior, 0.85));
  cuerpo.addColorStop(1, rgba(exterior, 1));
  g.fillStyle = cuerpo;
  g.fill();

  const centro = g.createRadialGradient(64, 124, 2, 64, 120, 26);
  centro.addColorStop(0, rgba(nucleo, 1));
  centro.addColorStop(1, rgba(nucleo, 0));
  g.fillStyle = centro;
  g.beginPath();
  g.ellipse(64, 122, 22, 28, 0, 0, Math.PI * 2);
  g.fill();

  const textura = new THREE.CanvasTexture(lienzo);
  textura.colorSpace = THREE.SRGBColorSpace;
  return textura;
}

// Kitsunebi: fuegos fatuos que orbitan alrededor del zorro dejando una estela.
export class FuegosFatuos {
  constructor(padre, cantidad = 3) {
    this.grupo = new THREE.Group();
    padre.add(this.grupo);
    this.angulo = 0;
    this.textura = null;
    this.llamas = Array.from({ length: cantidad }, (_, i) => {
      const crearSprite = () => {
        const sprite = new THREE.Sprite(
          new THREE.SpriteMaterial({ transparent: true, depthWrite: false }),
        );
        this.grupo.add(sprite);
        return sprite;
      };
      return {
        sprite: crearSprite(),
        estela: Array.from({ length: ESTELA }, crearSprite),
        historial: [],
        fase: (i / cantidad) * Math.PI * 2,
        altura: (i - (cantidad - 1) / 2) * 0.22,
      };
    });
  }

  setColores(exterior, nucleo) {
    this.textura?.dispose();
    this.textura = texturaLlama(exterior, nucleo);
    for (const llama of this.llamas) {
      for (const s of [llama.sprite, ...llama.estela]) {
        s.material.map = this.textura;
        s.material.needsUpdate = true;
      }
    }
  }

  actualizar(dt, t, { brillo, velocidad, radio, visibilidad, centroY }) {
    this.angulo += dt * 0.5 * velocidad;
    const opacidadBase = (0.4 + 0.6 * brillo) * visibilidad;
    this.grupo.visible = visibilidad > 0.002;

    this.llamas.forEach((llama, i) => {
      const a = this.angulo + llama.fase;
      const pos = new THREE.Vector3(
        Math.cos(a) * radio,
        centroY + llama.altura + 0.26 * Math.sin(a * 2 + llama.fase * 1.3),
        Math.sin(a) * radio * 0.6,
      );
      llama.historial.unshift(pos);
      if (llama.historial.length > PASOS_HISTORIAL) llama.historial.pop();

      const parpadeoX = 1 + 0.07 * Math.sin(t * 17 + i * 3.1);
      const parpadeoY = 1 + 0.1 * Math.sin(t * 13 + i * 1.7);
      const tam = 0.26 + 0.1 * brillo;
      llama.sprite.position.copy(pos);
      llama.sprite.scale.set(tam * parpadeoX, tam * 1.5 * parpadeoY, 1);
      llama.sprite.material.opacity = opacidadBase;

      llama.estela.forEach((s, k) => {
        const punto = llama.historial[Math.min(llama.historial.length - 1, (k + 1) * 4)];
        const f = 1 - (k + 1) / (ESTELA + 2);
        s.position.copy(punto);
        s.scale.set(tam * 0.8 * f, tam * 1.2 * f, 1);
        s.material.opacity = opacidadBase * 0.4 * f;
      });
    });
  }
}
