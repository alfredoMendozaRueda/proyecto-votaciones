// Voz de Kitsune. Las voces naturales son las de Aura-2 en español (Deepgram,
// a través de Workers AI en el servidor propio); si no hay servidor, se usan
// las voces del dispositivo.

export const VOCES = [
  { id: 'diana', nombre: 'Diana', detalle: 'mujer · España' },
  { id: 'carina', nombre: 'Carina', detalle: 'mujer · España, enérgica' },
  { id: 'nestor', nombre: 'Néstor', detalle: 'hombre · España' },
  { id: 'alvaro', nombre: 'Álvaro', detalle: 'hombre · España, sereno' },
  { id: 'estrella', nombre: 'Estrella', detalle: 'mujer · México' },
  { id: 'celeste', nombre: 'Celeste', detalle: 'mujer · Colombia' },
  { id: 'selena', nombre: 'Selena', detalle: 'mujer · Latinoamérica' },
  { id: 'sirio', nombre: 'Sirio', detalle: 'hombre · México, grave' },
  { id: 'javier', nombre: 'Javier', detalle: 'hombre · México' },
  { id: 'aquila', nombre: 'Áquila', detalle: 'hombre · Latinoamérica' },
];
export const IDS_VOCES = VOCES.map((v) => v.id);

// Lo que se pide al servidor de una vez (y lo máximo que acepta).
export const MAX_TROZO = 600;
// Una respuesta muy larga solo se lee hasta aquí: la cuota gratuita es diaria.
export const MAX_LECTURA = 2400;

// Sin markdown, enlaces, código ni emojis: lo que se oiría raro.
export function limpiarParaVoz(texto = '') {
  return String(texto)
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/`([^`]*)`/g, '$1')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/[*_~#>|]/g, '')
    .replace(/\p{Extended_Pictographic}️?/gu, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

// Trozos de frases enteras, para que el primero suene enseguida.
export function trozosDeVoz(texto, max = MAX_TROZO) {
  const limpio = limpiarParaVoz(texto).slice(0, MAX_LECTURA);
  const frases = limpio.match(/[^.!?…\n]+[.!?…]*[\n]?|[\n]/g) ?? [];
  const trozos = [];
  let actual = '';
  for (const bruta of frases) {
    const frase = bruta.trim();
    if (!frase) continue;
    // Una frase más larga que el máximo se corta por comas o, si no hay, a palo seco.
    const partes = frase.length > max ? frase.match(new RegExp(`.{1,${max}}(?:[,;:]\\s|\\s|$)`, 'g')) : [frase];
    for (const parte of partes) {
      const p = parte.trim();
      // El primer trozo, corto: así empieza a hablar antes.
      const limite = trozos.length === 0 ? Math.min(max, 160) : max;
      if (actual && (actual + ' ' + p).length > limite) {
        trozos.push(actual);
        actual = p;
      } else {
        actual = actual ? `${actual} ${p}` : p;
      }
    }
  }
  if (actual) trozos.push(actual);
  return trozos;
}
