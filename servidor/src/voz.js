// Texto a voz con Workers AI. Aura-2 en español (Deepgram) suena natural; si
// falla o se ha gastado la cuota gratuita del día, MeloTTS, que apenas gasta.
import { IDS_VOCES, MAX_TROZO } from '../../src/compartido/voz.js';
import { deBase64 } from './base64.js';

const AURA = '@cf/deepgram/aura-2-es';
const MELO = '@cf/myshell-ai/melotts';

async function aBytes(resultado) {
  if (!resultado) return new Uint8Array();
  if (resultado instanceof Uint8Array) return resultado;
  if (resultado instanceof ArrayBuffer) return new Uint8Array(resultado);
  if (typeof resultado.getReader === 'function') return new Uint8Array(await new Response(resultado).arrayBuffer());
  if (typeof resultado.audio === 'string') return deBase64(resultado.audio);
  return new Uint8Array();
}

export function validarVoz(datos) {
  const texto = String(datos?.texto ?? '').trim();
  if (!texto) return { error: 'No hay nada que leer.' };
  if (texto.length > MAX_TROZO) return { error: `Como mucho ${MAX_TROZO} caracteres por petición.` };
  const voz = IDS_VOCES.includes(datos?.voz) ? datos.voz : IDS_VOCES[0];
  return { texto, voz };
}

export async function sintetizar(ai, texto, voz) {
  let fallo = null;
  try {
    const audio = await aBytes(await ai.run(AURA, { text: texto, speaker: voz, encoding: 'mp3' }));
    if (audio.byteLength > 100) return { audio, motor: 'aura' };
  } catch (error) {
    fallo = error;
  }
  try {
    const audio = await aBytes(await ai.run(MELO, { prompt: texto, lang: 'es' }));
    if (audio.byteLength > 100) return { audio, motor: 'melo' };
  } catch (error) {
    fallo = error;
  }
  throw new Error(`No se ha podido generar la voz${fallo?.message ? `: ${fallo.message}` : '.'}`);
}
