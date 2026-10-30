// Calidad automática: el zorro se ajusta solo a la potencia del equipo.
// Cada nivel reduce algo que cuesta en la tarjeta gráfica: resolución,
// capas de pelo y sombras. De mejor a peor:
export const NIVELES = [
  { nombre: 'alta', resolucion: 1, pelo: 1, sombras: 1024 },
  { nombre: 'media', resolucion: 0.85, pelo: 0.75, sombras: 512 },
  { nombre: 'baja', resolucion: 0.7, pelo: 0.5, sombras: 0 },
  { nombre: 'minima', resolucion: 0.55, pelo: 0.3, sombras: 0 },
];

export const indiceNivel = (nombre) => Math.max(0, NIVELES.findIndex((n) => n.nombre === nombre));

// Decide a partir de cuánto tardan los fotogramas respecto al ritmo deseado
// (1 = llega justo; 2 = va a la mitad de lo que debería). Baja rápido si va
// lento y sube con cautela, para no oscilar entre dos niveles.
export class GestorCalidad {
  constructor({ inicial = 0, aplicar }) {
    this.indice = inicial;
    this.automatico = true;
    this.aplicar = aplicar;
    this.media = 1;
    this.muestras = 0;
    this.tiempo = 0;
    this.holgura = 0;
    aplicar(NIVELES[inicial]);
  }

  get nivel() {
    return NIVELES[this.indice];
  }

  fijar(nombre) {
    if (nombre === 'auto') {
      this.automatico = true;
      return;
    }
    this.automatico = false;
    this.#cambiar(indiceNivel(nombre));
  }

  // proporcion: duración real del fotograma / duración deseada; ms: duración real.
  registrar(proporcion, ms) {
    if (!this.automatico) return;
    this.media += (proporcion - this.media) * 0.05;
    this.muestras++;
    this.tiempo += ms;
    // Decide tras ~60 fotogramas o, en equipos muy lentos, tras 3 s y unos pocos.
    if (this.muestras < 60 && !(this.muestras >= 8 && this.tiempo > 3000)) return;
    if (this.media > 1.35 && this.indice < NIVELES.length - 1) {
      this.#cambiar(this.indice + 1);
    } else if (this.media < 1.08 && this.indice > 0) {
      // Solo sube tras unos 10 s seguidos con margen.
      if (++this.holgura > 600) this.#cambiar(this.indice - 1);
    } else {
      this.holgura = 0;
    }
  }

  #cambiar(indice) {
    if (indice === this.indice) return;
    this.indice = indice;
    this.media = 1;
    this.muestras = 0;
    this.tiempo = 0;
    this.holgura = 0;
    this.aplicar(NIVELES[indice]);
  }
}
