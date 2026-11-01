// Groq: IA gratuita (modelos abiertos) con una API compatible con OpenAI.
// Kitsune guarda el historial en el formato de Claude; aquí se traduce al de
// Groq para cada petición y la respuesta vuelve al formato de Claude, así el
// historial, la memoria y las herramientas sirven igual con las dos IA.

export const URL_GROQ = 'https://api.groq.com/openai/v1';
// Los modelos del plan gratuito (Llama dejó de estarlo en agosto de 2026).
export const MODELOS_GROQ = ['openai/gpt-oss-120b', 'openai/gpt-oss-20b', 'qwen/qwen3.8-27b'];

// La capa gratuita permite unos 8.000 tokens por minuto, sumando lo que se
// envía y lo que se responde: solo viaja la parte reciente de la conversación.
// Groq cuenta para ese límite lo que se envía más lo que se reserva para la
// respuesta, así que las dos cosas se mantienen pequeñas.
const PRESUPUESTO_HISTORIAL = 5000; // caracteres, unos 1.250 tokens
const MAX_RESPUESTA = 1200; // tokens, razonamiento incluido
// Si el límite por minuto se libera pronto, se espera y se repite solo.
// Una espera corta se hace en el sitio; si es larga, antes se prueba otro modelo
// (cada uno tiene su cupo) y solo si todos están llenos se espera hasta un minuto.
const ESPERA_MAXIMA = 8; // segundos, en el sitio
const ESPERA_TODOS = 65; // segundos, con todos los modelos llenos
const MAX_ESPERAS = 2;

export class ErrorGroq extends Error {
  constructor(mensaje, { limite = null, probarOtro = Boolean(limite) } = {}) {
    super(mensaje);
    this.limite = limite; // 'minuto' o 'dia' cuando es un 429
    this.probarOtro = probarOtro; // otro modelo podría responder
  }
}

function mensajeDeEstado(estado, detalle, limite) {
  if (estado === 401) return 'La clave de Groq no es válida. Revísala en Ajustes.';
  if (limite === 'dia') return 'Has gastado el uso gratuito de Groq de hoy. Vuelve a probar mañana o usa Claude en Ajustes.';
  if (estado === 429) return 'Groq va al límite de uso gratuito por minuto. Espera un minuto y vuelve a probar.';
  if (estado === 413) return 'La conversación es demasiado larga para la versión gratuita. Empieza una conversación nueva.';
  if (estado === 400 && /tool/i.test(detalle)) return 'La IA se ha liado al usar una herramienta. Prueba a pedírmelo de otra forma.';
  if (estado >= 500) return 'Groq ha tenido un problema. Prueba de nuevo en un momento.';
  return `Groq devolvió un error: ${detalle.replaceAll('`', '') || estado}`;
}

// "Please try again in 11.25s", "in 1m2.5s", "in 340ms" o la cabecera retry-after.
export function segundosDeEspera(cabecera, detalle) {
  const segundos = Number(cabecera);
  if (cabecera && Number.isFinite(segundos)) return segundos;
  const ms = /try again in ([\d.]+)ms/i.exec(detalle ?? '');
  if (ms) return Number(ms[1]) / 1000;
  const m = /try again in (?:(\d+)h)?(?:(\d+)m(?!s))?(?:([\d.]+)s)?/i.exec(detalle ?? '');
  if (!m || !(m[1] || m[2] || m[3])) return null;
  return Number(m[1] ?? 0) * 3600 + Number(m[2] ?? 0) * 60 + Number(m[3] ?? 0);
}

const dormir = (ms, signal) =>
  new Promise((resolver, rechazar) => {
    if (signal?.aborted) return rechazar(signal.reason);
    const reloj = setTimeout(resolver, ms);
    signal?.addEventListener('abort', () => (clearTimeout(reloj), rechazar(signal.reason)), { once: true });
  });

