// Markdown mínimo y seguro para las respuestas de Claude: primero se escapa
// todo el HTML y luego se aplican negrita, cursiva, código, enlaces y listas.
const escapar = (texto) =>
  texto.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function enLinea(texto) {
  return escapar(texto)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');
}

export function markdownAHtml(texto = '') {
  const lineas = texto.replace(/\r/g, '').split('\n');
  const html = [];
  let lista = null;
  let parrafo = [];
  let cita = [];

  const cerrarCita = () => {
    if (cita.length) html.push(`<blockquote>${cita.map(enLinea).join('<br>')}</blockquote>`);
    cita = [];
  };
  const cerrarParrafo = () => {
    if (parrafo.length) html.push(`<p>${parrafo.map(enLinea).join('<br>')}</p>`);
    parrafo = [];
    cerrarCita();
  };
  const cerrarLista = () => {
    if (lista) html.push(`<${lista.tipo}>${lista.items.map((i) => `<li>${enLinea(i)}</li>`).join('')}</${lista.tipo}>`);
    lista = null;
  };

  for (const linea of lineas) {
    const vineta = /^\s*[-*•]\s+(.*)$/.exec(linea);
    const numero = /^\s*\d+[.)]\s+(.*)$/.exec(linea);
    const titulo = /^\s*#{1,6}\s+(.*)$/.exec(linea);
    const citada = /^\s*>\s?(.*)$/.exec(linea);
    if (citada) {
      if (parrafo.length) {
        html.push(`<p>${parrafo.map(enLinea).join('<br>')}</p>`);
        parrafo = [];
      }
      cerrarLista();
      cita.push(citada[1]);
    } else if (vineta || numero) {
      cerrarParrafo();
      const tipo = vineta ? 'ul' : 'ol';
      if (lista && lista.tipo !== tipo) cerrarLista();
      lista ??= { tipo, items: [] };
      lista.items.push((vineta || numero)[1]);
    } else if (titulo) {
      cerrarParrafo();
      cerrarLista();
      html.push(`<p><strong>${enLinea(titulo[1])}</strong></p>`);
    } else if (!linea.trim()) {
      cerrarParrafo();
      cerrarLista();
    } else {
      cerrarLista();
      cerrarCita();
      parrafo.push(linea);
    }
  }
  cerrarParrafo();
  cerrarLista();
  return html.join('');
}
