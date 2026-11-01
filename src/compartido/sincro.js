// Sincronización entre dispositivos (iPhone y Windows), igual en la web y en
// Electron. Cada dato (un recuerdo, una conversación, una candidatura, un
// ajuste, una clave de IA…) viaja cifrado con AES-GCM y una llave que solo
// tienen tus dispositivos: el servidor guarda y reparte, pero no puede leer.
//
// Un dispositivo nuevo recibe la llave de otro ya unido: crea un par ECDH,
// el otro le manda la llave en un sobre cifrado para él, y antes de aprobarlo
// compruebas que las dos pantallas enseñan el mismo código.
//
// Cada ronda: se miran los cambios locales (huella de cada dato frente a la
// última vez), se bajan los del servidor, se aplican los que no chocan (si
// chocan, gana el más reciente) y se suben los propios.
import { AJUSTES_POR_DEFECTO, valorValido } from './ajustes.js';

export const COLECCIONES_SINCRO = [
  ['memoria', 'Memoria'],
  ['conversaciones', 'Conversaciones'],
  ['recordatorios', 'Recordatorios'],
  ['empleo', 'Empleo (CV y candidaturas)'],
  ['ajustes', 'Ajustes'],
  ['claves', 'Claves de la IA'],
  ['consumo', 'Gasto de la IA'],
  ['gastos', 'Gastos'],
];
// Colecciones que llegaron después: en los dispositivos que ya sincronizaban se
// activan solas una vez (y se baja todo, por si otro dispositivo ya las subió).
const COLECCIONES_NUEVAS = ['gastos'];
// Ajustes que son de cada dispositivo (pantalla, atajos, motor de voz…).
export const AJUSTES_LOCALES = new Set([
  'atajo',
  'tamano',
  'posicion',
  'calidadPelo',
  'seguirCursor',
  'iniciarConWindows',
  'dormirTrasMin',
  'ofrecerPortapapeles',
  'vozTipo',
  'voicestudioUrl',
  'voicestudioVoz',
  'googleClientId',
  'servidorUrl',
  'revision',
]);

const COMPROBANTE = 'kitsune-sincro-1';
const MAX_DOC = 1_000_000;
const MAX_LOTE_BYTES = 450_000;
const MAX_LOTE = 60;
const ESPERA_SOLICITUD = 15 * 60_000;
const utf8 = (t) => new TextEncoder().encode(t);
const texto = (b) => new TextDecoder().decode(b);

export function aB64(bytes) {
  const b = new Uint8Array(bytes);
  let s = '';
  for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode(...b.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function deB64(t) {
  const normal = String(t).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normal + '='.repeat((4 - (normal.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

export async function huella(t) {
  return aB64(await crypto.subtle.digest('SHA-256', utf8(t))).slice(0, 32);
}

// ---------- Cifrado ----------

export const nuevaLlave = () => aB64(crypto.getRandomValues(new Uint8Array(32)));
const importar = (llave) => crypto.subtle.importKey('raw', deB64(llave), 'AES-GCM', false, ['encrypt', 'decrypt']);

// El identificador va como dato asociado: un dato no se puede hacer pasar por otro.
async function cifrar(clave, id, plano) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cifrado = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv, additionalData: utf8(id) }, clave, utf8(plano)));
  const todo = new Uint8Array(12 + cifrado.length);
  todo.set(iv);
  todo.set(cifrado, 12);
  return aB64(todo);
}

async function descifrar(clave, id, datos) {
  const b = deB64(datos);
  return texto(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b.subarray(0, 12), additionalData: utf8(id) }, clave, b.subarray(12)));
}

export async function crearComprobante(llave) {
  return cifrar(await importar(llave), '__comprobante', COMPROBANTE);
}

export async function llaveValida(llave, comprobante) {
  try {
    return (await descifrar(await importar(llave), '__comprobante', comprobante)) === COMPROBANTE;
  } catch {
    return false;
  }
}

// ---------- Emparejar (ECDH P-256) ----------

const ECDH = { name: 'ECDH', namedCurve: 'P-256' };

export async function crearPeticion() {
  const par = await crypto.subtle.generateKey(ECDH, false, ['deriveBits']);
  return { privada: par.privateKey, publica: aB64(await crypto.subtle.exportKey('raw', par.publicKey)) };
}

