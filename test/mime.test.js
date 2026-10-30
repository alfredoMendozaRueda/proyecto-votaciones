import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  analizarDireccion,
  asuntoRespuesta,
  base64UrlABytes,
  bytesABase64Url,
  construirMensaje,
  decodificarPalabras,
  extraerCuerpo,
  htmlATexto,
  validarDestinatarios,
} from '../src/compartido/mime.js';

const b64url = (texto, codificacion = 'utf8') => bytesABase64Url(new Uint8Array(Buffer.from(texto, codificacion)));

test('extrae el HTML de un multipart/alternative y lista los adjuntos', () => {
  const payload = {
    mimeType: 'multipart/mixed',
    parts: [
      {
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/plain', headers: [], body: { data: b64url('Hola, ¿qué tal?') } },
          { mimeType: 'text/html', headers: [], body: { data: b64url('<p>Hola, <b>¿qué tal?</b></p>') } },
        ],
      },
      { mimeType: 'application/pdf', filename: 'factura.pdf', body: { size: 2048, attachmentId: 'x' } },
    ],
  };
  const cuerpo = extraerCuerpo(payload);
  assert.equal(cuerpo.html, '<p>Hola, <b>¿qué tal?</b></p>');
  assert.equal(cuerpo.texto, 'Hola, ¿qué tal?');
  assert.deepEqual(cuerpo.adjuntos, [{ nombre: 'factura.pdf', tipo: 'application/pdf', tamano: 2048 }]);
});

test('respeta el charset de la parte (ISO-8859-1)', () => {
  const payload = {
    mimeType: 'text/plain',
    headers: [{ name: 'Content-Type', value: 'text/plain; charset="ISO-8859-1"' }],
    body: { data: b64url('Año nuevo, cañón', 'latin1') },
  };
  assert.equal(extraerCuerpo(payload).texto, 'Año nuevo, cañón');
});

test('descodifica cabeceras RFC 2047 en base64 y quoted-printable', () => {
  assert.equal(decodificarPalabras('=?UTF-8?B?wqFIb2xhIQ==?='), '¡Hola!');
  assert.equal(decodificarPalabras('=?ISO-8859-1?Q?Reuni=F3n_ma=F1ana?='), 'Reunión mañana');
  assert.equal(decodificarPalabras('Texto normal'), 'Texto normal');
});

test('convierte HTML en texto legible sin estilos ni scripts', () => {
  const html = '<style>p{color:red}</style><p>Hola&nbsp;Ana</p><script>alert(1)</script><p>Adiós &amp; gracias</p>';
  assert.equal(htmlATexto(html), 'Hola Ana\nAdiós & gracias');
});

test('analiza direcciones con y sin nombre', () => {
  assert.deepEqual(analizarDireccion('"Lucía Ortega" <lucia@ejemplo.es>'), { nombre: 'Lucía Ortega', email: 'lucia@ejemplo.es' });
  assert.deepEqual(analizarDireccion('pepe@ejemplo.es'), { nombre: 'pepe@ejemplo.es', email: 'pepe@ejemplo.es' });
});

test('el asunto de respuesta no duplica el Re:', () => {
  assert.equal(asuntoRespuesta('Presupuesto'), 'Re: Presupuesto');
  assert.equal(asuntoRespuesta('RE: Presupuesto'), 'RE: Presupuesto');
});

test('construye un mensaje UTF-8 válido y no permite inyectar cabeceras', () => {
  const raw = construirMensaje({
    para: 'ana@ejemplo.es\r\nBcc: espia@ejemplo.es',
    asunto: 'Reunión del lunes',
    cuerpo: 'Línea 1\nLínea 2',
    enRespuestaA: '<abc@mail.gmail.com>',
  });
  const texto = new TextDecoder().decode(base64UrlABytes(raw));
  const [cabeceras, cuerpo] = texto.split('\r\n\r\n');
  assert.ok(!/^Bcc:/m.test(cabeceras), 'no debe aparecer una cabecera Bcc inyectada');
  assert.match(cabeceras, /^To: ana@ejemplo\.es Bcc: espia@ejemplo\.es$/m);
  assert.match(cabeceras, /^Subject: =\?UTF-8\?B\?/m);
  assert.match(cabeceras, /^In-Reply-To: <abc@mail\.gmail\.com>$/m);
  assert.equal(Buffer.from(cuerpo.replace(/\r\n/g, ''), 'base64').toString('utf8'), 'Línea 1\r\nLínea 2');
});

test('valida destinatarios', () => {
  assert.equal(validarDestinatarios('ana@ejemplo.es, Pepe <pepe@ejemplo.es>'), true);
  assert.equal(validarDestinatarios('no-es-un-correo'), false);
  assert.equal(validarDestinatarios(''), false);
});
