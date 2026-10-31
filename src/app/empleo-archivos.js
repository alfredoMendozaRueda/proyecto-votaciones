// Leer el texto de un CV (PDF, Word o texto) en el propio dispositivo: el
// archivo no sale de aquí; solo el texto va a la IA. Las librerías se cargan
// al usarlas, no al abrir la app.

const MAX_BYTES = 15 * 1024 * 1024;

const entidades = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
const decodificarXml = (t) =>
  t.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) =>
    e[0] === '#' ? String.fromCodePoint(e[1].toLowerCase() === 'x' ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : (entidades[e] ?? m),
  );

async function textoDePdf(bytes) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const { default: urlWorker } = await import('pdfjs-dist/legacy/build/pdf.worker.min.mjs?url');
  pdfjs.GlobalWorkerOptions.workerSrc = urlWorker;
  const carga = pdfjs.getDocument({ data: bytes, isEvalSupported: false, useSystemFonts: true });
  const documento = await carga.promise;
  const paginas = [];
  for (let n = 1; n <= Math.min(documento.numPages, 12); n++) {
    const pagina = await documento.getPage(n);
    const contenido = await pagina.getTextContent();
    paginas.push(contenido.items.map((item) => (item.str ?? '') + (item.hasEOL ? '\n' : ' ')).join(''));
  }
  await carga.destroy();
  return paginas.join('\n\n');
}

async function textoDeDocx(bytes) {
  const { unzipSync, strFromU8 } = await import('fflate');
  const archivos = unzipSync(bytes, { filter: (f) => f.name === 'word/document.xml' });
  const xml = archivos['word/document.xml'];
  if (!xml) throw new Error('Ese archivo de Word no se puede leer.');
  return decodificarXml(
    strFromU8(xml)
      .replace(/<w:tab\/>/g, '\t')
      .replace(/<w:br[^>]*\/>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, ''),
  );
}

export async function leerArchivoCV(archivo) {
  if (!archivo) throw new Error('No se ha elegido ningún archivo.');
  if (archivo.size > MAX_BYTES) throw new Error('El archivo es demasiado grande (máximo 15 MB).');
  const nombre = archivo.name.toLowerCase();
  const bytes = new Uint8Array(await archivo.arrayBuffer());
  let texto;
  if (nombre.endsWith('.pdf') || archivo.type === 'application/pdf') texto = await textoDePdf(bytes);
  else if (nombre.endsWith('.docx')) texto = await textoDeDocx(bytes);
  else if (nombre.endsWith('.doc')) throw new Error('Los .doc antiguos no se pueden leer: guárdalo como PDF o .docx.');
  else texto = new TextDecoder().decode(bytes);
  const limpio = texto.replace(/[ \t]+/g, ' ').replace(/\n[ \t]+/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  if (limpio.length < 80) {
    throw new Error('No he podido sacar texto de ese archivo (¿es un PDF escaneado?). Pega el texto de tu CV a mano.');
  }
  return limpio;
}
