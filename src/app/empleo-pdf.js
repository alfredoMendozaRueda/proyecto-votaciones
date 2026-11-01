// PDF del CV adaptado y de la carta, generados en el dispositivo (pdf-lib,
// cargado solo al usarlo). Cuatro diseños, seis colores y foto opcional:
//   · Clásico: una columna sobria; el que mejor leen los filtros ATS.
//   · Moderno: cabecera de color con la foto y secciones con marca.
//   · Lateral: columna de color con foto, contacto, habilidades e idiomas.
//   · Elegante: tipografía con serifa, centrado y líneas finas.
// Siempre texto real (nada de imágenes de texto), para que los ATS lo lean.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { normalizarEstiloCV, PLANTILLAS_CV } from '../compartido/empleo.js';

const TITULOS = {
  es: { perfil: 'Perfil', experiencia: 'Experiencia', formacion: 'Formación', habilidades: 'Habilidades', idiomas: 'Idiomas', certificaciones: 'Certificaciones', contacto: 'Contacto' },
  en: { perfil: 'Profile', experiencia: 'Experience', formacion: 'Education', habilidades: 'Skills', idiomas: 'Languages', certificaciones: 'Certifications', contacto: 'Contact' },
  fr: { perfil: 'Profil', experiencia: 'Expérience', formacion: 'Formation', habilidades: 'Compétences', idiomas: 'Langues', certificaciones: 'Certifications', contacto: 'Contact' },
  pt: { perfil: 'Perfil', experiencia: 'Experiência', formacion: 'Formação', habilidades: 'Competências', idiomas: 'Idiomas', certificaciones: 'Certificações', contacto: 'Contacto' },
  de: { perfil: 'Profil', experiencia: 'Berufserfahrung', formacion: 'Ausbildung', habilidades: 'Kenntnisse', idiomas: 'Sprachen', certificaciones: 'Zertifikate', contacto: 'Kontakt' },
  it: { perfil: 'Profilo', experiencia: 'Esperienza', formacion: 'Formazione', habilidades: 'Competenze', idiomas: 'Lingue', certificaciones: 'Certificazioni', contacto: 'Contatti' },
};
export const titulosCV = (idioma) => TITULOS[idioma] ?? TITULOS.es;

// Colores (los mismos que usa la vista previa en empleo.js).
export const COLORES_CV = {
  granate: [0.6, 0.15, 0.11],
  azul: [0.11, 0.27, 0.5],
  verde: [0.1, 0.4, 0.31],
  grafito: [0.22, 0.23, 0.26],
  violeta: [0.38, 0.22, 0.56],
  teja: [0.74, 0.35, 0.14],
};
export { PLANTILLAS_CV };
const estiloCV = normalizarEstiloCV;

const TINTA = rgb(0.12, 0.1, 0.09);
const GRIS = rgb(0.4, 0.37, 0.35);
const BLANCO = rgb(1, 1, 1);
const A4 = [595.28, 841.89];
const MARGEN = 52;
const mezcla = ([r, g, b], t) => rgb(r + (1 - r) * t, g + (1 - g) * t, b + (1 - b) * t);

class Lienzo {
  constructor(doc, fuentes, { decorar = () => {}, arriba = MARGEN } = {}) {
    this.doc = doc;
    this.f = fuentes;
    this.decorar = decorar;
    this.arriba = arriba;
    this.juego = new Set(fuentes.normal.getCharacterSet());
    this.columna(MARGEN, A4[0] - MARGEN * 2);
    this.nueva();
  }

  columna(x, ancho) {
    this.x0 = x;
    this.ancho = ancho;
  }

  nueva() {
    this.pagina = this.doc.addPage(A4);
    const primera = this.doc.getPageCount() === 1;
    this.decorar(this.pagina, primera);
    this.y = A4[1] - (primera ? this.arriba : MARGEN);
  }

