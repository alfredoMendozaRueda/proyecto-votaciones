// PDF del CV adaptado y de la carta, generados en el dispositivo (pdf-lib,
// cargado solo al usarlo). Diseño sobrio de una columna, que leen bien las
// personas y los filtros ATS: texto real, sin tablas ni imágenes.
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';

const TITULOS = {
  es: { perfil: 'Perfil', experiencia: 'Experiencia', formacion: 'Formación', habilidades: 'Habilidades', idiomas: 'Idiomas', certificaciones: 'Certificaciones' },
  en: { perfil: 'Profile', experiencia: 'Experience', formacion: 'Education', habilidades: 'Skills', idiomas: 'Languages', certificaciones: 'Certifications' },
  fr: { perfil: 'Profil', experiencia: 'Expérience', formacion: 'Formation', habilidades: 'Compétences', idiomas: 'Langues', certificaciones: 'Certifications' },
  pt: { perfil: 'Perfil', experiencia: 'Experiência', formacion: 'Formação', habilidades: 'Competências', idiomas: 'Idiomas', certificaciones: 'Certificações' },
  de: { perfil: 'Profil', experiencia: 'Berufserfahrung', formacion: 'Ausbildung', habilidades: 'Kenntnisse', idiomas: 'Sprachen', certificaciones: 'Zertifikate' },
  it: { perfil: 'Profilo', experiencia: 'Esperienza', formacion: 'Formazione', habilidades: 'Competenze', idiomas: 'Lingue', certificaciones: 'Certificazioni' },
};
export const titulosCV = (idioma) => TITULOS[idioma] ?? TITULOS.es;

const ACENTO = rgb(0.6, 0.15, 0.11);
const TINTA = rgb(0.12, 0.1, 0.09);
const GRIS = rgb(0.4, 0.37, 0.35);
const A4 = [595.28, 841.89];
const MARGEN = 52;

class Lienzo {
  constructor(doc, fuentes) {
    this.doc = doc;
    this.f = fuentes;
    this.ancho = A4[0] - MARGEN * 2;
    this.juego = new Set(fuentes.normal.getCharacterSet());
    this.nueva();
  }

  nueva() {
    this.pagina = this.doc.addPage(A4);
    this.y = A4[1] - MARGEN;
  }

  // Solo caracteres que tiene Helvetica (WinAnsi): el resto se aproxima.
  limpiar(texto) {
    return [...String(texto ?? '').normalize('NFC').replace(/\t/g, ' ')]
      .map((c) => {
        if (this.juego.has(c.codePointAt(0))) return c;
        const base = c.normalize('NFD').replace(/[̀-ͯ]/g, '');
        if (base && [...base].every((b) => this.juego.has(b.codePointAt(0)))) return base;
        return { '→': '->', '←': '<-', '≥': '>=', '≤': '<=', '✓': '-', '★': '*', '−': '-', '‑': '-', '‐': '-', '\u00A0': ' ', '\u202F': ' ', '≈': '~' }[c] ?? '';
      })
      .join('');
  }

  cabe(alto) {
    if (this.y - alto < MARGEN) this.nueva();
  }

  // Parte el texto en líneas que caben en el ancho dado.
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

  texto(texto, { fuente = this.f.normal, tam = 10, color = TINTA, x = MARGEN, ancho = this.ancho, interlineado = tam * 1.38 } = {}) {
    for (const linea of this.lineas(texto, fuente, tam, ancho)) {
      this.cabe(interlineado);
      this.y -= interlineado;
      if (linea) this.pagina.drawText(linea, { x, y: this.y + (interlineado - tam) * 0.35, size: tam, font: fuente, color });
    }
  }

  derecha(texto, { fuente = this.f.normal, tam = 9, color = GRIS, y } = {}) {
    const limpio = this.limpiar(texto);
    const w = fuente.widthOfTextAtSize(limpio, tam);
    this.pagina.drawText(limpio, { x: MARGEN + this.ancho - w, y, size: tam, font: fuente, color });
    return w;
  }

  espacio(n) {
    this.y -= n;
  }

