// OpenAI (GPT-6 Luna por defecto): de pago por uso con tu propia clave.
// El chat va por Chat Completions en directo (como Groq: mismas herramientas,
// mismo traductor de historial) y sin razonamiento, para responder al momento.
// La búsqueda web y las tareas de Empleo van por la API Responses, que trae la
// búsqueda en internet y deja razonar un poco más cuando hace falta.
import { herramientasOpenAI, mensajesOpenAI, inicioReciente, leerFlujoChat } from './groq.js';
import { usoDeChat, usoDeRespuesta } from './consumo.js';

export const URL_OPENAI = 'https://api.openai.com/v1';
export const MODELOS_OPENAI = ['gpt-6-luna', 'gpt-6.1-terra', 'gpt-6.1-sol'];
// Sin el límite por minuto de Groq: cabe mucha más conversación.
const PRESUPUESTO_HISTORIAL = 60_000; // caracteres, unos 15.000 tokens
const MAX_RESPUESTA = 4000;

export class ErrorOpenAI extends Error {}

function mensajeDeEstado(estado, codigo, detalle) {
  if (estado === 401) return 'La clave de OpenAI no es válida. Revísala en Ajustes.';
  if (codigo === 'insufficient_quota' || /quota|billing/i.test(detalle)) {
    return 'Te has quedado sin saldo en OpenAI. Añade saldo en platform.openai.com → Billing.';
  }
  if (estado === 429) return 'OpenAI va al límite de peticiones por minuto. Espera un momento y vuelve a probar.';
  if (estado === 404 || codigo === 'model_not_found') return 'El modelo de OpenAI elegido no está disponible en tu cuenta. Elige otro en Ajustes.';
  if (estado === 400 && /context|too long|maximum/i.test(detalle)) return 'La conversación es demasiado larga. Empieza una conversación nueva.';
  if (estado === 400 && /tool|function/i.test(detalle)) return 'La IA se ha liado al usar una herramienta. Prueba a pedírmelo de otra forma.';
  if (estado >= 500) return 'OpenAI ha tenido un problema. Prueba de nuevo en un momento.';
  return `OpenAI devolvió un error: ${detalle || estado}`;
}

const dormir = (ms, signal) =>
  new Promise((resolver, rechazar) => {
    if (signal?.aborted) return rechazar(signal.reason);
    const reloj = setTimeout(resolver, ms);
    signal?.addEventListener('abort', () => (clearTimeout(reloj), rechazar(signal.reason)), { once: true });
  });

