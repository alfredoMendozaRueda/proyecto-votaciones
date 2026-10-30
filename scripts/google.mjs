// Escribe src/compartido/google.js con los IDs de cliente de Google que
// llegan por variables de entorno (variables y secretos de GitHub Actions).
// Solo se escribe lo que llega: la web no recibe nunca el secreto del cliente
// de escritorio.
import { writeFileSync } from 'node:fs';

const ID = /^[0-9]+-[0-9a-z]+\.apps\.googleusercontent\.com$/;
const SECRETO = /^[A-Za-z0-9_-]{10,100}$/;

const leer = (nombre, formato) => {
  const valor = (process.env[nombre] ?? '').trim();
  if (valor && !formato.test(valor)) {
    console.error(`${nombre} no tiene el formato esperado; se ignora.`);
    return '';
  }
  return valor;
};

const google = {
  web: leer('GOOGLE_WEB_CLIENT_ID', ID),
  escritorio: leer('GOOGLE_DESKTOP_CLIENT_ID', ID),
  secretoEscritorio: leer('GOOGLE_DESKTOP_CLIENT_SECRET', SECRETO),
};
if (!google.escritorio) google.secretoEscritorio = '';

writeFileSync(
  new URL('../src/compartido/google.js', import.meta.url),
  `// Generado al compilar por scripts/google.mjs.\nexport const GOOGLE = ${JSON.stringify(google, null, 2)};\n`,
);
console.log(`Google: web ${google.web ? 'sí' : 'no'}, escritorio ${google.escritorio ? 'sí' : 'no'}, secreto ${google.secretoEscritorio ? 'sí' : 'no'}.`);
