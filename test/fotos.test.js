import test from 'node:test';
import assert from 'node:assert/strict';
import { dominioRaiz, candidatosFoto, claveFoto } from '../src/compartido/fotos.js';

test('fotos: dominio raíz, logos de empresa y Gravatar para direcciones personales', async () => {
  assert.equal(dominioRaiz('news.mail.amazon.es'), 'amazon.es');
  assert.equal(dominioRaiz('em.bbc.co.uk'), 'bbc.co.uk');
  assert.equal(dominioRaiz('renfe.com'), 'renfe.com');
  const empresa = await candidatosFoto('Tickets@Mail.Renfe.com');
  assert.deepEqual(empresa, [{ url: 'https://www.google.com/s2/favicons?domain=renfe.com&sz=128', tipo: 'logo' }]);
  const [persona] = await candidatosFoto(' Lucia.Perez@gmail.com ');
  assert.equal(persona.tipo, 'foto');
  // SHA-256 de «lucia.perez@gmail.com», en minúsculas y sin espacios.
  assert.match(persona.url, /^https:\/\/gravatar\.com\/avatar\/[0-9a-f]{64}\?s=128&d=404$/);
  assert.deepEqual(await candidatosFoto('no es un correo'), []);
  assert.equal(claveFoto('ofertas@news.zara.com'), 'zara.com');
  assert.equal(claveFoto('Lucia@Hotmail.es'), 'lucia@hotmail.es');
});