async function pedir(apiKey, ruta, { cuerpo, signal, fetch: hacerFetch = fetch } = {}) {
  for (let intento = 0; ; intento++) {
    let respuesta;
    try {
      respuesta = await hacerFetch(`${URL_OPENAI}${ruta}`, {
        method: cuerpo ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ErrorOpenAI('No hay conexión con OpenAI. Revisa tu conexión a internet.');
    }
    if (respuesta.ok) return respuesta;
    const datos = await respuesta.json().catch(() => ({}));
    const codigo = datos.error?.code ?? datos.error?.type ?? '';
    const detalle = datos.error?.message ?? '';
    // Un tropiezo pasajero (límite por minuto o fallo del servidor): se espera un poco y se repite.
    const pasajero = (respuesta.status === 429 && codigo !== 'insufficient_quota') || respuesta.status >= 500;
    if (pasajero && intento < 2) {
      const segundos = Math.min(10, Number(respuesta.headers.get('retry-after')) || 2 ** intento);
      await dormir(segundos * 1000, signal);
      continue;
    }
    throw new ErrorOpenAI(mensajeDeEstado(respuesta.status, codigo, detalle));
  }
}

// Un turno de la conversación con respuesta en directo, en el formato de Claude.
// alUso(modelo, uso): para llevar la cuenta de lo gastado (ver consumo.js).
export async function turnoOpenAI({ apiKey, modelo, sistema, historial, inicioTurno, herramientas, signal, alTexto, alUso, fetch }) {
  const reciente = historial.slice(inicioReciente(historial, inicioTurno, PRESUPUESTO_HISTORIAL));
  const tools = herramientasOpenAI(herramientas);
  const respuesta = await pedir(apiKey, '/chat/completions', {
    signal,
    fetch,
    cuerpo: {
      model: modelo,
      messages: mensajesOpenAI(sistema, reciente),
      stream: true,
      // Al final llegan los tokens usados: así Kitsune sabe lo que ha costado.
      stream_options: { include_usage: true },
      max_completion_tokens: MAX_RESPUESTA,
      ...(tools.length ? { tools } : {}),
      // Con herramientas en Chat Completions, sin razonamiento (y así responde antes).
      reasoning_effort: 'none',
      // Mismo prefijo (sistema y herramientas) en cada turno: OpenAI lo cobra a precio de caché.
      prompt_cache_key: 'kitsune-chat',
      store: false,
    },
  });
  const mensaje = await leerFlujoChat(respuesta, alTexto, (detalle) => new ErrorOpenAI(mensajeDeEstado(0, '', detalle)));
  alUso?.(modelo, usoDeChat(mensaje.usage));
  return mensaje;
}

// ---------- API Responses: búsqueda web, borradores y tareas ----------

function textoYFuentes(datos) {
  let texto = '';
  const fuentes = new Map();
  for (const item of datos.output ?? []) {
    if (item.type !== 'message') continue;
    for (const c of item.content ?? []) {
      if (c.type === 'refusal') throw new ErrorOpenAI('OpenAI no ha querido hacer esto.');
      if (c.type !== 'output_text') continue;
      texto += c.text ?? '';
      for (const a of c.annotations ?? []) {
        if (a.type === 'url_citation' && /^https?:\/\//.test(a.url ?? '')) fuentes.set(a.url.replace(/[?&]utm_source=openai$/, ''), a.title || '');
      }
    }
  }
  return {
    texto: texto.trim(),
    fuentes: [...fuentes].slice(0, 5).map(([url, titulo]) => ({ url, titulo: titulo || new URL(url).hostname.replace(/^www\./, '') })),
  };
}

async function responder(apiKey, cuerpo, { signal, fetch, alUso } = {}) {
  const respuesta = await pedir(apiKey, '/responses', { signal, fetch, cuerpo: { store: false, ...cuerpo } });
  const datos = await respuesta.json();
  alUso?.(cuerpo.model, usoDeRespuesta(datos));
  const resultado = textoYFuentes(datos);
  if (!resultado.texto) {
    throw new ErrorOpenAI(
      datos.status === 'incomplete' ? 'La respuesta de OpenAI se ha quedado a medias. Vuelve a intentarlo.' : 'OpenAI no ha devuelto nada. Vuelve a intentarlo.',
    );
  }
  return resultado;
}

// Una respuesta suelta, sin conversación (borradores de correo).
export async function textoOpenAI({ apiKey, modelo, sistema, usuario, fetch, alUso }) {
  const { texto } = await responder(apiKey, { model: modelo, instructions: sistema, input: usuario, reasoning: { effort: 'low' }, max_output_tokens: 6000 }, { fetch, alUso });
  return texto;
}

// Una tarea fuera del chat (Empleo). Si pide JSON, OpenAI garantiza que la
// respuesta sea JSON válido. Con web, busca en internet. Devuelve { texto, fuentes }.
export async function tareaOpenAI({ apiKey, modelo, sistema, usuario, web = false, max = 8000, fetch, alUso }) {
  const json = !web && /\bJSON\b/.test(`${sistema}\n${usuario}`);
  return responder(
    apiKey,
    {
      model: modelo,
      instructions: sistema,
      input: usuario,
      reasoning: { effort: web ? 'medium' : 'low' },
      // El razonamiento cuenta para el máximo: se deja margen.
      max_output_tokens: max + 6000,
      ...(web ? { tools: [{ type: 'web_search' }] } : {}),
      ...(json ? { text: { format: { type: 'json_object' } } } : {}),
    },
    { fetch, alUso },
  );
}

// La herramienta buscar_en_internet del chat: una búsqueda aparte que devuelve un resumen con fuentes.
export async function buscarEnInternetOpenAI({ apiKey, modelo = MODELOS_OPENAI[0], consulta, signal, fetch, alUso }) {
  const { texto, fuentes } = await responder(
    apiKey,
    {
      model: modelo,
      instructions:
        `Hoy es ${new Date().toLocaleDateString('es-ES', { dateStyle: 'full' })}. Busca en internet y responde en español ` +
        'con los datos concretos que encuentres (cifras, fechas, nombres), en menos de 150 palabras. Si no encuentras nada fiable, dilo.',
      input: String(consulta ?? '').slice(0, 500),
      tools: [{ type: 'web_search' }],
      tool_choice: 'required',
      reasoning: { effort: 'low' },
      max_output_tokens: 4000,
    },
    { signal, fetch, alUso },
  );
  return { resultado: texto, fuentes };
}

// Comprueba la clave sin gastar nada: pide la lista de modelos.
export async function probarClaveOpenAI(apiKey, fetch) {
  await pedir(apiKey, '/models', { fetch });
}