  // Solo caracteres que tienen las fuentes estándar (WinAnsi): el resto se aproxima.
  limpiar(texto) {
    return [...String(texto ?? '').normalize('NFC').replace(/\t/g, ' ')]
      .map((c) => {
        if (this.juego.has(c.codePointAt(0))) return c;
        const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (base && [...base].every((b) => this.juego.has(b.codePointAt(0)))) return base;
        return { '→': '->', '←': '<-', '≥': '>=', '≤': '<=', '✓': '-', '★': '*', '−': '-', '‑': '-', '‐': '-', ' ': ' ', ' ': ' ', '≈': '~' }[c] ?? '';
      })
      .join('');
  }

  cabe(alto) {
    if (this.y - alto < MARGEN) this.nueva();
  }

  lineas(texto, fuente, tam, ancho) {
    const lineas = [];
    for (const parrafo of this.limpiar(texto).split('\n')) {
      let actual = '';
      for (const palabra of parrafo.split(/\s+/).filter(Boolean)) {
        const prueba = actual ? `${actual} ${palabra}` : palabra;
        if (fuente.widthOfTextAtSize(prueba, tam) <= ancho || !actual) actual = prueba;
        else {
          lineas.push(actual);
          actual = palabra;
        }
      }
      lineas.push(actual);
    }
    return lineas;
  }

  texto(texto, { fuente = this.f.normal, tam = 10, color = TINTA, x = this.x0, ancho = this.ancho, interlineado = tam * 1.38, centrado = false } = {}) {
    for (const linea of this.lineas(texto, fuente, tam, ancho)) {
      this.cabe(interlineado);
      this.y -= interlineado;
      if (!linea) continue;
      const dx = centrado ? (ancho - fuente.widthOfTextAtSize(linea, tam)) / 2 : 0;
      this.pagina.drawText(linea, { x: x + dx, y: this.y + (interlineado - tam) * 0.35, size: tam, font: fuente, color });
    }
  }

  derecha(texto, { fuente = this.f.normal, tam = 9, color = GRIS, y } = {}) {
    const limpio = this.limpiar(texto);
    const w = fuente.widthOfTextAtSize(limpio, tam);
    this.pagina.drawText(limpio, { x: this.x0 + this.ancho - w, y, size: tam, font: fuente, color });
    return w;
  }

  espacio(n) {
    this.y -= n;
  }
}

// La foto, recortada en círculo o con esquinas redondeadas (PNG con transparencia).
export async function fotoParaPdf(foto, forma = 'circulo', lado = 360) {
  if (!foto) return null;
  const img = new Image();
  img.src = foto;
  await img.decode();
  const lienzo = document.createElement('canvas');
  lienzo.width = lienzo.height = lado;
  const c = lienzo.getContext('2d');
  c.beginPath();
  if (forma === 'circulo') c.arc(lado / 2, lado / 2, lado / 2, 0, Math.PI * 2);
  else c.roundRect(0, 0, lado, lado, lado * 0.12);
  c.clip();
  const m = Math.min(img.naturalWidth, img.naturalHeight);
  c.drawImage(img, (img.naturalWidth - m) / 2, (img.naturalHeight - m) / 2, m, m, 0, 0, lado, lado);
  const blob = await new Promise((ok) => lienzo.toBlob(ok, 'image/png'));
  return new Uint8Array(await blob.arrayBuffer());
}

async function fuentesDe(doc, serifa) {
  const [normal, negrita, cursiva] = serifa
    ? [StandardFonts.TimesRoman, StandardFonts.TimesRomanBold, StandardFonts.TimesRomanItalic]
    : [StandardFonts.Helvetica, StandardFonts.HelveticaBold, StandardFonts.HelveticaOblique];
  return { normal: await doc.embedFont(normal), negrita: await doc.embedFont(negrita), cursiva: await doc.embedFont(cursiva) };
}

// Guion normal: muchos ATS no reconocen un intervalo con «–» (regla de ai-job-search).
const fechas = (inicio, fin) => [inicio, fin].filter(Boolean).join(' - ');
const contactoDe = (cv) => [cv.ubicacion, cv.email, cv.telefono, ...(cv.enlaces ?? [])].filter(Boolean);

