// Formato común de las notificaciones (servidor, web y Windows):
// título «Kitsune: <asunto>» y, debajo, el detalle.
const LARGO_TITULO = 70;

export function aviso(asunto, detalle = '') {
  const limpio = String(asunto ?? '').replace(/\s+/g, ' ').trim() || 'aviso';
  const corto = limpio.length > LARGO_TITULO ? `${limpio.slice(0, LARGO_TITULO - 1).trimEnd()}…` : limpio;
  // Si el asunto no cabe en el título, va entero en el cuerpo.
  const cuerpo = String(detalle ?? '').trim() || (corto === limpio ? '' : limpio);
  return { titulo: `Kitsune: ${corto}`, cuerpo };
}
