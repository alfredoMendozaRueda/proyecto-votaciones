// Modos de IA cuando tienes las dos claves, Groq (gratis) y OpenAI (GPT-6 Luna,
// de pago): qué IA hace cada cosa. Si una falla o llega a su límite, lo hace
// la otra, así nada se queda a medias.
//
//   chat   → la conversación con Kitsune
//   web    → buscar en internet (en el chat y al investigar una empresa)
//   fondo  → lo que no ves: puntuar ofertas, leerlas, borradores, extraer citas…
//   final  → lo que sale de Kitsune con tu nombre: la revisión del CV y la carta, la entrevista

export const MODOS_IA = ['ahorro', 'eficiente', 'calidad'];
export const MODO_POR_DEFECTO = 'eficiente';

export const INFO_MODOS = {
  ahorro: { nombre: 'Ahorro', detalle: 'Todo con Groq, gratis. GPT-6 Luna solo si Groq llega a su límite.' },
  eficiente: { nombre: 'Eficiente', detalle: 'Chat y revisión final con GPT-6 Luna; búsquedas y tareas de fondo con Groq. Muchas más candidaturas por el mismo dinero.' },
  calidad: { nombre: 'Calidad', detalle: 'Todo con GPT-6 Luna. Groq solo si te quedas sin saldo o sin presupuesto.' },
};

const REPARTO = {
  ahorro: { chat: 'groq', web: 'groq', fondo: 'groq', final: 'groq' },
  eficiente: { chat: 'openai', web: 'groq', fondo: 'groq', final: 'openai' },
  calidad: { chat: 'openai', web: 'openai', fondo: 'openai', final: 'openai' },
};

export const normalizarModo = (m) => (MODOS_IA.includes(m) ? m : MODO_POR_DEFECTO);

// → [principal, respaldo] según el modo y las claves que haya ({ groq, openai }).
export function rutaIA(modo, tipo, disponibles) {
  const quiere = REPARTO[normalizarModo(modo)][tipo] ?? 'openai';
  const otro = quiere === 'groq' ? 'openai' : 'groq';
  if (disponibles[quiere]) return [quiere, disponibles[otro] ? otro : null];
  return [disponibles[otro] ? otro : null, null];
}

// Prueba con la principal y, si falla (límite, sin saldo, caída…), con la de respaldo.
// Si también falla la de respaldo, se cuenta el error de la principal, que es el que se esperaba.
export async function conRespaldo([principal, respaldo], hacer, { signal } = {}) {
  try {
    return await hacer(principal);
  } catch (error) {
    if (!respaldo || signal?.aborted || error?.name === 'AbortError') throw error;
    try {
      return await hacer(respaldo);
    } catch {
      throw error;
    }
  }
}

// ---------- Lo que cuesta cada modo (medido con los prompts reales y GPT-6 Luna) ----------
// Puntuar ~12 ofertas al día: 0,0015 $. Una candidatura: redactar 0,0013 $,
// revisar 0,0015 $, entrevista aparte; investigar la empresa 0,0105 $ (0,01 $ es la búsqueda).
const COSTES = {
  ahorro: { puntuar: 0, candidatura: 0, investigar: 0 },
  eficiente: { puntuar: 0, candidatura: 0.0015, investigar: 0 },
  calidad: { puntuar: 0.0015, candidatura: 0.0034, investigar: 0.0105 },
};
// Cuántas candidaturas puede preparar el servidor cada mañana en cada modo.
export const MAX_PREPARAR = { ahorro: 10, eficiente: 10, calidad: 5 };

export const costeCandidatura = (modo, investigar = true) => {
  const c = COSTES[normalizarModo(modo)];
  return c.candidatura + (investigar ? c.investigar : 0);
};

export function costeMensualAlerta({ modo, preparar = 0, investigar = true }) {
  const c = COSTES[normalizarModo(modo)];
  return 30 * (c.puntuar + preparar * costeCandidatura(modo, investigar));
}
