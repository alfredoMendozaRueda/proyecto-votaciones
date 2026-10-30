// Utilidades del historial de una conversación (sin depender del SDK de
// Claude, para que la app abra sin cargarlo).

const ETIQUETA_CONTEXTO = /^<contexto>[\s\S]*<\/contexto>$/;
// Las acciones con texto envían el texto entre <texto>…</texto>: en pantalla, solo la instrucción.
const BLOQUE_TEXTO = /\n*<texto>[\s\S]*<\/texto>/;

export const esContexto = (texto) => ETIQUETA_CONTEXTO.test(texto);

// Lo que se ve en el chat: preguntas y respuestas, sin herramientas ni contexto.
export function mensajesVisibles(historial) {
  const visibles = [];
  for (const m of historial) {
    if (m.role === 'user') {
      if (typeof m.content === 'string') visibles.push({ rol: 'usuario', texto: m.content });
      else if (!m.content.some((b) => b.type === 'tool_result')) {
        const texto = m.content.filter((b) => b.type === 'text' && !esContexto(b.text)).map((b) => b.text).join('\n');
        if (texto) visibles.push({ rol: 'usuario', texto: texto.replace(BLOQUE_TEXTO, ' (texto)') });
      }
    } else {
      const texto = m.content.filter((b) => b.type === 'text').map((b) => b.text).join('').trim();
      if (texto) visibles.push({ rol: 'kitsune', texto });
    }
  }
  return visibles;
}

// Para guardar la conversación: quita turnos enteros del principio hasta que
// quepa. Un turno empieza en una pregunta del usuario (no en resultados de herramientas).
export function recortarHistorial(historial, maxCaracteres = 300_000, maxMensajes = 80) {
  let inicio = 0;
  const empiezaTurno = (m) => m.role === 'user' && !(Array.isArray(m.content) && m.content.some((b) => b.type === 'tool_result'));
  const tamano = (desde) => JSON.stringify(historial.slice(desde)).length;
  while (inicio < historial.length && (historial.length - inicio > maxMensajes || tamano(inicio) > maxCaracteres)) {
    let siguiente = inicio + 1;
    while (siguiente < historial.length && !empiezaTurno(historial[siguiente])) siguiente++;
    inicio = siguiente;
  }
  return historial.slice(inicio);
}

// Turnos que alternan usuario/asistente y empiezan por el usuario, como exige la API.
export function historialValido(historial) {
  return (
    Array.isArray(historial) &&
    historial.length > 0 &&
    historial.length % 2 === 0 &&
    historial.every((m, i) => m && m.role === (i % 2 ? 'assistant' : 'user') && (typeof m.content === 'string' || Array.isArray(m.content)))
  );
}
