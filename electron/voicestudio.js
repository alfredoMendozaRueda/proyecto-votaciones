// VoiceStudio (https://github.com/debpalash/VoiceStudio) en el mismo ordenador:
// su API local, compatible con la de OpenAI, convierte texto en voz con el
// motor y la voz que elijas allí (también una voz clonada). Solo se habla con
// 127.0.0.1/localhost: el texto no sale del ordenador.

export const URL_VOICESTUDIO = 'http://127.0.0.1:3900';
export const URL_LOCAL = /^http:\/\/(127\.0\.0\.1|localhost):\d{2,5}$/;

const base = (url) => (URL_LOCAL.test(url ?? '') ? url : URL_VOICESTUDIO);

async function pedir(url, ruta, opciones = {}) {
  let respuesta;
  try {
    respuesta = await fetch(`${base(url)}${ruta}`, { ...opciones, signal: AbortSignal.timeout(opciones.espera ?? 120_000) });
  } catch {
    throw new Error('VoiceStudio no está abierto en este ordenador (o usa otro puerto).');
  }
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({}));
    throw new Error(`VoiceStudio: ${datos.error?.message ?? datos.detail ?? respuesta.status}`);
  }
  return respuesta;
}

// Voces disponibles: la del motor por defecto y los perfiles (las tuyas, clonadas o diseñadas).
export async function vocesVoiceStudio(url) {
  const datos = await (await pedir(url, '/v1/audio/voices', { espera: 8000 })).json();
  const perfiles = (datos.voices ?? []).filter((v) => v.type === 'profile').map((v) => ({ id: String(v.voice_id ?? v.id), nombre: String(v.name ?? v.voice_id), idioma: v.language ?? '' }));
  return [{ id: 'default', nombre: 'Voz por defecto del motor', idioma: '' }, ...perfiles];
}

export async function hablarVoiceStudio(url, texto, voz = 'default') {
  const respuesta = await pedir(url, '/v1/audio/speech', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: 'omnivoice', input: String(texto).slice(0, 4000), voice: voz || 'default', response_format: 'mp3', language: 'es' }),
  });
  return new Uint8Array(await respuesta.arrayBuffer());
}
