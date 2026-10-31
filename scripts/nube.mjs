// Escribe src/compartido/nube.js con la dirección del servidor de avisos:
// la de KITSUNE_SERVIDOR o, si no, la que guardó el despliegue en servidor/url.txt.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';

const archivo = new URL('../servidor/url.txt', import.meta.url);
const url = (process.env.KITSUNE_SERVIDOR || (existsSync(archivo) ? readFileSync(archivo, 'utf8') : '')).trim().replace(/\/+$/, '');
const valida = /^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(url) ? url : '';
if (url && !valida) console.error('La dirección del servidor no es válida; se ignora.');
writeFileSync(
  new URL('../src/compartido/nube.js', import.meta.url),
  `// Generado al compilar por scripts/nube.mjs.\nexport const URL_SERVIDOR = ${JSON.stringify(valida)};\n`,
);
console.log(`Servidor de avisos: ${valida || 'sin configurar'}.`);
