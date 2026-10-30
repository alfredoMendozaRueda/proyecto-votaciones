// Groq: IA gratuita (modelos abiertos) con una API compatible con OpenAI.
// Kitsune guarda el historial en el formato de Claude; aquí se traduce al de
// Groq para cada petición y la respuesta vuelve al formato de Claude, así el
// historial, la memoria y las herramientas sirven igual con las dos IA.

export const URL_GROQ = 'https://api.groq.com/openai/v1';
export const MODELOS_GROQ = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b'];

// La capa gratuita permite unos 8.000 tokens por minuto, sumando lo que se
// envía y lo que se responde: solo viaja la parte reciente de la conversación.
const PRESUPUESTO_HISTORIAL = 14_000; // caracteres, unos 3.500 tokens
const MAX_RESPUESTA = 3000; // tokens

export class ErrorGroq extends Error {}

function mensajeDeEstado(estado, detalle) {
  if (estado === 401) return 'La clave de Groq no es válida. Revísala en Ajustes.';
  if (estado === 429) return 'Has llegado al límite gratuito de Groq. Espera un minuto y vuelve a probar (si es el límite del día, mañana).';
  if (estado === 413) return 'La conversación es demasiado larga para la versión gratuita. Empieza una conversación nueva.';
  if (estado === 400 && /tool/i.test(detalle)) return 'La IA se ha liado al usar una herramienta. Prueba a pedírmelo de otra forma.';
  if (estado >= 500) return 'Groq ha tenido un problema. Prueba de nuevo en un momento.';
  return `Groq devolvió un error: ${detalle || estado}`;
}

async function pedir(apiKey, ruta, { cuerpo, signal, fetch: hacerFetch = fetch } = {}) {
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
  if (!respuesta.ok) {
    const datos = await respuesta.json().catch(() => ({}));
    throw new ErrorGroq(mensajeDeEstado(respuesta.status, datos.error?.message ?? ''));
  }
  return respuesta;
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

const parametrosModelo = (modelo) => (modelo.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low' } : {});

// Un turno de la conversación con respuesta en directo. Devuelve el mensaje
// en el formato de Claude: { content: [...bloques], stop_reason }.
export async function turnoGroq({ apiKey, modelo, sistema, historial, inicioTurno, herramientas, signal, alTexto, fetch }) {
  const reciente = historial.slice(inicioReciente(historial, inicioTurno));
  const tools = herramientasOpenAI(herramientas);
  const respuesta = await pedir(apiKey, '/chat/completions', {
    signal,
    fetch,
    cuerpo: {
      model: modelo,
      messages: mensajesOpenAI(sistema, reciente),
      stream: true,
      max_completion_tokens: MAX_RESPUESTA,
      ...(tools.length ? { tools } : {}),
      ...parametrosModelo(modelo),
    },
  });

  let texto = '';
  let motivo = null;
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
      if (trozo.error) throw new ErrorGroq(mensajeDeEstado(0, trozo.error.message));
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
  return { content, stop_reason };
}

// Una respuesta suelta, sin conversación (borradores de correo).
export async function textoGroq({ apiKey, modelo, sistema, usuario, fetch }) {
  const respuesta = await pedir(apiKey, '/chat/completions', {
    fetch,
    cuerpo: {
      model: modelo,
      messages: [
        { role: 'system', content: sistema },
        { role: 'user', content: usuario },
      ],
      max_completion_tokens: MAX_RESPUESTA,
      ...parametrosModelo(modelo),
    },
  });
  const datos = await respuesta.json();
  return (datos.choices?.[0]?.message?.content ?? '').trim();
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

export async function buscarEnInternetGroq({ apiKey, consulta, signal, fetch }) {
  const respuesta = await pedir(apiKey, '/chat/completions', {
    signal,
    fetch,
    cuerpo: {
      model: MODELO_BUSQUEDA,
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
      max_completion_tokens: 2000,
      reasoning_effort: 'low',
    },
  });
  const datos = await respuesta.json();
  const mensaje = datos.choices?.[0]?.message ?? {};
  // Si el modelo no llega a escribir el resumen, se usa lo que leyó.
  const leido = (mensaje.executed_tools ?? []).map((h) => (typeof h.output === 'string' ? h.output : '')).join('\n');
  const texto = limpiarCitas(mensaje.content || '') || limpiarCitas(leido).slice(0, 3000);
  if (!texto) throw new ErrorGroq('La búsqueda no ha devuelto resultados.');
  return { resultado: texto, fuentes: fuentesDeBusqueda(mensaje, texto) };
}

// Comprueba la clave sin gastar nada: pide la lista de modelos.
export async function probarClaveGroq(apiKey, fetch) {
  await pedir(apiKey, '/models', { fetch });
}