async function pedir(apiKey, ruta, { cuerpo, signal, fetch: hacerFetch = fetch, alEsperar } = {}) {
  for (let esperas = 0; ; esperas++) {
    let respuesta;
    try {
      respuesta = await hacerFetch(`${URL_GROQ}${ruta}`, {
        method: cuerpo ? 'POST' : 'GET',
        headers: { Authorization: `Bearer ${apiKey}`, ...(cuerpo ? { 'Content-Type': 'application/json' } : {}) },
        body: cuerpo ? JSON.stringify(cuerpo) : undefined,
        signal,
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new ErrorGroq('No hay conexión con Groq. Revisa tu conexión a internet.');
    }
    if (respuesta.ok) return respuesta;
    const datos = await respuesta.json().catch(() => ({}));
    const detalle = datos.error?.message ?? '';
    if (respuesta.status === 404 || /does not exist|decommissioned|model_not_found/i.test(detalle)) {
      throw new ErrorGroq('El modelo de Groq elegido ya no está disponible. Elige otro en Ajustes.', { probarOtro: true });
    }
    if (respuesta.status !== 429) throw new ErrorGroq(mensajeDeEstado(respuesta.status, detalle));
    const limite = /per day|\b[TR]PD\b/i.test(detalle) ? 'dia' : 'minuto';
    const espera = segundosDeEspera(respuesta.headers.get('retry-after'), detalle) ?? 10;
    if (limite === 'dia' || espera > ESPERA_MAXIMA || esperas >= MAX_ESPERAS) {
      const error = new ErrorGroq(mensajeDeEstado(429, detalle, limite), { limite });
      error.espera = espera;
      throw error;
    }
    alEsperar?.(Math.ceil(espera));
    await dormir(espera * 1000 + 250, signal);
  }
}

// Cada modelo tiene su propio cupo gratuito: si el elegido lo ha gastado (o
// Groq lo ha retirado), se prueba con los demás antes de rendirse.
async function conRespaldo(modelo, peticion, alternativas = MODELOS_GROQ, { alEsperar, signal } = {}) {
  const modelos = [modelo, ...alternativas.filter((m) => m !== modelo)];
  const llenos = [];
  for (const [i, m] of modelos.entries()) {
    try {
      return await peticion(m);
    } catch (error) {
      if (!(error instanceof ErrorGroq) || !error.probarOtro) throw error;
      if (error.limite === 'minuto') llenos.push(error);
      if (i < modelos.length - 1) continue;
      // Todos llenos por el límite de este minuto: se espera lo justo (con aviso) y se repite una vez.
      if (alEsperar && llenos.length === modelos.length) {
        const espera = Math.min(...llenos.map((e) => e.espera ?? ESPERA_TODOS));
        if (espera <= ESPERA_TODOS) {
          alEsperar(Math.ceil(espera));
          await dormir(espera * 1000 + 300, signal);
          return peticion(modelo);
        }
      }
      throw error;
    }
  }
}

// Herramientas de Kitsune en el formato de OpenAI. Las del servidor de
// Anthropic (búsqueda web) no tienen equivalente y se quedan fuera.
export function herramientasOpenAI(herramientas) {
  return herramientas
    .filter((h) => h.input_schema)
    .map((h) => ({ type: 'function', function: { name: h.name, description: h.description, parameters: h.input_schema } }));
}

const textoDe = (contenido) =>
  typeof contenido === 'string'
    ? contenido
    : contenido
        .filter((b) => b.type === 'text')
        .map((b) => b.text)
        .join('\n');

// Historial de Kitsune (formato Claude) → mensajes de OpenAI.
export function mensajesOpenAI(sistema, historial) {
  const mensajes = [{ role: 'system', content: sistema }];
  for (const m of historial) {
    const bloques = typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : m.content;
    if (m.role === 'user') {
      const resultados = bloques.filter((b) => b.type === 'tool_result');
      for (const r of resultados) {
        const contenido = typeof r.content === 'string' ? r.content : textoDe(r.content ?? []);
        mensajes.push({ role: 'tool', tool_call_id: r.tool_use_id, content: r.is_error ? `Error: ${contenido}` : contenido });
      }
      const texto = textoDe(bloques.filter((b) => b.type === 'text'));
      if (texto) mensajes.push({ role: 'user', content: texto });
    } else {
      // Razonamientos, búsquedas web y demás bloques propios de Claude no se envían.
      const usos = bloques.filter((b) => b.type === 'tool_use');
      const texto = textoDe(bloques);
      if (!texto && !usos.length) continue;
      mensajes.push({
        role: 'assistant',
        content: texto || null,
        ...(usos.length
          ? { tool_calls: usos.map((u) => ({ id: u.id, type: 'function', function: { name: u.name, arguments: JSON.stringify(u.input ?? {}) } })) }
          : {}),
      });
    }
  }
  return mensajes;
}

// Desde qué mensaje se envía: el turno actual siempre; los anteriores mientras
// quepan. Siempre se empieza en una pregunta del usuario (no en resultados de
// herramientas) para no dejar llamadas a medias.
export function inicioReciente(historial, inicioTurno, presupuesto = PRESUPUESTO_HISTORIAL) {
  const empiezaTurno = (m) => m.role === 'user' && !(Array.isArray(m.content) && m.content.some((b) => b.type === 'tool_result'));
  let desde = inicioTurno;
  let tamano = JSON.stringify(historial.slice(inicioTurno)).length;
  for (let i = inicioTurno - 1; i >= 0; i--) {
    tamano += JSON.stringify(historial[i]).length;
    if (tamano > presupuesto) break;
    if (empiezaTurno(historial[i])) desde = i;
  }
  return desde;
}

// Respuestas rápidas: poco razonamiento en GPT-OSS y ninguno en Qwen.
function parametrosModelo(modelo) {
  if (modelo.startsWith('openai/gpt-oss')) return { reasoning_effort: 'low' };
  if (modelo.startsWith('qwen/')) return { reasoning_effort: 'none' };
  return {};
}

// Un turno de la conversación con respuesta en directo. Devuelve el mensaje
// en el formato de Claude: { content: [...bloques], stop_reason }.
export async function turnoGroq({ apiKey, modelo, sistema, historial, inicioTurno, herramientas, signal, alTexto, alEsperar, fetch }) {
  const reciente = historial.slice(inicioReciente(historial, inicioTurno));
  const tools = herramientasOpenAI(herramientas);
  const messages = mensajesOpenAI(sistema, reciente);
  const respuesta = await conRespaldo(modelo, (m) =>
    pedir(apiKey, '/chat/completions', {
      signal,
      fetch,
      alEsperar,
      cuerpo: {
        model: m,
        messages,
        stream: true,
        max_completion_tokens: MAX_RESPUESTA,
        ...(tools.length ? { tools } : {}),
        ...parametrosModelo(m),
      },
    }),
    MODELOS_GROQ,
    { alEsperar, signal },
  );

  return leerFlujoChat(respuesta, alTexto, (detalle) => new ErrorGroq(mensajeDeEstado(0, detalle)));
}

// Lee una respuesta en directo de Chat Completions (Groq y OpenAI) y la
// devuelve en el formato de Claude: { content: [...bloques], stop_reason }.
export async function leerFlujoChat(respuesta, alTexto, crearError = (detalle) => new Error(detalle)) {
  let texto = '';
  let motivo = null;
  let usage = null;
  const llamadas = [];
  const lector = respuesta.body.getReader();
  const decodificador = new TextDecoder();
  let pendiente = '';
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    pendiente += decodificador.decode(value, { stream: true });
    const lineas = pendiente.split('\n');
    pendiente = lineas.pop();
    for (const linea of lineas) {
      if (!linea.startsWith('data:')) continue;
      const datos = linea.slice(5).trim();
      if (!datos || datos === '[DONE]') continue;
      const trozo = JSON.parse(datos);
      if (trozo.error) throw crearError(trozo.error.message ?? '');
      if (trozo.usage) usage = trozo.usage;
      const eleccion = trozo.choices?.[0];
      if (!eleccion) continue;
      const delta = eleccion.delta ?? {};
      if (delta.content) {
        texto += delta.content;
        alTexto?.(delta.content);
      }
      for (const llamada of delta.tool_calls ?? []) {
        const acumulada = (llamadas[llamada.index ?? 0] ??= { id: '', nombre: '', argumentos: '' });
        if (llamada.id) acumulada.id = llamada.id;
        if (llamada.function?.name) acumulada.nombre = llamada.function.name;
        if (llamada.function?.arguments) acumulada.argumentos += llamada.function.arguments;
      }
      if (eleccion.finish_reason) motivo = eleccion.finish_reason;
    }
  }

  const content = [];
  if (texto) content.push({ type: 'text', text: texto });
  for (const [i, llamada] of llamadas.entries()) {
    if (!llamada) continue;
    let input;
    try {
      input = JSON.parse(llamada.argumentos || '{}');
    } catch {
      // Kitsune lo rechaza al validar y se lo dice a la IA para que lo repita.
      input = { argumentos_no_validos: llamada.argumentos };
    }
    content.push({ type: 'tool_use', id: llamada.id || `llamada_${Date.now()}_${i}`, name: llamada.nombre, input });
  }
  const usaHerramientas = content.some((b) => b.type === 'tool_use');
  const stop_reason = motivo === 'length' ? 'max_tokens' : usaHerramientas ? 'tool_use' : 'end_turn';
  return { content, stop_reason, usage };
}

// Una respuesta suelta, sin conversación (borradores de correo).
export async function textoGroq({ apiKey, modelo, sistema, usuario, fetch }) {
  const respuesta = await conRespaldo(modelo, (m) =>
    pedir(apiKey, '/chat/completions', {
      fetch,
      cuerpo: {
        model: m,
        messages: [
          { role: 'system', content: sistema },
          { role: 'user', content: usuario },
        ],
        max_completion_tokens: 2000,
        ...parametrosModelo(m),
      },
    }),
  );
  const datos = await respuesta.json();
  return (datos.choices?.[0]?.message?.content ?? '').trim();
}

// Una tarea más larga fuera del chat (Empleo): analizar un CV, buscar ofertas,
// adaptar un CV… Con web, el modelo puede buscar y abrir páginas
// (browser_search, solo en los GPT-OSS). Devuelve { texto, fuentes }.
export async function tareaGroq({ apiKey, modelo, sistema, usuario, web = false, max = 4000, fetch }) {
  const alternativas = web ? ['openai/gpt-oss-120b', 'openai/gpt-oss-20b'] : MODELOS_GROQ;
  const respuesta = await conRespaldo(web ? 'openai/gpt-oss-120b' : modelo, (m) =>
    pedir(apiKey, '/chat/completions', {
      fetch,
      cuerpo: {
        model: m,
        messages: [
          { role: 'system', content: sistema },
          { role: 'user', content: usuario },
        ],
        max_completion_tokens: max,
        ...(web ? { tools: [{ type: 'browser_search' }], reasoning_effort: 'medium' } : parametrosModelo(m)),
      },
    }),
  alternativas);
  const datos = await respuesta.json();
  const mensaje = datos.choices?.[0]?.message ?? {};
  const texto = limpiarCitas(mensaje.content || '');
  if (!texto) throw new ErrorGroq('La IA no ha devuelto nada. Vuelve a intentarlo en un momento.');
  return { texto, fuentes: web ? fuentesDeBusqueda(mensaje, texto) : [] };
}

// Búsqueda web gratuita: la hacen los servidores de Groq con la herramienta
// browser_search de los modelos GPT-OSS. Va en una petición aparte (con el
// modelo pequeño, que tiene su propio límite) y devuelve un resumen corto,
// así funciona con cualquier modelo de chat y no llena la conversación.
const MODELO_BUSQUEDA = 'openai/gpt-oss-20b';
const URL_WEB = /https?:\/\/[^\s<>()\]【】"']+/g;

const limpiarCitas = (texto) => texto.replace(/【[^】]*】/g, '').replace(/[ \t]+\n/g, '\n').trim();

function fuentesDeBusqueda(mensaje, texto) {
  const urls = new Map();
  for (const herramienta of mensaje.executed_tools ?? []) {
    const resultados = herramienta.search_results?.results ?? herramienta.search_results ?? [];
    for (const r of Array.isArray(resultados) ? resultados : []) {
      if (typeof r?.url === 'string' && /^https?:\/\//.test(r.url)) urls.set(r.url, r.title || '');
    }
  }
  for (const url of texto.match(URL_WEB) ?? []) {
    const limpia = url.replace(/[.,;:]+$/, '');
    if (!urls.has(limpia)) urls.set(limpia, '');
  }
  return [...urls].slice(0, 5).map(([url, titulo]) => ({ url, titulo: titulo || new URL(url).hostname.replace(/^www\./, '') }));
}

export async function buscarEnInternetGroq({ apiKey, consulta, signal, alEsperar, fetch }) {
  const pedirBusqueda = (modelo) =>
    pedir(apiKey, '/chat/completions', { signal, fetch, alEsperar, cuerpo: cuerpoBusqueda(modelo, consulta) });
  // browser_search solo existe en los modelos GPT-OSS.
  const respuesta = await conRespaldo(MODELO_BUSQUEDA, pedirBusqueda, ['openai/gpt-oss-20b', 'openai/gpt-oss-120b']);
  const datos = await respuesta.json();
  const mensaje = datos.choices?.[0]?.message ?? {};
  // Si el modelo no llega a escribir el resumen, se usa lo que leyó.
  const leido = (mensaje.executed_tools ?? []).map((h) => (typeof h.output === 'string' ? h.output : '')).join('\n');
  const texto = limpiarCitas(mensaje.content || '') || limpiarCitas(leido).slice(0, 3000);
  if (!texto) throw new ErrorGroq('La búsqueda no ha devuelto resultados.');
  return { resultado: texto, fuentes: fuentesDeBusqueda(mensaje, texto) };
}

function cuerpoBusqueda(modelo, consulta) {
  return {
    model: modelo,
    messages: [
      {
        role: 'system',
        content:
          `Hoy es ${new Date().toLocaleDateString('es-ES', { dateStyle: 'full' })}. Busca en internet y responde en español ` +
          'con los datos concretos que encuentres (cifras, fechas, nombres), en menos de 120 palabras. Si no encuentras ' +
          'nada fiable, dilo. Al final, en una línea, las direcciones de las páginas que has usado.',
      },
      { role: 'user', content: consulta },
    ],
    tools: [{ type: 'browser_search' }],
    tool_choice: 'required',
    max_completion_tokens: MAX_RESPUESTA,
    reasoning_effort: 'low',
  };
}

// Comprueba la clave sin gastar nada: pide la lista de modelos.
export async function probarClaveGroq(apiKey, fetch) {
  await pedir(apiKey, '/models', { fetch });
}
