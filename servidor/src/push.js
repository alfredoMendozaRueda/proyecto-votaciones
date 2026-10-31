// Web Push sin dependencias: firma VAPID (RFC 8292) y cifrado aes128gcm
// (RFC 8291) con WebCrypto, que tienen igual Cloudflare Workers y Node.
import { aBase64Url, deBase64Url, unir, utf8 } from './base64.js';

const CURVA = { name: 'ECDSA', namedCurve: 'P-256' };

// Par de claves VAPID del servidor: la pública la usa el navegador al suscribirse.
export async function generarVapid() {
  const par = await crypto.subtle.generateKey(CURVA, true, ['sign', 'verify']);
  return {
    privada: await crypto.subtle.exportKey('jwk', par.privateKey),
    publica: aBase64Url(await crypto.subtle.exportKey('raw', par.publicKey)),
  };
}

// JWT ES256 que demuestra al servicio de push que el aviso viene de este servidor.
export async function firmaVapid(audiencia, vapid, contacto, ahora = Date.now()) {
  const cabecera = aBase64Url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const carga = aBase64Url(utf8(JSON.stringify({ aud: audiencia, exp: Math.floor(ahora / 1000) + 12 * 3600, sub: contacto })));
  const clave = await crypto.subtle.importKey('jwk', vapid.privada, CURVA, false, ['sign']);
  const firma = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, clave, utf8(`${cabecera}.${carga}`));
  return `${cabecera}.${carga}.${aBase64Url(firma)}`;
}

async function hkdf(sal, material, info, bytes) {
  const clave = await crypto.subtle.importKey('raw', material, 'HKDF', false, ['deriveBits']);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: sal, info }, clave, bytes * 8));
}

// Cifra el mensaje para una suscripción concreta (solo ese navegador puede leerlo).
export async function cifrar(suscripcion, mensaje, sal = crypto.getRandomValues(new Uint8Array(16))) {
  const publicaUA = deBase64Url(suscripcion.keys.p256dh);
  const secretoAuth = deBase64Url(suscripcion.keys.auth);
  const efimera = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const publicaAS = new Uint8Array(await crypto.subtle.exportKey('raw', efimera.publicKey));
  const claveUA = await crypto.subtle.importKey('raw', publicaUA, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const compartido = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: claveUA }, efimera.privateKey, 256));

  const ikm = await hkdf(secretoAuth, compartido, unir(utf8('WebPush: info\0'), publicaUA, publicaAS), 32);
  const cek = await hkdf(sal, ikm, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdf(sal, ikm, utf8('Content-Encoding: nonce\0'), 12);
  const claveAES = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  // Un solo registro: el mensaje y el delimitador 0x02 de «último registro».
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, claveAES, unir(utf8(mensaje), new Uint8Array([2]))));

  const tamRegistro = new Uint8Array([0, 0, 16, 0]); // 4096
  return unir(sal, tamRegistro, new Uint8Array([publicaAS.length]), publicaAS, cifrado);
}

// Envía un aviso. Devuelve 'ok', 'caducada' (hay que olvidar la suscripción) o 'error'.
export async function enviarPush(suscripcion, datos, vapid, { contacto, ttl = 24 * 3600, urgencia = 'normal', fetch: f = fetch } = {}) {
  const destino = new URL(suscripcion.endpoint);
  const jwt = await firmaVapid(destino.origin, vapid, contacto);
  const respuesta = await f(suscripcion.endpoint, {
    method: 'POST',
    headers: {
      'Content-Encoding': 'aes128gcm',
      'Content-Type': 'application/octet-stream',
      TTL: String(ttl),
      Urgency: urgencia,
      Authorization: `vapid t=${jwt}, k=${vapid.publica}`,
    },
    body: await cifrar(suscripcion, JSON.stringify(datos)),
  });
  if (respuesta.status === 404 || respuesta.status === 410) return 'caducada';
  return respuesta.ok ? 'ok' : 'error';
}
