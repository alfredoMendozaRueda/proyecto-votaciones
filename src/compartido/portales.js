// Portales de empleo de ai-job-search (https://github.com/MadsLorentzen/ai-job-search),
// adaptados de sus CLIs .agents/skills/linkedin-search y freehire-search.
// Copyright (c) 2026 Mads Lorentzen · Licencia MIT (ver LICENCIAS-TERCEROS.md).
//
// Los usa el servidor de Kitsune (desde el navegador no se puede, por CORS):
//   - LinkedIn: endpoints públicos «jobs-guest» (sin cuenta). Uso personal y
//     poco volumen: el acceso automático va contra sus condiciones.
//   - freehire.me: agregador abierto de ofertas (sobre todo tecnología) con
//     API JSON pública.
// Las ofertas son texto de terceros: se quita lo que no se ve (caracteres
// invisibles, HTML oculto) para que no cuelen instrucciones a la IA.

import { resolverZona, millasDe } from './zonas.js';

export const URL_LINKEDIN_BUSCAR = 'https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search';
export const URL_LINKEDIN_OFERTA = 'https://www.linkedin.com/jobs-guest/jobs/api/jobPosting';
export const URL_FREEHIRE = 'https://freehire.me';

const UA = 'Mozilla/5.0 (compatible; kitsune-empleo/1.0)';

// ---------- Limpieza (de linkedin-search/cli/src/helpers.ts) ----------

const INVISIBLES =
  /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F­؜᠎​-‏‪-‮⁠-⁯︀-️﻿\u{E0000}-\u{E007F}\u{E0100}-\u{E01EF}]/gu;

export function quitarInvisibles(valor) {
  if (typeof valor === 'string') return valor.replace(INVISIBLES, '');
  if (Array.isArray(valor)) return valor.map(quitarInvisibles);
  if (valor && typeof valor === 'object' && Object.getPrototypeOf(valor) === Object.prototype) {
    return Object.fromEntries(Object.entries(valor).map(([k, v]) => [k, quitarInvisibles(v)]));
  }
  return valor;
}

const VACIAS = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);

