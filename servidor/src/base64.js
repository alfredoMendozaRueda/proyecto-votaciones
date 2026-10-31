// Base64 «url» sin relleno, el formato de Web Push y de los JWT.
export function aBase64Url(datos) {
  const bytes = datos instanceof Uint8Array ? datos : new Uint8Array(datos);
  let binario = '';
  for (const b of bytes) binario += String.fromCharCode(b);
  return btoa(binario).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function deBase64Url(texto) {
  const normal = texto.replace(/-/g, '+').replace(/_/g, '/');
  const binario = atob(normal + '='.repeat((4 - (normal.length % 4)) % 4));
  return Uint8Array.from(binario, (c) => c.charCodeAt(0));
}

export const unir = (...partes) => {
  const total = new Uint8Array(partes.reduce((n, p) => n + p.length, 0));
  let i = 0;
  for (const p of partes) {
    total.set(p, i);
    i += p.length;
  }
  return total;
};

export const utf8 = (texto) => new TextEncoder().encode(texto);

// Base64 normal (con + / y relleno).
export const deBase64 = (texto) => Uint8Array.from(atob(texto), (c) => c.charCodeAt(0));
