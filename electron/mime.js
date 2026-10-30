// Utilidades puras para los mensajes de la API de Gmail: descodificar cuerpos
// y cabeceras, y construir correos RFC 2822 para enviar. Sin dependencias de
// Electron, para poder probarlas con node:test.

export function base64UrlABuffer(datos = '') {
  return Buffer.from(datos.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function bufferABase64Url(buffer) {
  return Buffer.from(buffer).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function cabecera(partes, nombre) {
  const h = (partes || []).find((x) => x.name.toLowerCase() === nombre.toLowerCase());
  return h ? h.value : '';
}

export function obtenerCabecera(payload, nombre) {
  return decodificarPalabras(cabecera(payload?.headers, nombre));
}

function charsetDe(parte) {
  const tipo = cabecera(parte.headers, 'Content-Type');
  const m = /charset="?([^";\s]+)"?/i.exec(tipo);
  return m ? m[1].toLowerCase() : 'utf-8';
}

function decodificarTexto(buffer, charset) {
  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder('utf-8').decode(buffer);
  }
}

// Cabeceras con "encoded-words" (RFC 2047), por si la API no las devuelve ya descodificadas.
export function decodificarPalabras(valor = '') {
  return valor.replace(/=\?([^?]+)\?([bqBQ])\?([^?]*)\?=(\s+(?==\?))?/g, (_, charset, modo, texto) => {
    const bytes =
      modo.toUpperCase() === 'B'
        ? Buffer.from(texto, 'base64')
        : Buffer.from(
            texto.replace(/_/g, ' ').replace(/=([0-9A-Fa-f]{2})/g, (_m, h) => String.fromCharCode(parseInt(h, 16))),
            'latin1',
          );
    return decodificarTexto(bytes, charset.toLowerCase());
  });
}

// Recorre las partes MIME y se queda con el HTML (o el texto plano) y la lista de adjuntos.
export function extraerCuerpo(payload) {
  const resultado = { html: '', texto: '', adjuntos: [] };
  const visitar = (parte) => {
    if (!parte) return;
    const tipo = (parte.mimeType || '').toLowerCase();
    if (parte.filename) {
      resultado.adjuntos.push({ nombre: parte.filename, tipo, tamano: parte.body?.size ?? 0 });
      return;
    }
    if (parte.parts?.length) {
      parte.parts.forEach(visitar);
      return;
    }
    if (!parte.body?.data) return;
    const contenido = decodificarTexto(base64UrlABuffer(parte.body.data), charsetDe(parte));
    if (tipo === 'text/html' && !resultado.html) resultado.html = contenido;
    else if (tipo === 'text/plain' && !resultado.texto) resultado.texto = contenido;
  };
  visitar(payload);
  return resultado;
}

const ENTIDADES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodificarEntidades(texto = '') {
  return texto.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const n = e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      return Number.isFinite(n) ? String.fromCodePoint(n) : m;
    }
    return ENTIDADES[e.toLowerCase()] ?? m;
  });
}

// Texto legible a partir de HTML, para pasárselo a Claude sin etiquetas.
export function htmlATexto(html = '') {
  return decodificarEntidades(
    html
      .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|tr|li|h[1-6])>/gi, '\n')
      .replace(/<[^>]+>/g, ''),
  )
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}

export function analizarDireccion(valor = '') {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(valor);
  if (m) return { nombre: m[1].trim() || m[2].trim(), email: m[2].trim() };
  const email = valor.trim();
  return { nombre: email, email };
}

export function asuntoRespuesta(asunto = '') {
  return /^\s*re:/i.test(asunto) ? asunto : `Re: ${asunto}`;
}

// Las cabeceras no pueden contener saltos de línea: evita inyectar cabeceras.
function limpiarCabecera(valor = '') {
  return String(valor).replace(/[\r\n]+/g, ' ').trim();
}

function codificarCabecera(valor) {
  const limpio = limpiarCabecera(valor);
  return /^[\x20-\x7e]*$/.test(limpio) ? limpio : `=?UTF-8?B?${Buffer.from(limpio, 'utf8').toString('base64')}?=`;
}

function trocear(texto, ancho = 76) {
  return texto.match(new RegExp(`.{1,${ancho}}`, 'g'))?.join('\r\n') ?? '';
}

// Correo de texto plano en UTF-8 listo para users.messages.send (campo "raw").
export function construirMensaje({ de, para, asunto, cuerpo, enRespuestaA, referencias }) {
  const cabeceras = [
    de ? `From: ${limpiarCabecera(de)}` : null,
    `To: ${limpiarCabecera(para)}`,
    `Subject: ${codificarCabecera(asunto)}`,
    enRespuestaA ? `In-Reply-To: ${limpiarCabecera(enRespuestaA)}` : null,
    enRespuestaA ? `References: ${limpiarCabecera([referencias, enRespuestaA].filter(Boolean).join(' '))}` : null,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: base64',
  ].filter(Boolean);
  const cuerpoCrlf = String(cuerpo ?? '').replace(/\r?\n/g, '\r\n');
  const mensaje = `${cabeceras.join('\r\n')}\r\n\r\n${trocear(Buffer.from(cuerpoCrlf, 'utf8').toString('base64'))}`;
  return bufferABase64Url(Buffer.from(mensaje, 'utf8'));
}

export function validarDestinatarios(para = '') {
  const direcciones = para
    .split(',')
    .map((d) => analizarDireccion(d).email)
    .filter(Boolean);
  return direcciones.length > 0 && direcciones.every((d) => /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(d));
}