// Título de sección según el diseño.
function seccion(l, titulo, { plantilla, acento }) {
  l.cabe(42);
  if (plantilla === 'elegante') {
    l.espacio(14);
    l.texto(titulo.toUpperCase(), { fuente: l.f.negrita, tam: 10, color: rgb(...acento), centrado: true });
    l.espacio(3);
    const medio = l.x0 + l.ancho / 2;
    l.pagina.drawLine({ start: { x: medio - 24, y: l.y }, end: { x: medio + 24, y: l.y }, thickness: 0.8, color: rgb(...acento) });
    l.espacio(6);
    return;
  }
  if (plantilla === 'moderna') {
    l.espacio(27);
    l.pagina.drawRectangle({ x: l.x0, y: l.y + 1, width: 3.5, height: 11, color: rgb(...acento) });
    l.pagina.drawText(l.limpiar(titulo.toUpperCase()), { x: l.x0 + 10, y: l.y + 2.5, size: 10, font: l.f.negrita, color: TINTA });
    l.espacio(6);
    return;
  }
  l.espacio(12);
  l.texto(titulo.toUpperCase(), { fuente: l.f.negrita, tam: 9.5, color: rgb(...acento) });
  l.espacio(3);
  l.pagina.drawLine({ start: { x: l.x0, y: l.y }, end: { x: l.x0 + l.ancho, y: l.y }, thickness: 0.6, color: mezcla(acento, 0.75) });
  l.espacio(4);
}

function experiencia(l, cv, t, estilo) {
  const acento = rgb(...estilo.acento);
  seccion(l, t.experiencia, estilo);
  for (const e of cv.experiencia) {
    l.cabe(40);
    l.espacio(4);
    const cuando = fechas(e.inicio, e.fin);
    const anchoFechas = cuando ? l.f.normal.widthOfTextAtSize(l.limpiar(cuando), 9) + 12 : 0;
    const yAntes = l.y;
    l.texto([e.puesto, e.empresa].filter(Boolean).join(' — '), { fuente: l.f.negrita, tam: 10.5, ancho: l.ancho - anchoFechas, interlineado: 14 });
    if (cuando) l.derecha(cuando, { y: yAntes - 14 + (14 - 10.5) * 0.35 });
    if (e.lugar) l.texto(e.lugar, { fuente: estilo.plantilla === 'elegante' ? l.f.cursiva : l.f.normal, tam: 9, color: GRIS, interlineado: 12 });
    for (const logro of e.logros ?? []) {
      const yLogro = l.y;
      l.texto(logro, { tam: 9.8, x: l.x0 + 11, ancho: l.ancho - 11, interlineado: 13.4 });
      l.pagina.drawText('•', { x: l.x0 + 2, y: yLogro - 13.4 + (13.4 - 9.8) * 0.35, size: 9.8, font: l.f.normal, color: acento });
    }
  }
}

function formacion(l, cv, t, estilo) {
  seccion(l, t.formacion, estilo);
  for (const f of cv.formacion) {
    l.cabe(30);
    l.espacio(2);
    const cuando = fechas(f.inicio, f.fin);
    const anchoFechas = cuando ? l.f.normal.widthOfTextAtSize(l.limpiar(cuando), 9) + 12 : 0;
    const yAntes = l.y;
    l.texto(f.titulo, { fuente: l.f.negrita, tam: 10, ancho: l.ancho - anchoFechas, interlineado: 13.5 });
    if (cuando) l.derecha(cuando, { y: yAntes - 13.5 + (13.5 - 10) * 0.35 });
    if (f.centro) l.texto(f.centro, { tam: 9.5, color: GRIS, interlineado: 12.5 });
  }
}

function listas(l, cv, t, estilo) {
  const centrado = estilo.plantilla === 'elegante';
  if (cv.habilidades?.length) {
    seccion(l, t.habilidades, estilo);
    l.texto(cv.habilidades.join('  ·  '), { tam: 9.8, interlineado: 14, centrado });
  }
  if (cv.idiomas?.length) {
    seccion(l, t.idiomas, estilo);
    l.texto(cv.idiomas.join('  ·  '), { tam: 9.8, interlineado: 14, centrado });
  }
  if (cv.certificaciones?.length) {
    seccion(l, t.certificaciones, estilo);
    for (const c of cv.certificaciones) l.texto(c, { tam: 9.8, interlineado: 13.4, centrado });
  }
}

