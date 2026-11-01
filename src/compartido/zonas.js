// Zonas para buscar empleo: provincias, ciudades y comunidades de España,
// países y ciudades de fuera, y trabajo en remoto. Cada una sabe cómo se la
// llama en LinkedIn (que entiende mejor los nombres en inglés) y de ahí sale
// también el país para freehire.

const sinTildes = (t) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim();

// Comunidades autónomas: nombre, nombre en LinkedIn y sus provincias (con ciudades que no son capital).
const ESPANA = [
  ['Andalucía', 'Andalusia', { Almería: [], Cádiz: ['Jerez de la Frontera', 'Algeciras'], Córdoba: [], Granada: [], Huelva: [], Jaén: ['Linares'], Málaga: ['Marbella'], Sevilla: ['Dos Hermanas'] }],
  ['Aragón', 'Aragon', { Huesca: [], Teruel: [], Zaragoza: [] }],
  ['Asturias', 'Asturias', { Asturias: ['Oviedo', 'Gijón', 'Avilés'] }],
  ['Islas Baleares', 'Balearic Islands', { 'Islas Baleares': ['Palma', 'Ibiza', 'Manacor'] }],
  ['Canarias', 'Canary Islands', { 'Las Palmas': ['Las Palmas de Gran Canaria', 'Telde'], 'Santa Cruz de Tenerife': ['San Cristóbal de La Laguna'] }],
  ['Cantabria', 'Cantabria', { Cantabria: ['Santander', 'Torrelavega'] }],
  ['Castilla-La Mancha', 'Castilla-La Mancha', { Albacete: [], 'Ciudad Real': ['Puertollano'], Cuenca: [], Guadalajara: [], Toledo: ['Talavera de la Reina'] }],
  ['Castilla y León', 'Castile and León', { Ávila: [], Burgos: [], León: ['Ponferrada'], Palencia: [], Salamanca: [], Segovia: [], Soria: [], Valladolid: [], Zamora: [] }],
  [
    'Cataluña',
    'Catalonia',
    { Barcelona: ["L'Hospitalet de Llobregat", 'Badalona', 'Terrassa', 'Sabadell', 'Mataró', 'Sant Cugat del Vallès'], Girona: [], Lleida: [], Tarragona: ['Reus'] },
  ],
  ['Comunidad Valenciana', 'Valencian Community', { Alicante: ['Elche', 'Benidorm', 'Torrevieja'], Castellón: ['Castellón de la Plana'], Valencia: ['Gandía'] }],
  ['Extremadura', 'Extremadura', { Badajoz: ['Mérida'], Cáceres: [] }],
  ['Galicia', 'Galicia', { 'A Coruña': ['Santiago de Compostela', 'Ferrol'], Lugo: [], Ourense: [], Pontevedra: ['Vigo'] }],
  [
    'Comunidad de Madrid',
    'Community of Madrid',
    {
      Madrid: [
        'Alcalá de Henares',
        'Alcobendas',
        'Fuenlabrada',
        'Getafe',
        'Las Rozas de Madrid',
        'Leganés',
        'Móstoles',
        'Pozuelo de Alarcón',
        'San Sebastián de los Reyes',
        'Torrejón de Ardoz',
        'Tres Cantos',
      ],
    },
  ],
  ['Región de Murcia', 'Region of Murcia', { Murcia: ['Cartagena', 'Lorca'] }],
  ['Navarra', 'Navarre', { Navarra: ['Pamplona'] }],
  ['País Vasco', 'Basque Country', { Álava: ['Vitoria-Gasteiz'], Bizkaia: ['Bilbao'], Gipuzkoa: ['San Sebastián'] }],
  ['La Rioja', 'La Rioja', { 'La Rioja': ['Logroño'] }],
  ['Ceuta', 'Ceuta', {}],
  ['Melilla', 'Melilla', {}],
];

