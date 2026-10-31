// Cifrado de lo delicado que guarda el servidor (el permiso de Google, la
// clave de Groq) con una clave que solo está en los secretos del Worker.
import { aBase64Url, deBase64Url, unir, utf8 } from './base64.js';

async function clave(secreto) {
  const bytes = deBase64Url(secreto ?? '');
  if (bytes.length !== 32) throw new Error('Falta CLAVE_CIFRADO (32 bytes en base64url) en los secretos del servidor.');
  return crypto.subtle.importKey('raw', bytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
}

export async function cifrarTexto(texto, secreto) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const datos = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await clave(secreto), utf8(texto));
  return aBase64Url(unir(iv, new Uint8Array(datos)));
}

export async function descifrarTexto(cifrado, secreto) {
  const bytes = deBase64Url(cifrado);
  const datos = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, await clave(secreto), bytes.slice(12));
  return new TextDecoder().decode(datos);
}

// Huella para guardar tokens de dispositivo sin guardarlos en claro.
export async function huella(texto) {
  return aBase64Url(await crypto.subtle.digest('SHA-256', utf8(texto)));
}

export const aleatorio = (bytes = 32) => aBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
