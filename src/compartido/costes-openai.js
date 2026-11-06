// Lo que OpenAI ha cobrado de verdad (Costs API). Necesita una clave de
// administrador de la organización (sk-admin-…), distinta de la normal: con la
// normal OpenAI no enseña los costes. Solo lectura de lo cobrado, en dólares.

const URL_COSTES = 'https://api.openai.com/v1/organization/costs';

export class ErrorCostes extends Error {}

const inicioDeMes = (ahora = new Date()) => Math.floor(new Date(ahora.getFullYear(), ahora.getMonth(), 1).getTime() / 1000);

// Suma lo cobrado desde el día 1 del mes. Devuelve { usd, dias: [{ fecha, usd }] }.
export async function costeRealOpenAI({ claveAdmin, fetch: hacerFetch = fetch, ahora = new Date() }) {
  if (!claveAdmin) throw new ErrorCostes('Falta la clave de administrador de OpenAI.');
  const dias = [];
  let pagina = null;
  for (let vueltas = 0; vueltas < 5; vueltas++) {
    const params = new URLSearchParams({ start_time: String(inicioDeMes(ahora)), bucket_width: '1d', limit: '31' });
    if (pagina) params.set('page', pagina);
    let r;
    try {
      r = await hacerFetch(`${URL_COSTES}?${params}`, { headers: { Authorization: `Bearer ${claveAdmin}`, 'Content-Type': 'application/json' } });
    } catch {
      throw new ErrorCostes('No se pudo hablar con OpenAI para ver lo cobrado.');
    }
    if (r.status === 401) throw new ErrorCostes('OpenAI no acepta esa clave de administrador. Revisa que sea la «sk-admin-…».');
    if (r.status === 403) throw new ErrorCostes('Esa clave no tiene permiso para ver los costes (hace falta una clave de administrador).');
    if (!r.ok) throw new ErrorCostes(`OpenAI no ha dado los costes (error ${r.status}).`);
    const datos = await r.json().catch(() => ({}));
    for (const cubo of datos.data ?? []) {
      const usd = (cubo.results ?? []).reduce((t, x) => t + (Number(x.amount?.value) || 0), 0);
      dias.push({ fecha: new Date(cubo.start_time * 1000).toISOString().slice(0, 10), usd });
    }
    if (!datos.has_more || !datos.next_page) break;
    pagina = datos.next_page;
  }
  return { usd: Math.round(dias.reduce((t, d) => t + d.usd, 0) * 1e6) / 1e6, dias };
}