// Otros nombres con los que se busca una zona.
const ALIAS = {
  Bizkaia: ['Vizcaya'],
  Gipuzkoa: ['Guipúzcoa'],
  Álava: ['Araba'],
  'San Sebastián': ['Donostia'],
  'A Coruña': ['La Coruña', 'Coruña'],
  'Islas Baleares': ['Baleares', 'Illes Balears', 'Mallorca'],
  Girona: ['Gerona'],
  Lleida: ['Lérida'],
  Ourense: ['Orense'],
  Castellón: ['Castelló'],
  Alicante: ['Alacant'],
  'Comunidad Valenciana': ['País Valenciano'],
  Cataluña: ['Catalunya'],
  Navarra: ['Nafarroa'],
};

// Fuera de España: país (código ISO, nombre en LinkedIn) y sus ciudades principales.
const MUNDO = [
  ['Portugal', 'pt', 'Portugal', [['Lisboa', 'Lisbon'], ['Oporto', 'Porto']]],
  ['Francia', 'fr', 'France', [['París', 'Paris'], ['Lyon', 'Lyon']]],
  ['Alemania', 'de', 'Germany', [['Berlín', 'Berlin'], ['Múnich', 'Munich'], ['Hamburgo', 'Hamburg']]],
  ['Reino Unido', 'gb', 'United Kingdom', [['Londres', 'London'], ['Mánchester', 'Manchester']]],
  ['Irlanda', 'ie', 'Ireland', [['Dublín', 'Dublin']]],
  ['Países Bajos', 'nl', 'Netherlands', [['Ámsterdam', 'Amsterdam']]],
  ['Bélgica', 'be', 'Belgium', [['Bruselas', 'Brussels']]],
  ['Italia', 'it', 'Italy', [['Milán', 'Milan'], ['Roma', 'Rome']]],
  ['Suiza', 'ch', 'Switzerland', [['Zúrich', 'Zurich'], ['Ginebra', 'Geneva']]],
  ['Austria', 'at', 'Austria', [['Viena', 'Vienna']]],
  ['Luxemburgo', 'lu', 'Luxembourg', []],
  ['Suecia', 'se', 'Sweden', [['Estocolmo', 'Stockholm']]],
  ['Dinamarca', 'dk', 'Denmark', [['Copenhague', 'Copenhagen']]],
  ['Noruega', 'no', 'Norway', [['Oslo', 'Oslo']]],
  ['Polonia', 'pl', 'Poland', [['Varsovia', 'Warsaw']]],
  ['Estados Unidos', 'us', 'United States', [['Nueva York', 'New York'], ['San Francisco', 'San Francisco'], ['Miami', 'Miami']]],
  ['Canadá', 'ca', 'Canada', [['Toronto', 'Toronto'], ['Montreal', 'Montreal']]],
  ['México', 'mx', 'Mexico', [['Ciudad de México', 'Mexico City'], ['Guadalajara (México)', 'Guadalajara, Jalisco, Mexico'], ['Monterrey', 'Monterrey']]],
  ['Argentina', 'ar', 'Argentina', [['Buenos Aires', 'Buenos Aires']]],
  ['Colombia', 'co', 'Colombia', [['Bogotá', 'Bogota'], ['Medellín', 'Medellin']]],
  ['Chile', 'cl', 'Chile', [['Santiago de Chile', 'Santiago, Chile']]],
  ['Perú', 'pe', 'Peru', [['Lima', 'Lima']]],
  ['Uruguay', 'uy', 'Uruguay', [['Montevideo', 'Montevideo']]],
];