// Seis cifras a partir de la llave pública: las dos pantallas tienen que coincidir.
export async function codigoDe(publica) {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-256', deB64(publica)));
  const n = ((h[0] << 24) | (h[1] << 16) | (h[2] << 8) | h[3]) >>> 0;
  const c = String(n % 1_000_000).padStart(6, '0');
  return `${c.slice(0, 3)} ${c.slice(3)}`;
}

async function llaveSobre(privada, publica) {
  const otra = await crypto.subtle.importKey('raw', deB64(publica), ECDH, false, []);
  const compartido = await crypto.subtle.deriveBits({ name: 'ECDH', public: otra }, privada, 256);
  const base = await crypto.subtle.importKey('raw', compartido, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(32), info: utf8('kitsune-sincro-sobre') }, base, { name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ]);
}

// Quien aprueba mete la llave en un sobre que solo puede abrir el dispositivo nuevo.
export async function sellarSobre(llave, publicaDestino) {
  const mia = await crypto.subtle.generateKey(ECDH, true, ['deriveBits']);
  const clave = await llaveSobre(mia.privateKey, publicaDestino);
  return { publica: aB64(await crypto.subtle.exportKey('raw', mia.publicKey)), datos: await cifrar(clave, 'sobre', llave) };
}

export async function abrirSobre(privada, sobre) {
  return descifrar(await llaveSobre(privada, sobre.publica), 'sobre', sobre.datos);
}

// ---------- Colecciones ----------
// Cada colección sabe leer sus datos como { id → { firma, valor } } (valor:
// texto JSON, o función que lo da si es caro de leer), calcular la firma de un
// valor que llega y aplicar cambios [{ id, valor | null }].

const comoTexto = (x) => JSON.stringify(x);

// Listas de objetos con id: memoria y recordatorios.
export function coleccionLista({ leer, guardar, despues }) {
  return {
    async leer() {
      const lista = (await leer()) ?? [];
      return new Map(
        (Array.isArray(lista) ? lista : [])
          .filter((x) => x && typeof x.id === 'string')
          .map((x) => {
            const v = comoTexto(x);
            return [x.id, { firma: v, valor: v }];
          }),
      );
    },
    firma: (v) => v,
    async aplicar(cambios) {
      const lista = (await leer()) ?? [];
      const porId = new Map((Array.isArray(lista) ? lista : []).filter((x) => x?.id).map((x) => [x.id, x]));
      for (const { id, valor } of cambios) {
        if (valor === null) porId.delete(id);
        else porId.set(id, JSON.parse(valor));
      }
      await guardar([...porId.values()]);
      await despues?.();
    },
  };
}

// Conversaciones: la firma es la entrada del índice (cambia con cada mensaje)
// y el contenido solo se lee si hay que subirlo.
export function coleccionConversaciones({ leerIndice, guardarIndice, leer, guardar, borrar, maximo = 50, despues }) {
  const indice = async () => {
    const lista = await leerIndice();
    return Array.isArray(lista) ? lista.filter((c) => c && typeof c.id === 'string') : [];
  };
  return {
    async leer() {
      return new Map(
        (await indice()).map((c) => [c.id, { firma: comoTexto(c), valor: async () => comoTexto({ entrada: c, datos: await leer(c.id) }) }]),
      );
    },
    firma: (v) => comoTexto(JSON.parse(v).entrada),
    async aplicar(cambios) {
      const porId = new Map((await indice()).map((c) => [c.id, c]));
      for (const { id, valor } of cambios) {
        if (valor === null) {
          await borrar(id);
          porId.delete(id);
          continue;
        }
        const { entrada, datos } = JSON.parse(valor);
        if (!datos) continue;
        await guardar(id, datos);
        porId.set(id, entrada);
      }
      const ordenadas = [...porId.values()].sort((a, b) => (b.actualizada ?? 0) - (a.actualizada ?? 0));
      for (const sobrante of ordenadas.splice(maximo)) await borrar(sobrante.id);
      await guardarIndice(ordenadas);
      await despues?.();
    },
  };
}

