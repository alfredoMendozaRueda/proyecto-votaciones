// Secretos en el navegador (clave de Claude, token de Gmail), cifrados con
// AES-GCM. La llave se crea como "no extraíble" y se guarda en IndexedDB: la
// página puede usarla para descifrar, pero nadie puede leerla ni copiarla a
// otro equipo, y los datos en disco nunca están en claro.
const BASE = 'kitsune';
const ALMACEN = 'secretos';
const ID_LLAVE = '__llave';

function abrir() {
  return new Promise((resolver, rechazar) => {
    const peticion = indexedDB.open(BASE, 1);
    peticion.onupgradeneeded = () => peticion.result.createObjectStore(ALMACEN);
    peticion.onsuccess = () => resolver(peticion.result);
    peticion.onerror = () => rechazar(peticion.error);
  });
}

async function operar(modo, accion) {
  const db = await abrir();
  return new Promise((resolver, rechazar) => {
    const tx = db.transaction(ALMACEN, modo);
    const peticion = accion(tx.objectStore(ALMACEN));
    tx.oncomplete = () => resolver(peticion?.result);
    tx.onerror = () => rechazar(tx.error);
  });
}

let llavePrometida = null;

function llave() {
  llavePrometida ??= (async () => {
    const existente = await operar('readonly', (s) => s.get(ID_LLAVE));
    if (existente) return existente;
    const nueva = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    await operar('readwrite', (s) => s.put(nueva, ID_LLAVE));
    return nueva;
  })();
  return llavePrometida;
}

export async function guardarSecreto(nombre, valor) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await llave(), new TextEncoder().encode(valor));
  await operar('readwrite', (s) => s.put({ iv, cifrado }, nombre));
}

export async function leerSecreto(nombre) {
  try {
    const registro = await operar('readonly', (s) => s.get(nombre));
    if (!registro) return null;
    const plano = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: registro.iv }, await llave(), registro.cifrado);
    return new TextDecoder().decode(plano);
  } catch {
    return null;
  }
}

export async function borrarSecreto(nombre) {
  await operar('readwrite', (s) => s.delete(nombre));
}
