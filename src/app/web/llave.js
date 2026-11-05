// Llave de acceso del dispositivo (WebAuthn, solo la app web/iPhone): con ella
// se comprueba con Face ID (o la huella) que eres tú antes de aprobar un
// dispositivo nuevo en la sincronización, que da acceso a tus claves. Kitsune
// ya no tiene pantalla de bloqueo al abrirse.

// La clave se llama así porque antes también guardaba el bloqueo al abrir.
const CLAVE = 'kitsune.bloqueo';

const aBase64Url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deBase64Url = (texto) => {
  const normal = texto.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normal + '='.repeat((4 - (normal.length % 4)) % 4)), (c) => c.charCodeAt(0));
};
const esIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const nombreBiometria = () => (esIOS() ? 'Face ID' : 'tu huella o tu cara');

export function leerLlave() {
  try {
    const b = JSON.parse(localStorage.getItem(CLAVE));
    return b?.id ? { id: b.id } : null;
  } catch {
    return null;
  }
}

export async function llaveDisponible() {
  try {
    return Boolean(window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()));
  } catch {
    return false;
  }
}

// Crea la llave de acceso (pide Face ID una vez).
export async function crearLlave() {
  const credencial = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Kitsune', id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'Kitsune', displayName: 'Kitsune' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      attestation: 'none',
      timeout: 60_000,
    },
  });
  if (!credencial) throw new Error('No se ha creado la llave.');
  try {
    localStorage.setItem(CLAVE, JSON.stringify({ id: aBase64Url(credencial.rawId) }));
  } catch {
    // Sin almacenamiento: la próxima vez se crea otra.
  }
}

// Face ID: vale si la llave es la nuestra y el dispositivo ha verificado a la persona.
export async function comprobarIdentidad() {
  const b = leerLlave();
  if (!b) return true;
  const respuesta = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: deBase64Url(b.id), transports: ['internal', 'hybrid'] }],
      userVerification: 'required',
      timeout: 60_000,
    },
  });
  if (!respuesta || aBase64Url(respuesta.rawId) !== b.id) return false;
  const datos = new Uint8Array(respuesta.response.authenticatorData);
  // Byte 32 = flags: 0x01 presencia, 0x04 verificación (Face ID / código).
  return (datos[32] & 0x05) === 0x05;
}