// Cabecera de cada diseño. Devuelve el lienzo listo para el cuerpo.
async function preparar(doc, cv, estilo, fotoPng) {
  const { plantilla, acento } = estilo;
  const foto = fotoPng ? await doc.embedPng(fotoPng) : null;
  const f = await fuentesDe(doc, plantilla === 'elegante');

  if (plantilla === 'moderna') {
    const alto = 128;
    const l = new Lienzo(doc, f, {
      arriba: alto + 6,
      decorar: (p, primera) => primera && p.drawRectangle({ x: 0, y: A4[1] - alto, width: A4[0], height: alto, color: rgb(...acento) }),
    });
    const lado = 86;
    const anchoTexto = l.ancho - (foto ? lado + 20 : 0);
    const cuerpo = l.y;
    l.y = A4[1] - 30;
    l.texto(cv.nombre || ' ', { fuente: f.negrita, tam: 23, color: BLANCO, interlineado: 28, ancho: anchoTexto });
    if (cv.titular) l.texto(cv.titular, { tam: 12, color: BLANCO, interlineado: 17, ancho: anchoTexto });
    const contacto = contactoDe(cv).join('  ·  ');
    if (contacto) l.texto(contacto, { tam: 8.8, color: mezcla(acento, 0.75), interlineado: 12, ancho: anchoTexto });
    if (foto) {
      const x = A4[0] - MARGEN - lado;
      const y = A4[1] - alto / 2 - lado / 2;
      if (estilo.forma === 'circulo') l.pagina.drawCircle({ x: x + lado / 2, y: y + lado / 2, size: lado / 2 + 3, color: BLANCO });
      else l.pagina.drawRectangle({ x: x - 3, y: y - 3, width: lado + 6, height: lado + 6, color: BLANCO });
      l.pagina.drawImage(foto, { x, y, width: lado, height: lado });
    }
    l.y = cuerpo;
    return l;
  }

  if (plantilla === 'lateral') {
    const lateral = 178;
    const fondo = mezcla(acento, 0.9);
    const l = new Lienzo(doc, f, { decorar: (p) => p.drawRectangle({ x: 0, y: 0, width: lateral, height: A4[1], color: fondo }) });
    const primera = l.pagina;
    const t = titulosCV(estilo.idioma);
    // Columna lateral (primera página): foto, contacto y listas cortas.
    l.columna(24, lateral - 46);
    l.y = A4[1] - 40;
    if (foto) {
      const lado = 112;
      l.y -= lado;
      primera.drawImage(foto, { x: (lateral - lado) / 2, y: l.y, width: lado, height: lado });
      l.espacio(8);
    }
    const bloque = (titulo, items) => {
      if (!items.length) return;
      l.espacio(12);
      l.texto(titulo.toUpperCase(), { fuente: f.negrita, tam: 9, color: rgb(...acento), interlineado: 13 });
      l.espacio(3);
      for (const it of items) l.texto(it, { tam: 8.8, interlineado: 12.2 });
    };
    bloque(t.contacto, contactoDe(cv));
    bloque(t.habilidades, (cv.habilidades ?? []).slice(0, 16));
    bloque(t.idiomas, (cv.idiomas ?? []).slice(0, 6));
    bloque(t.certificaciones, (cv.certificaciones ?? []).slice(0, 5));
    // El cuerpo va a la derecha y sigue en las páginas siguientes.
    l.pagina = primera;
    l.columna(lateral + 30, A4[0] - lateral - 30 - 40);
    l.y = A4[1] - 40;
    l.texto(cv.nombre || ' ', { fuente: f.negrita, tam: 22, interlineado: 26 });
    if (cv.titular) l.texto(cv.titular, { tam: 12, color: rgb(...acento), interlineado: 17 });
    l.sinListas = true;
    return l;
  }

  if (plantilla === 'elegante') {
    const l = new Lienzo(doc, f);
    if (foto) {
      const lado = 78;
      l.y -= lado;
      l.pagina.drawImage(foto, { x: (A4[0] - lado) / 2, y: l.y, width: lado, height: lado });
      l.espacio(10);
    }
    l.texto(cv.nombre || ' ', { fuente: f.negrita, tam: 26, interlineado: 30, centrado: true });
    if (cv.titular) l.texto(cv.titular, { fuente: f.cursiva, tam: 13, color: rgb(...acento), interlineado: 18, centrado: true });
    const contacto = contactoDe(cv).join('   |   ');
    if (contacto) l.texto(contacto, { tam: 9.5, color: GRIS, interlineado: 13, centrado: true });
    l.espacio(8);
    l.pagina.drawLine({ start: { x: MARGEN, y: l.y }, end: { x: A4[0] - MARGEN, y: l.y }, thickness: 0.9, color: rgb(...acento) });
    l.pagina.drawLine({ start: { x: MARGEN, y: l.y - 2.5 }, end: { x: A4[0] - MARGEN, y: l.y - 2.5 }, thickness: 0.4, color: rgb(...acento) });
    l.espacio(4);
    return l;
  }

  // Clásico: nombre a la izquierda y foto a la derecha.
  const l = new Lienzo(doc, f);
  const lado = 76;
  const anchoTexto = foto ? l.ancho - lado - 16 : l.ancho;
  const yFoto = l.y - lado;
  l.texto(cv.nombre || ' ', { fuente: f.negrita, tam: 22, interlineado: 26, ancho: anchoTexto });
  if (cv.titular) l.texto(cv.titular, { tam: 12, color: rgb(...acento), interlineado: 17, ancho: anchoTexto });
  const contacto = contactoDe(cv).join('  ·  ');
  if (contacto) {
    l.espacio(2);
    l.texto(contacto, { tam: 9, color: GRIS, interlineado: 12.5, ancho: anchoTexto });
  }
  if (foto) {
    l.pagina.drawImage(foto, { x: A4[0] - MARGEN - lado, y: yFoto, width: lado, height: lado });
    l.y = Math.min(l.y, yFoto - 4);
  }
  return l;
}

