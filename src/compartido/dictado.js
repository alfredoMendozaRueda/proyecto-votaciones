// Dictado: la app graba lo que dices y Whisper lo pasa a texto. El
// reconocimiento de voz del navegador no sirve: en el iPhone falla dentro de
// la app instalada y en Windows (Electron) no existe.
//   1. Whisper de Groq (whisper-large-v3-turbo), con la clave gratuita de Groq.
//   2. Si no hay clave, Whisper en el servidor propio (Workers AI).
import { URL_GROQ } from './groq.js';

export const MAX_AUDIO = 10 * 1024 * 1024;
export const MODELO_WHISPER = 'whisper-large-v3-turbo';

export const extensionAudio = (tipo = '') =>
  /mp4|m4a|aac/.test(tipo) ? 'm4a' : /ogg/.test(tipo) ? 'ogg' : /wav/.test(tipo) ? 'wav' : /mpeg|mp3/.test(tipo) ? 'mp3' : 'webm';

// Whisper a veces «oye» frases de subtítulos en un silencio: si es solo eso, no hay nada.
const FANTASMAS = [
  /^subt[ií]tulos? (realizados|creados) por la comunidad de amara\.org\.?$/i,
  /^gracias por ver(nos| el v[ií]deo)?\.?$/i,
  /^¡?suscr[ií]bete.*$/i,
  /^thank you\.?$/i,
  /^\.+$/,
];
export function limpiarTranscripcion(texto = '') {
  const limpio = String(texto).replace(/\s+/g, ' ').trim();
  return FANTASMAS.some((re) => re.test(limpio)) ? '' : limpio;
}

export async function transcribirGroq({ apiKey, audio, tipo, fetch: hacerFetch = fetch }) {
  if (!audio?.byteLength) throw new Error('No se ha grabado nada.');
  if (audio.byteLength > MAX_AUDIO) throw new Error('La grabación es demasiado larga.');
  const formulario = new FormData();
  formulario.append('file', new Blob([audio], { type: tipo || 'audio/webm' }), `dictado.${extensionAudio(tipo)}`);
  formulario.append('model', MODELO_WHISPER);
  formulario.append('language', 'es');
  formulario.append('response_format', 'json');
  formulario.append('temperature', '0');
  let respuesta;
  try {
    respuesta = await hacerFetch(`${URL_GROQ}/audio/transcriptions`, { method: 'POST', headers: { Authorization: `Bearer ${apiKey}` }, body: formulario });
  } catch {
    throw new Error('No hay conexión con Groq para pasar tu voz a texto.');
  }
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    if (respuesta.status === 401) throw new Error('La clave de Groq no es válida.');
    if (respuesta.status === 429) throw new Error('Has gastado por ahora el dictado gratuito de Groq. Prueba en un rato.');
    throw new Error(`Groq no ha podido pasar tu voz a texto (${datos.error?.message ?? respuesta.status}).`);
  }
  return limpiarTranscripcion(datos.text);
}
