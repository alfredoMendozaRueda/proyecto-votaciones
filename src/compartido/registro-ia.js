// Registro de la IA desde los dispositivos: cada tarea (puntuar ofertas,
// redactar el CV, revisarlo…) se apunta con lo que recibió y lo que devolvió,
// y se manda al servidor en pequeños lotes. Si no hay servidor, no se guarda.
export function crearEnvioRegistroIA(obtenerCliente, { lote = 5, espera = 1500 } = {}) {
  let cola = [];
  let reloj = null;
  const enviar = async () => {
    reloj = null;
    const parte = cola.splice(0, lote);
    if (!parte.length) return;
    try {
      await (await obtenerCliente()).registrarIA(parte);
    } catch {
      // Sin servidor o sin conexión: se pierde, no es imprescindible.
    }
    if (cola.length && !reloj) reloj = setTimeout(enviar, 500);
  };
  return (entrada) => {
    cola.push(entrada);
    if (cola.length > 40) cola = cola.slice(-40);
    if (!reloj) reloj = setTimeout(enviar, espera);
  };
}