  seccion(titulo) {
    this.cabe(40);
    this.espacio(12);
    this.texto(titulo.toUpperCase(), { fuente: this.f.negrita, tam: 9.5, color: ACENTO });
    this.espacio(3);
    this.pagina.drawLine({ start: { x: MARGEN, y: this.y }, end: { x: MARGEN + this.ancho, y: this.y }, thickness: 0.6, color: rgb(0.85, 0.8, 0.77) });
    this.espacio(4);
  }
}

async function nuevoDocumento(titulo, autor) {
  const doc = await PDFDocument.create();
  doc.setTitle(titulo);
  if (autor) doc.setAuthor(autor);
  doc.setCreator('Kitsune');
  const fuentes = { normal: await doc.embedFont(StandardFonts.Helvetica), negrita: await doc.embedFont(StandardFonts.HelveticaBold) };
  return { doc, l: new Lienzo(doc, fuentes) };
}

function cabecera(l, cv) {
  l.texto(cv.nombre || ' ', { fuente: l.f.negrita, tam: 22, interlineado: 26 });
  if (cv.titular) l.texto(cv.titular, { tam: 12, color: ACENTO, interlineado: 17 });
  const contacto = [cv.ubicacion, cv.email, cv.telefono, ...(cv.enlaces ?? [])].filter(Boolean).join('  ·  ');
  if (contacto) {
    l.espacio(2);
    l.texto(contacto, { tam: 9, color: GRIS, interlineado: 12.5 });
  }
}

const fechas = (inicio, fin) => [inicio, fin].filter(Boolean).join(' – ');

export async function pdfCV(cv, { idioma = 'es' } = {}) {
  const t = titulosCV(idioma);
  const { doc, l } = await nuevoDocumento(`CV ${cv.nombre ?? ''}`.trim(), cv.nombre);
  cabecera(l, cv);

  if (cv.resumen) {
    l.seccion(t.perfil);
    l.texto(cv.resumen, { tam: 10, interlineado: 14 });
  }
  if (cv.experiencia?.length) {
    l.seccion(t.experiencia);
    for (const e of cv.experiencia) {
      l.cabe(40);
      l.espacio(4);
      const cuando = fechas(e.inicio, e.fin);
      const anchoFechas = cuando ? l.f.normal.widthOfTextAtSize(l.limpiar(cuando), 9) + 12 : 0;
      const yAntes = l.y;
      l.texto([e.puesto, e.empresa].filter(Boolean).join(' — '), { fuente: l.f.negrita, tam: 10.5, ancho: l.ancho - anchoFechas, interlineado: 14 });
      if (cuando) l.derecha(cuando, { y: yAntes - 14 + (14 - 10.5) * 0.35 });
      if (e.lugar) l.texto(e.lugar, { tam: 9, color: GRIS, interlineado: 12 });
      for (const logro of e.logros ?? []) {
        const yLogro = l.y;
        l.texto(logro, { tam: 9.8, x: MARGEN + 11, ancho: l.ancho - 11, interlineado: 13.4 });
        l.pagina.drawText('•', { x: MARGEN + 2, y: yLogro - 13.4 + (13.4 - 9.8) * 0.35, size: 9.8, font: l.f.normal, color: ACENTO });
      }
    }
  }
  if (cv.formacion?.length) {
    l.seccion(t.formacion);
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
  if (cv.habilidades?.length) {
    l.seccion(t.habilidades);
    l.texto(cv.habilidades.join('  ·  '), { tam: 9.8, interlineado: 14 });
  }
  if (cv.idiomas?.length) {
    l.seccion(t.idiomas);
    l.texto(cv.idiomas.join('  ·  '), { tam: 9.8, interlineado: 14 });
  }
  if (cv.certificaciones?.length) {
    l.seccion(t.certificaciones);
    for (const c of cv.certificaciones) l.texto(c, { tam: 9.8, interlineado: 13.4 });
  }
  return doc.save();
}

export async function pdfCarta(carta, cv, { idioma = 'es' } = {}) {
  const { doc, l } = await nuevoDocumento(`Carta ${cv.nombre ?? ''}`.trim(), cv.nombre);
  cabecera(l, cv);
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
