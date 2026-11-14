// Fotos de progreso: solo en este dispositivo (IndexedDB), nunca salen de él
// ni se sincronizan. Se guardan reducidas (lado mayor 1280 px).
const BD = 'forma-fotos';
const ALMACEN = 'fotos';

function abrir() {
  return new Promise((ok, mal) => {
    const p = indexedDB.open(BD, 1);
    p.onupgradeneeded = () => p.result.createObjectStore(ALMACEN, { keyPath: 'id' });
    p.onsuccess = () => ok(p.result);
    p.onerror = () => mal(p.error ?? new Error('No se pueden guardar fotos en este navegador.'));
  });
}

async function operar(modo, hacer) {
  const bd = await abrir();
  try {
    return await new Promise((ok, mal) => {
      const t = bd.transaction(ALMACEN, modo);
      const r = hacer(t.objectStore(ALMACEN));
      t.oncomplete = () => ok(r?.result);
      t.onerror = () => mal(t.error);
    });
  } finally {
    bd.close();
  }
}

export const guardarFoto = (foto) => operar('readwrite', (a) => a.put(foto));
export const borrarFoto = (id) => operar('readwrite', (a) => a.delete(id));
export async function listarFotos() {
  try {
    const todas = (await operar('readonly', (a) => a.getAll())) ?? [];
    return todas.sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : b.creada - a.creada));
  } catch {
    return [];
  }
}
