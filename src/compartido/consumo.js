// Lo que gasta Kitsune en OpenAI, calculado con los tokens que devuelve cada
// respuesta y los precios oficiales (developers.openai.com/api/docs/pricing).
// Cada dispositivo apunta lo suyo por meses; con la sincronización se ven
// también los demás, y el servidor apunta lo de las alertas y automatizaciones.

// Dólares por millón de tokens. El razonamiento se cobra como salida.
export const PRECIOS_OPENAI = {
  'gpt-6-luna': { entrada: 0.1, cache: 0.01, salida: 0.5 },
  'gpt-6.1-terra': { entrada: 1, cache: 0.05, salida: 5 },
  'gpt-6.1-sol': { entrada: 2, cache: 0.1, salida: 10 },
};
// Cada búsqueda web: 10 $ por cada 1.000 (lo que lee se cobra aparte como entrada).
export const PRECIO_BUSQUEDA = 0.01;
const MESES_GUARDADOS = 12;

const entero = (n) => (Number.isFinite(Number(n)) ? Math.max(0, Math.round(Number(n))) : 0);

// Uso de Chat Completions → { entrada, cache, salida }.
export const usoDeChat = (u) => (u ? { entrada: entero(u.prompt_tokens), cache: entero(u.prompt_tokens_details?.cached_tokens), salida: entero(u.completion_tokens), busquedas: 0 } : null);

// Uso de la API Responses → { entrada, cache, salida, busquedas }.
export function usoDeRespuesta(datos) {
  const u = datos?.usage;
  const busquedas = (datos?.output ?? []).filter((i) => i.type === 'web_search_call').length;
  if (!u && !busquedas) return null;
  return { entrada: entero(u?.input_tokens), cache: entero(u?.input_tokens_details?.cached_tokens), salida: entero(u?.output_tokens), busquedas };
}

export function coste(modelo, uso) {
  const p = PRECIOS_OPENAI[modelo] ?? PRECIOS_OPENAI['gpt-6-luna'];
  const cache = Math.min(uso.cache ?? 0, uso.entrada ?? 0);
  const normal = (uso.entrada ?? 0) - cache;
  return (normal * p.entrada + cache * p.cache + (uso.salida ?? 0) * p.salida) / 1e6 + (uso.busquedas ?? 0) * PRECIO_BUSQUEDA;
}

export const mesDe = (ms = Date.now()) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const vacio = () => ({ usd: 0, entrada: 0, cache: 0, salida: 0, busquedas: 0, peticiones: 0 });

// Suma un uso al mes que toque y deja solo los últimos meses.
export function sumarUso(meses = {}, modelo, uso, ahora = Date.now()) {
  const mes = mesDe(ahora);
  const actual = { ...vacio(), ...(meses[mes] ?? {}) };
  actual.usd = Math.round((actual.usd + coste(modelo, uso)) * 1e6) / 1e6;
  for (const k of ['entrada', 'cache', 'salida', 'busquedas']) actual[k] += entero(uso[k]);
  actual.peticiones += 1;
  const todos = { ...meses, [mes]: actual };
  return Object.fromEntries(Object.entries(todos).sort(([a], [b]) => b.localeCompare(a)).slice(0, MESES_GUARDADOS));
}

export function normalizarMeses(meses) {
  if (!meses || typeof meses !== 'object') return {};
  return Object.fromEntries(
    Object.entries(meses)
      .filter(([mes]) => /^\d{4}-\d{2}$/.test(mes))
      .map(([mes, v]) => [mes, Object.fromEntries(Object.entries({ ...vacio(), ...v }).map(([k, n]) => [k, k === 'usd' ? Math.max(0, Number(n) || 0) : entero(n)]))])
      .slice(0, MESES_GUARDADOS),
  );
}

const nuevoId = () => `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

// El gasto de este dispositivo y el que llega de los demás.
// almacén: { leer() → datos | null, guardar(datos) }.
export class Consumo {
  constructor({ leer, guardar, nombre, alCambiar = () => {} }) {
    Object.assign(this, { leerDatos: leer, guardarDatos: guardar, nombre, alCambiar });
    this.cola = Promise.resolve();
  }

  async datos() {
    const d = (await this.leerDatos()) ?? {};
    return {
      id: typeof d.id === 'string' && d.id ? d.id : nuevoId(),
      nombre: this.nombre,
      meses: normalizarMeses(d.meses),
      otros: d.otros && typeof d.otros === 'object' ? d.otros : {},
    };
  }

  // Se apuntan en fila: varias respuestas a la vez no se pisan.
  anotar(modelo, uso) {
    if (!uso) return this.cola;
    this.cola = this.cola
      .then(async () => {
        const d = await this.datos();
        d.meses = sumarUso(d.meses, modelo, uso);
        await this.guardarDatos(d);
        this.alCambiar();
      })
      .catch(() => {});
    return this.cola;
  }

  // Para Ajustes: este mes por dispositivo y los meses anteriores sumados.
  async resumen({ servidor = null } = {}) {
    const d = await this.datos();
    const mes = mesDe();
    const fuentes = [
      { nombre: d.nombre, yo: true, meses: d.meses },
      ...Object.values(d.otros)
        .filter((o) => o && typeof o === 'object')
        .map((o) => ({ nombre: String(o.nombre ?? 'Otro dispositivo').slice(0, 60), yo: false, meses: normalizarMeses(o.meses) })),
      ...(servidor ? [{ nombre: 'Servidor (alertas y automatizaciones)', yo: false, servidor: true, meses: normalizarMeses(servidor) }] : []),
    ];
    const sumar = (lista) => lista.reduce((t, m) => Object.fromEntries(Object.keys(t).map((k) => [k, t[k] + (m?.[k] ?? 0)])), vacio());
    const meses = [...new Set(fuentes.flatMap((f) => Object.keys(f.meses)))].sort((a, b) => b.localeCompare(a));
    return {
      mes,
      total: sumar(fuentes.map((f) => f.meses[mes])),
      dispositivos: fuentes.map((f) => ({ nombre: f.nombre, yo: f.yo, servidor: Boolean(f.servidor), ...vacio(), ...(f.meses[mes] ?? {}) })),
      historial: meses.filter((m) => m !== mes).slice(0, 5).map((m) => ({ mes: m, ...sumar(fuentes.map((f) => f.meses[m])) })),
    };
  }
}