// Empleo: lo general (CV, búsqueda, ofertas) y cada candidatura por separado.
export function coleccionEmpleo({ leer, guardar, normalizar = (d) => d, despues }) {
  return {
    async leer() {
      const d = await leer();
      if (!d || typeof d !== 'object') return new Map();
      const { postulaciones = [], ...base } = d;
      const mapa = new Map([['base', { firma: comoTexto(base), valor: comoTexto(base) }]]);
      for (const p of postulaciones) if (p?.id) mapa.set(`p:${p.id}`, { firma: comoTexto(p), valor: comoTexto(p) });
      return mapa;
    },
    firma: (v) => v,
    async aplicar(cambios) {
      const d = (await leer()) ?? {};
      let { postulaciones = [], ...base } = d;
      const porId = new Map(postulaciones.filter((p) => p?.id).map((p) => [p.id, p]));
      for (const { id, valor } of cambios) {
        if (id === 'base') base = valor === null ? {} : JSON.parse(valor);
        else if (id.startsWith('p:')) {
          if (valor === null) porId.delete(id.slice(2));
          else porId.set(id.slice(2), JSON.parse(valor));
        }
      }
      postulaciones = [...porId.values()].sort((a, b) => (b.fecha ?? 0) - (a.fecha ?? 0));
      await guardar(normalizar({ ...base, postulaciones }));
      await despues?.();
    },
  };
}

// Ajustes: uno por uno, salvo los de cada dispositivo.
export function coleccionAjustes({ leer, guardar }) {
  const claves = Object.keys(AJUSTES_POR_DEFECTO).filter((k) => !AJUSTES_LOCALES.has(k));
  return {
    async leer() {
      const a = await leer();
      return new Map(claves.filter((k) => k in a).map((k) => [k, { firma: comoTexto(a[k]), valor: comoTexto(a[k]) }]));
    },
    firma: (v) => v,
    async aplicar(cambios) {
      const nuevos = {};
      for (const { id, valor } of cambios) {
        if (valor === null || !claves.includes(id)) continue;
        const v = JSON.parse(valor);
        if (valorValido(id, v)) nuevos[id] = v;
      }
      if (Object.keys(nuevos).length) await guardar(nuevos);
    },
  };
}

// Claves de la IA (Claude, Groq y OpenAI).
export const SECRETOS_CLAVES = { claude: 'claveClaude', groq: 'claveGroq', openai: 'claveOpenAI' };
export function coleccionClaves({ leer, guardar, borrar, despues }) {
  return {
    async leer() {
      const mapa = new Map();
      for (const [id, nombre] of Object.entries(SECRETOS_CLAVES)) {
        const valor = await leer(nombre);
        if (valor) mapa.set(id, { firma: valor, valor });
      }
      return mapa;
    },
    firma: (v) => v,
    async aplicar(cambios) {
      for (const { id, valor } of cambios) {
        const nombre = SECRETOS_CLAVES[id];
        if (!nombre) continue;
        if (valor === null) await borrar(nombre);
        else await guardar(nombre, valor.slice(0, 300));
      }
      await despues?.();
    },
  };
}

// Gastos: cada gasto (m:) y cada fijo (f:) por separado, y el presupuesto aparte;
// así dos dispositivos pueden apuntar a la vez sin pisarse.
export function coleccionGastos({ leer, guardar, normalizar = (d) => d, despues }) {
  return {
    async leer() {
      const d = await leer();
      const mapa = new Map();
      if (!d || typeof d !== 'object') return mapa;
      const base = { presupuesto: d.presupuesto ?? 0 };
      mapa.set('base', { firma: comoTexto(base), valor: comoTexto(base) });
      for (const m of d.movimientos ?? []) if (m?.id) mapa.set(`m:${m.id}`, { firma: comoTexto(m), valor: comoTexto(m) });
      for (const f of d.fijos ?? []) if (f?.id) mapa.set(`f:${f.id}`, { firma: comoTexto(f), valor: comoTexto(f) });
      return mapa;
    },
    firma: (v) => v,
    async aplicar(cambios) {
      const d = (await leer()) ?? {};
      let base = { presupuesto: d.presupuesto ?? 0 };
      const movimientos = new Map((d.movimientos ?? []).filter((m) => m?.id).map((m) => [m.id, m]));
      const fijos = new Map((d.fijos ?? []).filter((f) => f?.id).map((f) => [f.id, f]));
      for (const { id, valor } of cambios) {
        if (id === 'base') base = valor === null ? { presupuesto: 0 } : JSON.parse(valor);
        else if (id.startsWith('m:')) valor === null ? movimientos.delete(id.slice(2)) : movimientos.set(id.slice(2), JSON.parse(valor));
        else if (id.startsWith('f:')) valor === null ? fijos.delete(id.slice(2)) : fijos.set(id.slice(2), JSON.parse(valor));
      }
      await guardar(normalizar({ ...base, movimientos: [...movimientos.values()], fijos: [...fijos.values()] }));
      await despues?.();
    },
  };
}