function construir() {
  const zonas = [];
  const sumar = (z) => zonas.push({ ...z, clave: sinTildes([z.nombre, ...(ALIAS[z.nombre] ?? [])].join(' ')) });
  sumar({ nombre: 'España', tipo: 'pais', detalle: 'todo el país', busqueda: 'Spain', pais: 'es' });
  for (const [comunidad, enIngles, provincias] of ESPANA) {
    if (!Object.keys(provincias).length) {
      sumar({ nombre: comunidad, tipo: 'ciudad', detalle: 'ciudad autónoma', busqueda: `${comunidad}, Spain`, pais: 'es' });
      continue;
    }
    const soloUna = Object.keys(provincias).length === 1 && Object.keys(provincias)[0] === comunidad;
    if (!soloUna) sumar({ nombre: comunidad, tipo: 'comunidad', detalle: 'comunidad autónoma', busqueda: `${enIngles}, Spain`, pais: 'es' });
    for (const [provincia, ciudades] of Object.entries(provincias)) {
      sumar({ nombre: provincia, tipo: 'provincia', detalle: soloUna ? 'provincia y comunidad' : `provincia · ${comunidad}`, busqueda: `${provincia === comunidad ? enIngles : provincia}, Spain`, pais: 'es' });
      for (const ciudad of ciudades) sumar({ nombre: ciudad, tipo: 'ciudad', detalle: `${provincia} · ${comunidad}`, busqueda: `${ciudad}, Spain`, pais: 'es' });
    }
  }
  for (const [pais, codigo, enIngles, ciudades] of MUNDO) {
    sumar({ nombre: pais, tipo: 'pais', detalle: 'país', busqueda: enIngles, pais: codigo });
    for (const [ciudad, enLinkedIn] of ciudades) sumar({ nombre: ciudad, tipo: 'ciudad', detalle: pais, busqueda: enLinkedIn.includes(',') ? enLinkedIn : `${enLinkedIn}, ${enIngles}`, pais: codigo });
  }
  sumar({ nombre: 'En remoto · España', tipo: 'remoto', detalle: 'teletrabajo desde España', busqueda: 'Spain', pais: 'es', modalidad: 'remoto' });
  sumar({ nombre: 'En remoto · Europa', tipo: 'remoto', detalle: 'teletrabajo en empresas europeas', busqueda: 'European Union', pais: '', modalidad: 'remoto' });
  sumar({ nombre: 'En remoto · cualquier país', tipo: 'remoto', detalle: 'teletrabajo sin fronteras', busqueda: 'Worldwide', pais: '', modalidad: 'remoto' });
  return zonas;
}

export const ZONAS = construir();
const PESO_TIPO = { remoto: 0, pais: 1, comunidad: 2, provincia: 3, ciudad: 4 };

// Sugerencias para lo que se va escribiendo: primero lo que empieza igual.
export function buscarZonas(texto, { maximo = 8, excluir = [] } = {}) {
  const q = sinTildes(texto);
  const fuera = new Set(excluir.map(sinTildes));
  const candidatas = ZONAS.filter((z) => !fuera.has(sinTildes(z.nombre)));
  if (!q) return candidatas.filter((z) => ['España', 'Madrid', 'Barcelona', 'Valencia', 'En remoto · España'].includes(z.nombre)).slice(0, maximo);
  return candidatas
    .map((z) => {
      const nombre = sinTildes(z.nombre);
      const puntos = nombre === q ? 0 : nombre.startsWith(q) ? 1 : z.clave.split(/[\s,·'-]+/).some((p) => p.startsWith(q)) ? 2 : z.clave.includes(q) ? 3 : 9;
      return { z, puntos };
    })
    .filter((x) => x.puntos < 9)
    .sort((a, b) => a.puntos - b.puntos || PESO_TIPO[a.z.tipo] - PESO_TIPO[b.z.tipo] || a.z.nombre.localeCompare(b.z.nombre, 'es'))
    .slice(0, maximo)
    .map((x) => x.z);
}

// De lo que eligió la persona a cómo se busca. Si no está en el catálogo, se usa tal cual.
export function resolverZona(nombre) {
  const q = sinTildes(nombre);
  const z = ZONAS.find((x) => sinTildes(x.nombre) === q) ?? ZONAS.find((x) => x.clave.split(' ').includes(q) && x.tipo !== 'remoto');
  return z ?? { nombre: String(nombre).trim(), tipo: 'libre', detalle: '', busqueda: String(nombre).trim(), pais: '' };
}

// Distancia alrededor de una ciudad (LinkedIn la pide en millas).
export const DISTANCIAS = [
  [0, 'Solo la zona'],
  [10, '+10 km'],
  [25, '+25 km'],
  [50, '+50 km'],
  [100, '+100 km'],
];
export const millasDe = (km) => ({ 10: 5, 25: 15, 50: 30, 100: 60 })[km] ?? 0;
