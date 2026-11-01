// Vista del registro de la IA: cada llamada con lo que recibió (instrucciones
// y entrada) y lo que devolvió, para entender por qué decide lo que decide.
const escapar = (t = '') => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Si la respuesta es JSON, se enseña ordenado.
function bonito(texto = '') {
  const t = String(texto).trim();
  const crudo = t.replace(/^```(?:json)?\s*|\s*```$/g, '');
  if (/^[[{]/.test(crudo)) {
    try {
      return JSON.stringify(JSON.parse(crudo), null, 2);
    } catch {
      // No era JSON del todo: tal cual.
    }
  }
  return t;
}

const NOMBRE_IA = { groq: 'Groq', openai: 'OpenAI', claude: 'Claude' };

export function htmlRegistroIA(entradas, { vacio = 'Todavía no hay nada en el registro.' } = {}) {
  if (!entradas?.length) return `<p class="ajuste__ayuda">${escapar(vacio)}</p>`;
  return `<div class="registro-ia">${entradas
    .map((e) => {
      const cuando = new Date(e.cuando).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
      const meta = [cuando, e.origen, [NOMBRE_IA[e.proveedor] ?? e.proveedor, e.modelo].filter(Boolean).join(' · '), `${(e.ms / 1000).toLocaleString('es-ES', { maximumFractionDigits: 1 })} s`]
        .filter(Boolean)
        .join(' · ');
      const bloque = (titulo, texto) => (texto ? `<p class="registro-ia__titulo">${titulo}</p><pre class="registro-ia__texto">${escapar(texto)}</pre>` : '');
      return `<details class="registro-ia__fila" data-ok="${e.ok}">
        <summary><span class="registro-ia__que">${escapar(e.etiqueta)}${e.ok ? '' : ' <span class="registro-ia__fallo">· falló</span>'}</span><span class="registro-ia__meta">${escapar(meta)}</span></summary>
        <div class="registro-ia__cuerpo">
          ${e.error ? `<p class="registro-ia__error">${escapar(e.error)}</p>` : ''}
          ${bloque('Instrucciones', e.sistema)}
          ${bloque('Lo que recibió', e.usuario)}
          ${bloque('Lo que devolvió', bonito(e.respuesta))}
        </div>
      </details>`;
    })
    .join('')}</div>`;
}