// Gasto de la IA: cada dispositivo escribe solo el suyo y recibe el de los demás.
export function coleccionConsumo({ leer, guardar, despues }) {
  return {
    // Lo de otro dispositivo solo lo borra él: aquí nunca se da por borrado.
    sinBorrados: true,
    async leer() {
      const d = await leer();
      if (!d) return new Map();
      const mapa = new Map();
      if (d.id) {
        const propio = comoTexto({ nombre: d.nombre, meses: d.meses ?? {} });
        mapa.set(d.id, { firma: propio, valor: propio });
      }
      for (const [id, o] of Object.entries(d.otros ?? {})) {
        const v = comoTexto(o);
        mapa.set(id, { firma: v, valor: v });
      }
      return mapa;
    },
    firma: (v) => v,
    async aplicar(cambios) {
      const d = (await leer()) ?? {};
      d.otros = { ...(d.otros ?? {}) };
      for (const { id, valor } of cambios) {
        if (id === d.id) continue;
        if (valor === null) delete d.otros[id];
        else d.otros[id] = JSON.parse(valor);
      }
      await guardar(d);
      await despues?.();
    },
  };
}

// ---------- Motor ----------

const estadoNuevo = () => ({ cursor: 0, base: {}, pendientes: {}, ultima: 0, error: '', primera: true, colecciones: COLECCIONES_SINCRO.map(([c]) => c), ofrecidas: COLECCIONES_SINCRO.map(([c]) => c) });
const espera = (ms, signal) =>
  new Promise((ok, mal) => {
    const t = setTimeout(ok, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      mal(new Error('Cancelado.'));
    });
  });

export class Sincronizador {
  // cliente: () => Promise<ClienteServidor>; colecciones: { nombre: colección };
  // estado y llave: dónde se guardan en este dispositivo.
  constructor({ cliente, colecciones, leerEstado, guardarEstado, leerLlave, guardarLlave, borrarLlave, alCambiar = () => {}, alEstado = () => {} }) {
    Object.assign(this, { cliente, colecciones, leerEstado, guardarEstado, leerLlave, guardarLlave, borrarLlave, alCambiar, alEstado });
    this.enCurso = null;
    this.otraVez = false;
    this.temporizador = null;
    this.peticion = null;
  }

