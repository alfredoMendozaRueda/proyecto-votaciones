// El tiempo con Open-Meteo: gratis, sin clave y con CORS abierto, así que
// funciona igual en Electron y en el navegador.

const URL_LUGARES = 'https://geocoding-api.open-meteo.com/v1/search';
const URL_PREVISION = 'https://api.open-meteo.com/v1/forecast';

// Códigos meteorológicos de la OMM que usa Open-Meteo.
const ESTADOS = {
  0: 'despejado',
  1: 'casi despejado',
  2: 'parcialmente nuboso',
  3: 'cubierto',
  45: 'niebla',
  48: 'niebla con escarcha',
  51: 'llovizna débil',
  53: 'llovizna',
  55: 'llovizna intensa',
  56: 'llovizna helada',
  57: 'llovizna helada intensa',
  61: 'lluvia débil',
  63: 'lluvia',
  65: 'lluvia fuerte',
  66: 'lluvia helada',
  67: 'lluvia helada fuerte',
  71: 'nieve débil',
  73: 'nieve',
  75: 'nieve fuerte',
  77: 'granos de nieve',
  80: 'chubascos débiles',
  81: 'chubascos',
  82: 'chubascos fuertes',
  85: 'chubascos de nieve',
  86: 'chubascos de nieve fuertes',
  95: 'tormenta',
  96: 'tormenta con granizo',
  99: 'tormenta con granizo fuerte',
};

export class ErrorTiempo extends Error {}

const estado = (codigo) => ESTADOS[codigo] ?? 'sin datos';
const redondo = (n) => Math.round(n);

async function pedirJson(url, hacerFetch) {
  let respuesta;
  try {
    respuesta = await hacerFetch(url);
  } catch {
    throw new ErrorTiempo('No hay conexión con el servicio del tiempo.');
  }
  if (respuesta.status === 429) throw new ErrorTiempo('El servicio del tiempo está saturado. Prueba más tarde.');
  if (!respuesta.ok) throw new ErrorTiempo('El servicio del tiempo no ha respondido bien.');
  return respuesta.json();
}

// "Albacete" o "Albacete, España": el buscador solo entiende el nombre, el
// resto sirve para elegir entre lugares que se llaman igual.
async function buscarLugar(lugar, hacerFetch) {
  const [nombre, ...pistas] = lugar.split(',').map((p) => p.trim());
  const url = `${URL_LUGARES}?${new URLSearchParams({ name: nombre, count: '5', language: 'es', format: 'json' })}`;
  const { results = [] } = await pedirJson(url, hacerFetch);
  if (!results.length) throw new ErrorTiempo(`No encuentro el lugar «${lugar}». Prueba con el nombre de la ciudad.`);
  const pista = pistas.join(' ').toLowerCase();
  const encaja = (r) => [r.country, r.admin1, r.admin2, r.country_code].some((v) => v && pista.includes(v.toLowerCase()));
  return (pista && results.find(encaja)) || results[0];
}

export async function verTiempo({ lugar, dias = 3 }, hacerFetch = fetch) {
  const sitio = await buscarLugar(lugar, hacerFetch);
  const parametros = new URLSearchParams({
    latitude: String(sitio.latitude),
    longitude: String(sitio.longitude),
    current: 'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    timezone: 'auto',
    forecast_days: String(dias),
  });
  const datos = await pedirJson(`${URL_PREVISION}?${parametros}`, hacerFetch);
  const ahora = datos.current;
  const diario = datos.daily;
  return {
    lugar: [sitio.name, sitio.admin1, sitio.country].filter(Boolean).join(', '),
    ahora: ahora && {
      temperatura: `${redondo(ahora.temperature_2m)} °C`,
      sensacion: `${redondo(ahora.apparent_temperature)} °C`,
      estado: estado(ahora.weather_code),
      humedad: `${ahora.relative_humidity_2m} %`,
      viento: `${redondo(ahora.wind_speed_10m)} km/h`,
    },
    dias: (diario?.time ?? []).map((fecha, i) => ({
      fecha: new Date(`${fecha}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'short' }),
      estado: estado(diario.weather_code[i]),
      minima: `${redondo(diario.temperature_2m_min[i])} °C`,
      maxima: `${redondo(diario.temperature_2m_max[i])} °C`,
      probabilidadLluvia: diario.precipitation_probability_max?.[i] == null ? undefined : `${diario.precipitation_probability_max[i]} %`,
    })),
    fuente: 'Open-Meteo',
  };
}