async function documento(titulo, cv) {
  const doc = await PDFDocument.create();
  doc.setTitle(`${titulo} ${cv.nombre ?? ''}`.trim());
  if (cv.nombre) doc.setAuthor(cv.nombre);
  doc.setCreator('Kitsune');
  return doc;
}

export async function pdfCV(cv, { idioma = 'es', estilo = {}, foto = null } = {}) {
  const t = titulosCV(idioma);
  const e = estiloCV(estilo);
  const opciones = { ...e, acento: COLORES_CV[e.color], idioma };
  const doc = await documento('CV', cv);
  const png = e.conFoto && foto ? await fotoParaPdf(foto, e.forma).catch(() => null) : null;
  const l = await preparar(doc, cv, opciones, png);
  if (cv.resumen) {
    seccion(l, t.perfil, opciones);
    l.texto(cv.resumen, { tam: 10, interlineado: 14 });
  }
  if (cv.experiencia?.length) experiencia(l, cv, t, opciones);
  if (cv.formacion?.length) formacion(l, cv, t, opciones);
  if (!l.sinListas) listas(l, cv, t, opciones);
  return doc.save();
}

export async function pdfCarta(carta, cv, { idioma = 'es', estilo = {}, foto = null } = {}) {
  const e = estiloCV(estilo);
  // La carta lleva la cabecera del CV; con el lateral, la del clásico (una carta es de una columna).
  const opciones = { ...e, plantilla: e.plantilla === 'lateral' ? 'clasica' : e.plantilla, acento: COLORES_CV[e.color], idioma };
  const doc = await documento('Carta', cv);
  const png = e.conFoto && foto ? await fotoParaPdf(foto, e.forma).catch(() => null) : null;
  const l = await preparar(doc, cv, opciones, png);
  l.espacio(26);
  const fecha = new Date().toLocaleDateString(idioma === 'es' ? 'es-ES' : idioma, { day: 'numeric', month: 'long', year: 'numeric' });
  l.derecha(fecha, { y: l.y, tam: 10 });
  l.espacio(26);
  for (const parrafo of String(carta ?? '').split(/\n\s*\n|\n/).map((p) => p.trim()).filter(Boolean)) {
    l.texto(parrafo, { tam: 10.5, interlineado: 15.5 });
    l.espacio(8);
  }
  return doc.save();
}
