// De dónde sale la foto de quien escribe. Gmail no la da, así que:
//   - empresas: el logo de su web (servicio de iconos de Google);
//   - direcciones personales (gmail, hotmail…): la foto de Gravatar, si la tiene.
// Si nada funciona, se queda la inicial.

const PERSONALES = new Set([
  'gmail.com', 'googlemail.com', 'hotmail.com', 'hotmail.es', 'outlook.com', 'outlook.es', 'live.com', 'live.es', 'msn.com',
  'yahoo.com', 'yahoo.es', 'ymail.com', 'icloud.com', 'me.com', 'mac.com', 'aol.com', 'proton.me', 'protonmail.com',
  'pm.me', 'gmx.com', 'gmx.es', 'gmx.de', 'yandex.com', 'mail.com', 'zoho.com', 'telefonica.net', 'movistar.es',
]);

// Segundos niveles de país: «bbc.co.uk», «empresa.com.mx».
const SEGUNDO_NIVEL = /^(com|co|org|net|gob|gov|edu|ac|nom|or|ne)$/;

// «news.mail.amazon.es» → «amazon.es».
export function dominioRaiz(dominio = '') {
  const partes = dominio.toLowerCase().replace(/\.$/, '').split('.').filter(Boolean);
  if (partes.length <= 2) return partes.join('.');
  const n = SEGUNDO_NIVEL.test(partes.at(-2)) && partes.at(-1).length === 2 ? 3 : 2;
  return partes.slice(-n).join('.');
}

const EMAIL = /^[^\s@]+@([a-z0-9-]+\.)+[a-z]{2,}$/i;

async function sha256(texto) {
  const huella = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto));
  return [...new Uint8Array(huella)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Lista de direcciones a probar, en orden: { url, tipo: 'foto' | 'logo' }.
export async function candidatosFoto(email) {
  const limpio = String(email ?? '').trim().toLowerCase();
  if (!EMAIL.test(limpio)) return [];
  const raiz = dominioRaiz(limpio.split('@')[1]);
  const gravatar = { url: `https://gravatar.com/avatar/${await sha256(limpio)}?s=128&d=404`, tipo: 'foto' };
  if (PERSONALES.has(raiz) || PERSONALES.has(limpio.split('@')[1])) return [gravatar];
  return [{ url: `https://www.google.com/s2/favicons?domain=${encodeURIComponent(raiz)}&sz=128`, tipo: 'logo' }];
}

// Clave de caché: las personales por dirección, las de empresa por dominio.
export function claveFoto(email) {
  const limpio = String(email ?? '').trim().toLowerCase();
  const dominio = limpio.split('@')[1] ?? '';
  const raiz = dominioRaiz(dominio);
  return PERSONALES.has(raiz) || PERSONALES.has(dominio) ? limpio : raiz;
}