function etiquetaOculta(atributos) {
  for (const m of atributos.matchAll(/([^\s"'=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    const nombre = m[1].toLowerCase();
    const valor = m[2] ?? m[3] ?? m[4] ?? '';
    if (nombre === 'hidden') return true;
    if (nombre === 'style' && /(?:^|;)\s*(?:display\s*:\s*none|visibility\s*:\s*hidden|mso-hide\s*:\s*all)\b/i.test(valor)) return true;
  }
  return false;
}

// Quita comentarios, <script>/<style>/<template> y lo marcado como oculto.
export function htmlVisible(html) {
  const src = String(html ?? '')
    .replace(/<!--[\s\S]*?(?:-->|$)/g, '')
    .replace(/<(script|style|template)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi, '');
  const abre = /<([a-zA-Z][a-zA-Z0-9-]*)(\s[^>]*)?>/g;
  const partes = [];
  let desde = 0;
  let m;
  while ((m = abre.exec(src)) !== null) {
    if (!m[2] || !etiquetaOculta(m[2])) continue;
    const etiqueta = m[1].toLowerCase();
    let fin = abre.lastIndex;
    if (!VACIAS.has(etiqueta) && !m[0].endsWith('/>')) {
      const misma = new RegExp(`<(/?)${etiqueta}\\b[^>]*>`, 'gi');
      misma.lastIndex = fin;
      fin = src.length;
      let nivel = 1;
      let s;
      while ((s = misma.exec(src)) !== null) {
        if (s[1]) nivel--;
        else if (!s[0].endsWith('/>')) nivel++;
        if (nivel === 0) {
          fin = misma.lastIndex;
          break;
        }
      }
    }
    partes.push(src.slice(desde, m.index));
    desde = fin;
    abre.lastIndex = fin;
  }
  partes.push(src.slice(desde));
  return partes.join('');
}

const entidad = (cp) => (cp >= 0 && cp <= 0x10ffff ? String.fromCodePoint(cp) : '');
export function decodificarEntidades(texto) {
  return String(texto ?? '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => entidad(parseInt(d, 10)))
    .replace(/&#[xX]([0-9a-fA-F]+);/g, (_, h) => entidad(parseInt(h, 16)))
    .replace(/&nbsp;/g, ' ');
}

const limpio = (html) => decodificarEntidades(htmlVisible(html).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());

// HTML de una oferta → texto con saltos de línea.
export function textoDeHtml(html) {
  return htmlVisible(html)
    .replace(/\s+/g, ' ')
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|ul|ol|div|h\d|tr)>/gi, '\n')
    .split('\n')
    .map((l) => decodificarEntidades(l.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Contenido de un <div class="…"> contando los <div> anidados.
function contenidoDiv(html, clase) {
  const escapada = clase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const apertura = new RegExp(`<div[^>]*class="[^"]*${escapada}[^"]*"[^>]*>`, 'i').exec(html);
  if (!apertura) return null;
  let i = apertura.index + apertura[0].length;
  let nivel = 1;
  while (nivel > 0 && i < html.length) {
    const otro = html.indexOf('<div', i);
    const cierre = html.indexOf('</div>', i);
    if (cierre === -1) return null;
    if (otro !== -1 && otro < cierre) {
      nivel++;
      i = otro + 4;
    } else {
      nivel--;
      i = cierre + 6;
    }
  }
  return html.slice(apertura.index + apertura[0].length, i - 6);
}

async function pedirConEspera(url, opciones, hacerFetch, intentos = 3) {
  let espera = 600;
  for (let i = 0; ; i++) {
    const r = await hacerFetch(url, opciones);
    if ((r.status === 429 || r.status >= 500) && i < intentos) {
      await new Promise((ok) => setTimeout(ok, espera + Math.floor(Math.random() * 300)));
      espera *= 2;
      continue;
    }
    return r;
  }
}

// ---------- LinkedIn (linkedin-search) ----------

const MODALIDAD_LINKEDIN = { presencial: '1', remoto: '2', híbrido: '3' };

// La búsqueda pública de LinkedIn ignora f_WT (la modalidad): se pide también con palabras.
const PALABRAS_MODALIDAD = { remoto: '(remoto OR remote OR teletrabajo)', híbrido: '(híbrido OR hybrid)' };

export function urlBusquedaLinkedIn({ palabras, ubicacion, dias = 14, modalidad = '', inicio = 0, millas = 0 }) {
  const clave = PALABRAS_MODALIDAD[modalidad] ? `${palabras} ${PALABRAS_MODALIDAD[modalidad]}` : palabras;
  const p = new URLSearchParams({ keywords: clave, location: ubicacion || 'España', start: String(inicio) });
  if (dias > 0) p.set('f_TPR', `r${dias * 86400}`);
  if (millas > 0) p.set('distance', String(millas));
  if (MODALIDAD_LINKEDIN[modalidad]) p.set('f_WT', MODALIDAD_LINKEDIN[modalidad]);
  return `${URL_LINKEDIN_BUSCAR}?${p}`;
}

// Lista de tarjetas: se parte por el URN de cada oferta para que una rota no estropee las demás.
export function leerTarjetasLinkedIn(html) {
  const ofertas = [];
  for (const trozo of String(html).split(/data-entity-urn="urn:li:jobPosting:/).slice(1)) {
    const id = trozo.match(/^(\d+)/)?.[1];
    if (!id) continue;
    let puesto = limpio(trozo.match(/class="base-search-card__title"[^>]*>([\s\S]*?)<\/h3>/i)?.[1] ?? '');
    if (!puesto) puesto = limpio(trozo.match(/class="sr-only"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '');
    if (!puesto) continue;
    const empresa = limpio(trozo.match(/class="base-search-card__subtitle"[^>]*>([\s\S]*?)<\/h4>/i)?.[1] ?? '');
    const lugar = limpio(trozo.match(/class="job-search-card__location"[^>]*>([\s\S]*?)<\/span>/i)?.[1] ?? '');
    const fecha = trozo.match(/class="job-search-card__listdate[^"]*"[^>]*datetime="([^"]+)"/i)?.[1] ?? '';
    ofertas.push(
      quitarInvisibles({
        id: `li-${id}`,
        puesto,
        empresa,
        ubicacion: lugar,
        publicada: fecha,
        // El enlace estándar (el de la tarjeta lleva el subdominio del país y parámetros de seguimiento).
        url: `https://www.linkedin.com/jobs/view/${id}`,
        fuente: 'LinkedIn',
        origen: 'LinkedIn',
      }),
    );
  }
  return ofertas;
}

export function leerOfertaLinkedIn(html, id) {
  const puesto = html.match(/class="(?:top-card-layout__title|topcard__title)[^"]*"[^>]*>([\s\S]*?)<\/h[12]>/i)?.[1];
  const org = html.match(/class="topcard__org-name-link[^"]*"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  const lugar = html.match(/class="topcard__flavor topcard__flavor--bullet"[^>]*>([\s\S]*?)<\/span>/i)?.[1];
  const descripcion = contenidoDiv(html, 'show-more-less-html__markup') ?? contenidoDiv(html, 'description__text');
  const criterios = {};
  const re = /class="description__job-criteria-subheader"[^>]*>([\s\S]*?)<\/h3>[\s\S]*?class="description__job-criteria-text[^"]*"[^>]*>([\s\S]*?)<\/span>/gi;
  let c;
  while ((c = re.exec(html)) !== null) criterios[limpio(c[1]).toLowerCase()] = limpio(c[2]);
  const inicioDescripcion = html.search(/class="(?:show-more-less-html__markup|description__text)/i);
  const cabecera = inicioDescripcion === -1 ? html : html.slice(0, inicioDescripcion);
  return quitarInvisibles({
    id: `li-${id}`,
    puesto: puesto ? limpio(puesto) : '',
    empresa: org ? limpio(org[2]) : '',
    ubicacion: lugar ? limpio(lugar) : '',
    url: `https://www.linkedin.com/jobs/view/${id}`,
    fuente: 'LinkedIn',
    descripcion: descripcion ? textoDeHtml(descripcion) : '',
    nivel: criterios['seniority level'] ?? criterios['nivel de antigüedad'] ?? '',
    jornada: criterios['employment type'] ?? criterios['tipo de empleo'] ?? '',
    abierta: !/closed-job__flavor|no longer accepting applications|ya no acepta solicitudes/i.test(cabecera),
  });
}

export async function buscarLinkedIn(opciones, hacerFetch = fetch) {
  const r = await pedirConEspera(
    urlBusquedaLinkedIn(opciones),
    { headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8', 'X-Requested-With': 'XMLHttpRequest' } },
    hacerFetch,
  );
  if (r.status === 404) return [];
  if (!r.ok) throw new Error(`LinkedIn respondió ${r.status}`);
  return leerTarjetasLinkedIn(await r.text());
}

export const idLinkedIn = (url) => String(url ?? '').match(/linkedin\.com\/jobs\/view\/(?:[^/?#]*-)?(\d{6,})/i)?.[1] ?? null;

export async function detalleLinkedIn(id, hacerFetch = fetch) {
  const r = await pedirConEspera(`${URL_LINKEDIN_OFERTA}/${id}`, { headers: { 'User-Agent': UA, Accept: 'text/html', 'Accept-Language': 'es-ES,es;q=0.9' } }, hacerFetch);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`LinkedIn respondió ${r.status}`);
  return leerOfertaLinkedIn(await r.text(), id);
}

// ---------- freehire.me (freehire-search) ----------

const MODALIDAD_FREEHIRE = { remoto: 'remote', híbrido: 'hybrid', presencial: 'onsite' };

// País (ISO 3166 alfa-2) a partir de lo que escribe la persona.
const PAISES = [
  [/españa|spain|madrid|barcelona|valencia|sevilla|bilbao|málaga|malaga|zaragoza|alicante|murcia|vigo|coruña|granada|palma|valladolid|asturias|galicia|cataluña|andalucía|navarra|cantabria|canarias/i, 'es'],
  [/méxico|mexico|cdmx|guadalajara|monterrey/i, 'mx'],
  [/argentina|buenos aires/i, 'ar'],
  [/colombia|bogotá|bogota|medellín|medellin/i, 'co'],
  [/chile|santiago de chile/i, 'cl'],
  [/perú|peru|lima/i, 'pe'],
  [/portugal|lisboa|oporto|porto/i, 'pt'],
  [/francia|france|parís|paris/i, 'fr'],
  [/alemania|germany|deutschland|berlín|berlin|múnich|munich/i, 'de'],
  [/reino unido|united kingdom|uk\b|londres|london/i, 'gb'],
  [/irlanda|ireland|dublín|dublin/i, 'ie'],
  [/países bajos|holanda|netherlands|ámsterdam|amsterdam/i, 'nl'],
  [/italia|italy|milán|milan|roma\b/i, 'it'],
  [/estados unidos|usa|united states|nueva york|new york/i, 'us'],
];
export const paisDe = (texto) => PAISES.find(([re]) => re.test(texto ?? ''))?.[1] ?? '';

export async function buscarFreehire({ palabras, ubicacion, pais = null, dias = 30, modalidad = '', limite = 12 }, hacerFetch = fetch) {
  const p = new URLSearchParams({ q: palabras, limit: String(limite), offset: '0', description_format: 'text' });
  if (dias > 0) p.set('posted_within_days', String(dias));
  if (MODALIDAD_FREEHIRE[modalidad]) p.set('work_mode', MODALIDAD_FREEHIRE[modalidad]);
  const codigo = pais ?? paisDe(ubicacion);
  if (codigo) p.append('countries', codigo);
  const r = await pedirConEspera(`${URL_FREEHIRE}/api/v1/agent/jobs/search?${p}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } }, hacerFetch);
  if (!r.ok) throw new Error(`freehire respondió ${r.status}`);
  const datos = await r.json();
  return (datos.data ?? []).map((j) => {
    const e = j.enrichment ?? {};
    const salario = e.salary_min || e.salary_max ? `${[e.salary_min, e.salary_max].filter(Boolean).join('–')} ${e.salary_currency ?? ''}${e.salary_period ? `/${e.salary_period === 'year' ? 'año' : e.salary_period}` : ''}`.trim() : '';
    return quitarInvisibles({
      id: `fh-${j.public_slug}`,
      puesto: decodificarEntidades(j.title ?? '').trim(),
      empresa: j.company ?? '',
      ubicacion: j.location ?? '',
      modalidad: { remote: 'remoto', hybrid: 'híbrido', onsite: 'presencial' }[j.work_mode] ?? '',
      salario,
      publicada: String(j.posted_at ?? '').slice(0, 10),
      // Su página en freehire siempre lleva a la oferta; el enlace original (j.url) suele ser
      // una redirección de un agregador (WhatJobs…) y se guarda aparte, limpio.
      url: `${URL_FREEHIRE}/jobs/${encodeURIComponent(j.public_slug)}`,
      urlOrigen: j.url ?? '',
      fuente: 'freehire',
      origen: j.source ?? '',
      requisitos: (j.skills ?? []).slice(0, 12),
      descripcion: textoDeHtml(j.description ?? '').slice(0, 12000),
    });
  });
}

export async function detalleFreehire(slug, hacerFetch = fetch) {
  const r = await pedirConEspera(`${URL_FREEHIRE}/api/v1/jobs/${encodeURIComponent(slug)}`, { headers: { 'User-Agent': UA, Accept: 'application/json' } }, hacerFetch);
  if (r.status === 404) return null;
  if (!r.ok) throw new Error(`freehire respondió ${r.status}`);
  const j = (await r.json()).data ?? {};
  return quitarInvisibles({
    puesto: decodificarEntidades(j.title ?? ''),
    empresa: j.company ?? '',
    ubicacion: j.location ?? '',
    url: `${URL_FREEHIRE}/jobs/${encodeURIComponent(slug)}`,
    urlOrigen: j.url ?? '',
    fuente: 'freehire',
    origen: j.source ?? '',
    descripcion: textoDeHtml(j.description ?? ''),
  });
}
export const slugFreehire = (url) => String(url ?? '').match(/^https:\/\/(?:[a-z0-9-]+\.)?freehire\.me\/jobs\/([a-z0-9-]+)/i)?.[1] ?? null;

// ---------- Modalidad (remoto, híbrido, presencial) ----------
// LinkedIn no la da en sus tarjetas ni en la ficha: se deduce del texto.
// Primero el título y el lugar; si no dicen nada, la descripción.
const REMOTO_SEGURO = /100\s*%\s*(en\s+)?(remot|teletrabajo)|(remoto|teletrabajo)\s*(al\s*)?100\s*%|full[\s-]*remote|fully[\s-]*remote|remote[\s-]*only|remote[\s-]*first|totalmente\s+(en\s+)?remot|en\s+remoto\s+total/;
const HIBRIDO = /h[ií]brid|hybrid|semi[\s-]*presencial|presencialidad\s*\/\s*teletrabajo|teletrabajo\s*\/\s*presencial|\d\s*d[ií]as?\s+(a\s+la\s+semana\s+|por\s+semana\s+|semanales\s+)?(en\s+|de\s+)(la\s+)?oficina|\d\s*d[ií]as?\s+(de\s+)?(teletrabajo|presencial)|teletrabajo\s+\d\s*d[ií]as?|remoto\s*\+\s*\d|\d\s*days?\s+(a|per)\s+week\s+(in|on|at)\s+(the\s+)?(office|site)|days?\s+(in|at)\s+the\s+office/;
const NO_REMOTO = /\b(no|sin)\s+(es\s+)?(un\s+)?(puesto\s+|trabajo\s+)?(en\s+)?(remoto|teletrabajo)|not\s+(a\s+)?(fully\s+)?remote|no\s+remote|non[\s-]remote|100\s*%\s*presencial/;
const REMOTO = /\bremot[oa]s?\b|\bremote\b|teletrabaj|work\s+from\s+home|\bwfh\b|desde\s+casa|anywhere/;
const PRESENCIAL = /presencial|on[\s-]?site|in[\s-]office|en\s+(la|nuestra|nuestras)\s+oficinas?/;

function modalidadDe(texto) {
  const t = String(texto ?? '').toLowerCase();
  if (!t.trim()) return '';
  if (REMOTO_SEGURO.test(t)) return 'remoto';
  if (HIBRIDO.test(t)) return 'híbrido';
  if (NO_REMOTO.test(t)) return 'presencial';
  if (REMOTO.test(t)) return 'remoto';
  if (PRESENCIAL.test(t)) return 'presencial';
  return '';
}
export function modalidadDeTexto({ puesto = '', ubicacion = '', descripcion = '' } = {}) {
  return modalidadDe(`${puesto} · ${ubicacion}`) || modalidadDe(String(descripcion).slice(0, 8000));
}

// ¿Sirve una oferta de esta modalidad a quien busca «quiere»? Si no se sabe, sí (la IA la revisa).
export function aceptaModalidad(quiere, tiene) {
  if (!tiene || !quiere) return true;
  if (quiere === 'remoto') return tiene === 'remoto';
  if (quiere === 'híbrido') return tiene !== 'presencial';
  return true;
}

// ---------- Búsqueda combinada ----------

// Busca cada puesto (hasta 3) en cada zona (hasta 5) en los dos portales a la
// vez, hasta 8 combinaciones; los fallos de un portal no tumban la búsqueda.
// Devuelve ofertas sin repetir y los errores.
const MAX_COMBINACIONES = 8;
export async function buscarEnPortales({ puestos, ubicacion, zonas = [], distancia = 0, modalidad = '', dias = 14 }, hacerFetch = fetch) {
  const lista = String(puestos ?? '')
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (!lista.length) throw new Error('Di qué puesto buscar.');
  const donde = (zonas.length ? zonas : [ubicacion || 'España']).slice(0, 5).map(resolverZona);
  const combinaciones = [];
  for (const zona of donde) for (const palabras of lista) combinaciones.push({ zona, palabras });
  const tareas = combinaciones.slice(0, MAX_COMBINACIONES).flatMap(({ zona, palabras }) => {
    // Una zona «en remoto» manda sobre la modalidad elegida.
    const mod = zona.modalidad ?? modalidad;
    const millas = zona.tipo === 'ciudad' || zona.tipo === 'provincia' || zona.tipo === 'libre' ? millasDe(distancia) : 0;
    return [
      buscarLinkedIn({ palabras, ubicacion: zona.busqueda, modalidad: mod, dias, millas }, hacerFetch).then((o) => ({ portal: 'LinkedIn', ofertas: o.map((x) => ({ ...x, quiere: mod })) })),
      buscarFreehire({ palabras, ubicacion: zona.busqueda, pais: zona.pais || null, modalidad: mod, dias: Math.max(dias, 30) }, hacerFetch).then((o) => ({
        portal: 'freehire',
        ofertas: o.map((x) => ({ ...x, quiere: mod })),
      })),
    ];
  });
  const resultados = await Promise.allSettled(tareas);
  const vistas = new Set();
  const ofertas = [];
  const errores = [];
  // Intercaladas: una de cada portal y búsqueda, para no llenar la lista con el primero.
  const listas = resultados.map((r) => (r.status === 'fulfilled' ? r.value.ofertas : (errores.push(r.reason?.message ?? 'error'), [])));
  for (let i = 0; ofertas.length < 45 && listas.some((l) => i < l.length); i++) {
    for (const l of listas) {
      const o = l[i];
      const clave = o && `${o.puesto}|${o.empresa}`.toLowerCase();
      if (o && o.url && !vistas.has(o.url) && !vistas.has(clave)) {
        vistas.add(o.url);
        vistas.add(clave);
        ofertas.push(o);
      }
    }
  }
  // Modalidad: la de freehire o la que diga el texto. Si se busca en remoto (o
  // híbrido) y una tarjeta de LinkedIn no lo dice, se lee su ficha (hasta 10).
  for (const o of ofertas) o.modalidad ||= modalidadDeTexto(o);
  const porLeer = ofertas.filter((o) => o.quiere && o.quiere !== 'presencial' && !o.modalidad && o.fuente === 'LinkedIn').slice(0, MAX_FICHAS);
  for (let i = 0; i < porLeer.length; i += 3) {
    await Promise.all(
      porLeer.slice(i, i + 3).map(async (o) => {
        try {
          const ficha = await detalleLinkedIn(o.id.replace(/^li-/, ''), hacerFetch);
          if (!ficha) return;
          if (ficha.descripcion) o.descripcion = ficha.descripcion.slice(0, 12000);
          if (ficha.abierta === false) o.cerrada = true;
          o.modalidad = modalidadDeTexto({ puesto: o.puesto, ubicacion: o.ubicacion, descripcion: ficha.descripcion });
        } catch {
          // Si la ficha no se deja leer, la oferta se queda y la IA la revisa.
        }
      }),
    );
  }
  const validas = ofertas.filter((o) => !o.cerrada && aceptaModalidad(o.quiere, o.modalidad));
  const descartadas = ofertas.length - validas.length;
  return {
    ofertas: validas.slice(0, 30).map(({ quiere, cerrada, ...o }) => o),
    errores: [...new Set(errores)],
    ...(descartadas ? { descartadas } : {}),
  };
}
const MAX_FICHAS = 10;

// Oferta completa a partir de su enlace (LinkedIn, freehire o cualquier web).
export async function detalleOferta(url, hacerFetch = fetch) {
  const li = idLinkedIn(url);
  if (li) return detalleLinkedIn(li, hacerFetch);
  const fh = slugFreehire(url);
  if (fh) return detalleFreehire(fh, hacerFetch);
  const r = await hacerFetch(url, { headers: { 'User-Agent': UA, Accept: 'text/html' }, redirect: 'follow' });
  if (!r.ok) throw new Error(`La página respondió ${r.status}`);
  const tipo = r.headers.get('Content-Type') ?? '';
  if (!/html|text/.test(tipo)) throw new Error('Esa dirección no es una página de oferta.');
  const html = (await r.text()).slice(0, 600_000);
  const titulo = limpio(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
  const cuerpo = html.match(/<body[^>]*>([\s\S]*)<\/body>/i)?.[1] ?? html;
  return quitarInvisibles({ puesto: titulo.slice(0, 160), url, fuente: new URL(url).hostname.replace(/^www\./, ''), descripcion: textoDeHtml(cuerpo.replace(/<(nav|header|footer)\b[\s\S]*?<\/\1>/gi, ' ')).slice(0, 12000) });
}