  async #estado() {
    const e = await this.leerEstado();
    if (!e || typeof e !== 'object') return estadoNuevo();
    const estado = { ...estadoNuevo(), ...e };
    const ofrecidas = Array.isArray(e.ofrecidas) ? e.ofrecidas : COLECCIONES_SINCRO.map(([c]) => c).filter((c) => !COLECCIONES_NUEVAS.includes(c));
    const nuevas = COLECCIONES_NUEVAS.filter((c) => !ofrecidas.includes(c));
    if (nuevas.length || !Array.isArray(e.ofrecidas)) {
      estado.ofrecidas = COLECCIONES_SINCRO.map(([c]) => c);
      if (nuevas.length) {
        estado.colecciones = [...new Set([...estado.colecciones, ...nuevas])];
        estado.cursor = 0;
      }
      await this.guardarEstado(estado);
    }
    return estado;
  }

  async activaAqui() {
    return Boolean(await this.leerLlave());
  }

  // Lo que enseña Ajustes: si este dispositivo sincroniza, y el servidor.
  async resumen() {
    const aqui = await this.activaAqui();
    const e = await this.#estado();
    const s = await (await this.cliente()).sincroEstado();
    return {
      aqui,
      servidor: s.activa,
      solicitudes: aqui ? s.solicitudes : [],
      ultima: e.ultima,
      error: aqui ? e.error : '',
      pendientes: Object.keys(e.pendientes).length,
      colecciones: e.colecciones,
      esperando: this.peticion ? { id: this.peticion.id, codigo: this.peticion.codigo } : null,
    };
  }

  // Primer dispositivo: crea la llave y sube todo.
  async activar() {
    const c = await this.cliente();
    const s = await c.sincroEstado();
    if (s.activa) throw new Error('La sincronización ya está activada en otro dispositivo: únete a ella.');
    const llave = nuevaLlave();
    await c.sincroActivar(await crearComprobante(llave));
    await this.guardarLlave(llave);
    await this.guardarEstado({ ...estadoNuevo(), primera: false });
    await this.sincronizar();
  }

  // Dispositivo nuevo: pide la llave y espera a que otro lo apruebe.
  async solicitar() {
    const { privada, publica } = await crearPeticion();
    const { id } = await (await this.cliente()).sincroSolicitar(publica);
    this.peticion = { id, privada, codigo: await codigoDe(publica) };
    return { id, codigo: this.peticion.codigo };
  }

  cancelarEspera() {
    this.esperaAbortada?.abort();
    const p = this.peticion;
    this.peticion = null;
    if (p) this.cliente().then((c) => c.sincroRechazar(p.id)).catch(() => {});
  }

  async esperar() {
    const p = this.peticion;
    if (!p) throw new Error('No hay ninguna petición pendiente.');
    this.esperaAbortada = new AbortController();
    const { signal } = this.esperaAbortada;
    const limite = Date.now() + ESPERA_SOLICITUD;
    try {
      while (Date.now() < limite) {
        const c = await this.cliente();
        const r = await c.sincroSolicitud(p.id);
        if (r.rechazada) throw new Error('El otro dispositivo no lo ha aprobado.');
        if (r.caducada) break;
        if (r.sobre) {
          const llave = await abrirSobre(p.privada, r.sobre);
          const { comprobante } = await c.sincroEstado();
          if (!(await llaveValida(llave, comprobante))) throw new Error('La llave recibida no es válida. Vuelve a intentarlo.');
          await this.guardarLlave(llave);
          await this.guardarEstado(estadoNuevo());
          await c.sincroRechazar(p.id).catch(() => {});
          this.peticion = null;
          await this.sincronizar();
          return true;
        }
        await espera(2500, signal);
      }
      throw new Error('Se ha acabado el tiempo. Vuelve a pedirlo.');
    } finally {
      if (this.peticion === p && !signal.aborted) {
        this.peticion = null;
      }
    }
  }

  // Desde un dispositivo ya unido: da la llave al que la pide.
  async aprobar(id, publica) {
    const llave = await this.leerLlave();
    if (!llave) throw new Error('Este dispositivo no está sincronizando.');
    await (await this.cliente()).sincroAprobar(id, await sellarSobre(llave, publica));
  }

  async rechazar(id) {
    await (await this.cliente()).sincroRechazar(id);
  }

  async elegirColecciones(lista) {
    const e = await this.#estado();
    const validas = COLECCIONES_SINCRO.map(([c]) => c).filter((c) => lista.includes(c));
    const nuevas = validas.filter((c) => !e.colecciones.includes(c));
    e.colecciones = validas;
    // Lo que se activa de nuevo se baja entero.
    if (nuevas.length) e.cursor = 0;
    await this.guardarEstado(e);
    if (nuevas.length) this.marcar(0);
  }

  // Deja de sincronizar en este dispositivo (los datos se quedan aquí).
  async desactivar() {
    clearTimeout(this.temporizador);
    await this.borrarLlave();
    await this.guardarEstado(null);
  }

  // Empezar de cero: borra la copia del servidor; cada dispositivo conserva lo suyo.
  async borrarServidor() {
    await (await this.cliente()).sincroBorrar();
    await this.desactivar();
  }

  // Tras un cambio local: sincroniza en un momento (agrupando cambios seguidos).
  marcar(ms = 2500) {
    clearTimeout(this.temporizador);
    this.temporizador = setTimeout(() => this.sincronizar().catch(() => {}), ms);
  }

  sincronizar() {
    if (this.enCurso) {
      this.otraVez = true;
      return this.enCurso;
    }
    this.enCurso = (async () => {
      try {
        do {
          this.otraVez = false;
          await this.#ronda();
        } while (this.otraVez);
      } finally {
        this.enCurso = null;
      }
    })();
    return this.enCurso;
  }

  async #ronda() {
    const llave = await this.leerLlave();
    if (!llave) return;
    const e = await this.#estado();
    try {
      await this.#rondaCon(await importar(llave), e);
      e.error = '';
      e.ultima = Date.now();
    } catch (error) {
      e.error = error.message || 'No se ha podido sincronizar.';
      // Si el servidor ya no tiene la sincronización, este dispositivo la deja.
      if (/no está activada/.test(e.error)) {
        await this.desactivar();
        this.alEstado();
        return;
      }
      throw error;
    } finally {
      if (await this.leerLlave()) await this.guardarEstado(e);
      this.alEstado();
    }
  }

  async #rondaCon(clave, e) {
    const c = await this.cliente();
    const activas = new Set(e.colecciones.filter((n) => this.colecciones[n]));
    const coleccionDe = (id) => id.slice(0, id.indexOf('/'));
    const ahora = Date.now();

    // 1. Lo que hay aquí y lo que ha cambiado desde la última vez.
    const locales = new Map();
    const hashes = new Map();
    for (const nombre of activas) {
      for (const [id, d] of await this.colecciones[nombre].leer()) {
        const total = `${nombre}/${id}`;
        locales.set(total, d);
        hashes.set(total, await huella(d.firma));
      }
    }
    for (const [id, h] of hashes) {
      if (e.base[id] !== h) e.pendientes[id] ??= ahora;
      else delete e.pendientes[id];
    }
    for (const id of Object.keys(e.base)) {
      if (!activas.has(coleccionDe(id)) || this.colecciones[coleccionDe(id)].sinBorrados) continue;
      if (!locales.has(id)) e.pendientes[id] ??= ahora;
    }
    for (const id of Object.keys(e.pendientes)) if (!locales.has(id) && !(id in e.base)) delete e.pendientes[id];

    // 2. Lo que llega del servidor.
    const aplicar = {};
    let hayMas = true;
    while (hayMas) {
      const r = await c.sincroCambios(e.cursor);
      for (const x of r.cambios) {
        e.cursor = Math.max(e.cursor, x.version);
        const nombre = coleccionDe(x.id);
        if (!activas.has(nombre)) continue;
        let valor = null;
        if (x.datos) {
          try {
            valor = await descifrar(clave, x.id, x.datos);
          } catch {
            continue;
          }
        }
        const hRemoto = valor === null ? null : await huella(this.colecciones[nombre].firma(valor));
        const hLocal = hashes.get(x.id) ?? null;
        if (hRemoto === hLocal) {
          if (hRemoto === null) delete e.base[x.id];
          else e.base[x.id] = hRemoto;
          delete e.pendientes[x.id];
          continue;
        }
        // Choque: si lo de aquí es más reciente, se queda y se sube después.
        const pendiente = e.pendientes[x.id];
        if (pendiente && !e.primera && pendiente > x.cambiado) continue;
        (aplicar[nombre] ??= new Map()).set(x.id.slice(nombre.length + 1), valor);
        if (hRemoto === null) {
          delete e.base[x.id];
          locales.delete(x.id);
          hashes.delete(x.id);
        } else {
          e.base[x.id] = hRemoto;
          locales.set(x.id, { firma: '', valor });
          hashes.set(x.id, hRemoto);
        }
        delete e.pendientes[x.id];
      }
      hayMas = r.hayMas && r.cambios.length > 0;
    }
    const cambiadas = Object.keys(aplicar);
    for (const nombre of cambiadas) {
      await this.colecciones[nombre].aplicar([...aplicar[nombre]].map(([id, valor]) => ({ id, valor })));
    }
    e.primera = false;
    if (cambiadas.length) this.alCambiar(cambiadas);

    // 3. Lo de aquí que falta en el servidor.
    const subir = Object.entries(e.pendientes).filter(([id]) => activas.has(coleccionDe(id)));
    let lote = [];
    let bytes = 0;
    const enviar = async () => {
      if (!lote.length) return;
      const r = await c.sincroSubir(lote.map(({ id, cambiado, datos }) => ({ id, cambiado, datos })));
      for (const res of r.resultados) {
        if (res.ok) {
          const enviado = lote.find((x) => x.id === res.id);
          if (enviado.datos === null) delete e.base[res.id];
          else e.base[res.id] = enviado.hash;
          if (e.pendientes[res.id] === enviado.cambiado) delete e.pendientes[res.id];
        } else if (res.rechazado) {
          // El servidor tiene algo más nuevo: se baja en la próxima ronda.
          delete e.pendientes[res.id];
          e.cursor = Math.min(e.cursor, (res.version ?? 1) - 1);
          this.otraVez = true;
        }
      }
      lote = [];
      bytes = 0;
    };
    for (const [id, cambiado] of subir) {
      const d = locales.get(id);
      let datos = null;
      if (d) {
        const valor = typeof d.valor === 'function' ? await d.valor() : d.valor;
        if (valor.length > MAX_DOC) continue;
        datos = await cifrar(clave, id, valor);
      }
      if (lote.length && (bytes + (datos?.length ?? 0) > MAX_LOTE_BYTES || lote.length >= MAX_LOTE)) await enviar();
      lote.push({ id, cambiado, datos, hash: hashes.get(id) });
      bytes += datos?.length ?? 0;
    }
    await enviar();
  }
}
