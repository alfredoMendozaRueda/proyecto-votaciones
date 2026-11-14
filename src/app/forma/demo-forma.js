// Datos de ejemplo de Forma para la demo: tres semanas y media de comidas,
// pesos y entrenos de alguien que está perdiendo grasa a un ritmo moderado.
import { fechaISO, sumarDias } from '../../compartido/forma/fechas.js';
import { normalizarForma } from '../../compartido/forma/datos.js';
import { nutrientesDe } from '../../compartido/forma/diario.js';

const A = (id, nombre, marca, racion, kcal, proteina, hidratos, grasa, fibra = 0, extra = {}) => ({
  id,
  nombre,
  marca,
  racion,
  por100: { kcal, proteina, hidratos, grasa, fibra },
  origen: 'manual',
  favorito: false,
  usado: 0,
  veces: 0,
  ...extra,
});

const ALIMENTOS = [
  A('a-avena', 'Copos de avena', 'Hacendado', 50, 372, 13.5, 58.7, 7, 10),
  A('a-leche', 'Leche semidesnatada', 'Central Lechera', 250, 46, 3.1, 4.7, 1.6),
  A('a-platano', 'Plátano', '', 120, 89, 1.1, 22.8, 0.3, 2.6),
  A('a-cafe', 'Café con leche', '', 200, 38, 2.4, 3.6, 1.5),
  A('a-tostada', 'Tostada de pan integral', '', 60, 247, 13, 41, 3.4, 7),
  A('a-aceite', 'Aceite de oliva virgen extra', '', 10, 884, 0, 0, 100),
  A('a-pavo', 'Pechuga de pavo en lonchas', 'ElPozo', 50, 98, 20, 1.2, 1.5),
  A('a-pollo', 'Pechuga de pollo a la plancha', '', 180, 165, 31, 0, 3.6, 0, { favorito: true }),
  A('a-arroz', 'Arroz blanco cocido', '', 180, 130, 2.7, 28, 0.3, 0.4),
  A('a-ensalada', 'Ensalada mixta', '', 150, 25, 1.3, 4, 0.3, 2),
  A('a-skyr', 'Skyr natural', 'Arla', 150, 63, 11, 4, 0.2, 0, { favorito: true }),
  A('a-nueces', 'Nueces', '', 20, 654, 15, 14, 65, 7),
  A('a-salmon', 'Salmón al horno', '', 150, 208, 20, 0, 13),
  A('a-patata', 'Patata cocida', '', 200, 87, 1.9, 20, 0.1, 1.8),
  A('a-huevos', 'Huevo', '', 60, 143, 12.6, 0.7, 9.5),
  A('a-whey', 'Proteína whey', 'Prozis', 30, 380, 78, 6, 5),
  A('a-lentejas', 'Lentejas estofadas', '', 300, 116, 9, 20, 0.4, 8),
  A('a-yogur', 'Yogur griego ligero', 'Hacendado', 125, 68, 4.1, 3.6, 2.6),
  A('a-manzana', 'Manzana', '', 180, 52, 0.3, 14, 0.2, 2.4),
  A('a-ternera', 'Filete de ternera', '', 150, 158, 26, 0, 6),
];

const porId = Object.fromEntries(ALIMENTOS.map((a) => [a.id, a]));

const DIA_TIPO = [
  // desayuno, comida, merienda, cena (alternando un poco)
  {
    desayuno: [['a-avena', 60], ['a-leche', 250], ['a-platano', 120]],
    comida: [['a-pollo', 200], ['a-arroz', 180], ['a-ensalada', 150], ['a-aceite', 10]],
    merienda: [['a-skyr', 150], ['a-nueces', 20]],
    cena: [['a-salmon', 160], ['a-patata', 250], ['a-ensalada', 100]],
    almuerzo: [['a-platano', 120], ['a-whey', 30]],
  },
  {
    desayuno: [['a-cafe', 200], ['a-tostada', 60], ['a-aceite', 8], ['a-pavo', 50]],
    comida: [['a-lentejas', 400], ['a-tostada', 40], ['a-manzana', 180]],
    merienda: [['a-whey', 30], ['a-platano', 120]],
    cena: [['a-huevos', 180], ['a-ensalada', 150], ['a-tostada', 60], ['a-aceite', 8]],
    almuerzo: [['a-yogur', 125], ['a-nueces', 25]],
  },
  {
    desayuno: [['a-cafe', 200], ['a-tostada', 60], ['a-aceite', 8], ['a-pavo', 50]],
    comida: [['a-ternera', 180], ['a-patata', 220], ['a-ensalada', 120], ['a-aceite', 10]],
    merienda: [['a-yogur', 125], ['a-manzana', 180]],
    cena: [['a-pollo', 200], ['a-arroz', 200], ['a-aceite', 8]],
    almuerzo: [['a-tostada', 60], ['a-pavo', 50]],
  },
];

const HORAS = { desayuno: 8 * 60 + 5, almuerzo: 11 * 60 + 40, comida: 14 * 60 + 35, merienda: 18 * 60 + 10, cena: 21 * 60 + 20 };

export function formaDemo(hoy = fechaISO(), ahora = new Date()) {
  const dias = 25;
  const inicio = sumarDias(hoy, -dias);
  const registros = [];
  const pesos = [];
  const sesiones = [];
  const usos = {};
  const minutoAhora = ahora.getHours() * 60 + ahora.getMinutes();
  for (let i = 0; i <= dias; i++) {
    const fecha = sumarDias(inicio, i);
    const tipo = DIA_TIPO[i % 3 === 0 ? 0 : i % 2 ? 1 : 2];
    for (const [momento, items] of Object.entries(tipo)) {
      // Hoy, solo lo que ya ha pasado.
      if (fecha === hoy && HORAS[momento] > minutoAhora) continue;
      // El desayuno de siempre (café y tostada con pavo) casi todos los días.
      const lista = fecha !== hoy && momento === 'desayuno' && i % 4 !== 0 ? DIA_TIPO[1].desayuno : items;
      for (const [aid, g] of lista) {
        const a = porId[aid];
        registros.push({ id: `r-${fecha}-${momento}-${aid}`, fecha, momento, minuto: HORAS[momento] + ((i * 7) % 25), nombre: a.nombre, alimentoId: aid, gramos: g, ...nutrientesDe(a, g), creado: 0 });
        a.veces++;
        a.usado = Math.max(a.usado, Date.parse(`${fecha}T12:00:00`));
      }
    }
    // Peso cada mañana (salvo algún día), bajando ~0,45 kg por semana con ruido.
    if (i % 5 !== 3) pesos.push({ id: `w-${fecha}`, fecha, kg: Math.round((84.6 - i * 0.065 + Math.sin(i * 1.7) * 0.35) * 10) / 10 });
  }
  // Una comida fuera estimada con la IA.
  registros.push({ id: 'r-libre', fecha: sumarDias(hoy, -2), momento: 'cena', minuto: 22 * 60, nombre: 'Cena en restaurante (hamburguesa y patatas)', kcal: 1150, proteina: 48, hidratos: 98, grasa: 62, fibra: 7, estimado: true, libre: true, creado: 0 });
  usos[sumarDias(hoy, -2)] = 1;
  // Entrenos: torso / pierna, 4 días a la semana, progresando.
  const torso = [
    ['x-press-banca', 72.5, 8],
    ['x-remo-con-barra', 65, 10],
    ['x-press-militar', 42.5, 8],
    ['x-jalon-al-pecho', 60, 12],
    ['x-curl-con-barra', 30, 10],
  ];
  const pierna = [
    ['x-sentadilla', 100, 6],
    ['x-peso-muerto-rumano', 90, 8],
    ['x-prensa', 180, 12],
    ['x-curl-femoral', 45, 12],
    ['x-elevacion-de-gemelos-de-pie', 80, 15],
  ];
  let n = 0;
  for (let i = 0; i < dias; i++) {
    const fecha = sumarDias(inicio, i);
    const d = new Date(`${fecha}T12:00:00`).getDay();
    if (![1, 2, 4, 5].includes(d)) continue;
    const plan = d === 1 || d === 4 ? torso : pierna;
    const semana = Math.floor(i / 7);
    const series = [];
    for (const [eid, kg, reps] of plan) {
      series.push({ id: `k${n}-c-${eid}`, ejercicioId: eid, kg: Math.round(kg * 0.5), reps: 10, calentamiento: true, hecha: true });
      for (let s = 0; s < 3; s++) series.push({ id: `k${n}-${s}-${eid}`, ejercicioId: eid, kg: kg + semana * 2.5, reps: reps - (s === 2 ? 1 : 0), rir: s === 2 ? 1 : 2, calentamiento: false, hecha: true });
    }
    const t0 = Date.parse(`${fecha}T18:30:00`);
    sesiones.push({ id: `s-demo-${n++}`, fecha, rutinaId: plan === torso ? 'q-torso' : 'q-pierna', nombre: plan === torso ? 'Torso' : 'Pierna', inicio: t0, fin: t0 + 68 * 60000, notas: '', series, cardio: d === 5 ? [{ id: `c${n}`, tipo: 'Cinta inclinada', minutos: 20, intensidad: 'media', kcal: 190 }] : [] });
  }
  const medidas = [];
  for (const [k, dif] of [
    [0, 0],
    [7, -0.6],
    [14, -1.1],
    [21, -1.8],
  ]) {
    const fecha = sumarDias(inicio, k);
    medidas.push({ id: `v-c-${k}`, fecha, tipo: 'Cintura', cm: Math.round((92 + dif) * 10) / 10 }, { id: `v-b-${k}`, fecha, tipo: 'Brazo', cm: Math.round((36.5 + dif * -0.1) * 10) / 10 });
  }
  return normalizarForma({
    perfil: {
      sexo: 'hombre',
      nacimiento: '1996-05-21',
      altura: 179,
      peso: 84.6,
      grasa: 21,
      unidades: 'metrico',
      zona: 'Europe/Madrid',
      trabajo: 'sentado',
      pasos: '8-12',
      diasEntreno: 4,
      minutosSesion: 70,
      tipoEntreno: 'pesas',
      cardioSemana: 20,
      objetivo: 'perder',
      pesoObjetivo: 78,
      ritmo: 'moderado',
      modoKcal: 'ciclo',
      creado: inicio,
    },
    alimentos: ALIMENTOS,
    registros,
    pesos,
    medidas,
    sesiones,
    usosIA: usos,
    suplementos: [
      { id: 'u-creatina', nombre: 'Creatina 5 g' },
      { id: 'u-omega', nombre: 'Omega 3' },
    ],
    dias: {
      [hoy]: { agua: 1250, suplementos: ['u-creatina'] },
      [sumarDias(hoy, -1)]: { agua: 2750, suplementos: ['u-creatina', 'u-omega'] },
    },
    rutinas: [
      {
        id: 'q-torso',
        nombre: 'Torso',
        ejercicios: torso.map(([e, , r]) => ({ ejercicioId: e, series: 3, repMin: Math.max(1, r - 2), repMax: r })),
      },
      {
        id: 'q-pierna',
        nombre: 'Pierna',
        ejercicios: pierna.map(([e, , r]) => ({ ejercicioId: e, series: 3, repMin: Math.max(1, r - 2), repMax: r })),
      },
    ],
    hitos: [
      { id: 'h-1', tipo: 'peso', comparador: '<', valor: 83, recompensa: 'Camiseta nueva del gimnasio', cumplido: sumarDias(hoy, -6) },
      { id: 'h-2', tipo: 'peso', comparador: '<', valor: 80, recompensa: 'Cena en el japonés' },
      { id: 'h-3', tipo: 'fuerza', comparador: '>', valor: 85, ejercicioId: 'x-press-banca', recompensa: 'Cinturón de levantamiento' },
      { id: 'h-4', tipo: 'medida', comparador: '<', valor: 88, medida: 'Cintura', recompensa: 'Vaqueros de una talla menos' },
    ],
  });
}

// Respuestas de la IA simulada para Forma (estimar, foto e ideas).
export function respuestaFormaDemo(etiqueta) {
  if (etiqueta === 'forma-ideas') {
    return {
      ideas: [
        {
          nombre: 'Tortilla francesa con atún y tomate',
          items: [
            { nombre: 'Huevos', cantidad_g: 120, kcal: 172, proteina_g: 15, hidratos_g: 1, grasa_g: 11, fibra_g: 0, confianza: 0.9 },
            { nombre: 'Atún al natural', cantidad_g: 80, kcal: 86, proteina_g: 20, hidratos_g: 0, grasa_g: 1, fibra_g: 0, confianza: 0.9 },
            { nombre: 'Tomate', cantidad_g: 150, kcal: 27, proteina_g: 1.3, hidratos_g: 5.8, grasa_g: 0.3, fibra_g: 1.8, confianza: 0.9 },
          ],
        },
        {
          nombre: 'Bol de skyr con frutos rojos y avena',
          items: [
            { nombre: 'Skyr natural', cantidad_g: 250, kcal: 158, proteina_g: 27, hidratos_g: 10, grasa_g: 0.5, fibra_g: 0, confianza: 0.9 },
            { nombre: 'Frutos rojos', cantidad_g: 100, kcal: 45, proteina_g: 1, hidratos_g: 10, grasa_g: 0.3, fibra_g: 4, confianza: 0.9 },
            { nombre: 'Copos de avena', cantidad_g: 30, kcal: 112, proteina_g: 4, hidratos_g: 18, grasa_g: 2, fibra_g: 3, confianza: 0.9 },
          ],
        },
        {
          nombre: 'Wrap de pollo con hummus',
          items: [
            { nombre: 'Tortilla de trigo integral', cantidad_g: 60, kcal: 180, proteina_g: 5, hidratos_g: 30, grasa_g: 4, fibra_g: 4, confianza: 0.8 },
            { nombre: 'Pollo asado', cantidad_g: 120, kcal: 198, proteina_g: 37, hidratos_g: 0, grasa_g: 5, fibra_g: 0, confianza: 0.8 },
            { nombre: 'Hummus', cantidad_g: 30, kcal: 75, proteina_g: 2.4, hidratos_g: 4, grasa_g: 5.5, fibra_g: 1.8, confianza: 0.8 },
          ],
        },
      ],
    };
  }
  return {
    items: [
      { nombre: 'Bocadillo de jamón serrano (pan de barra)', cantidad_g: 230, kcal: 560, proteina_g: 30, hidratos_g: 68, grasa_g: 17, fibra_g: 3.5, confianza: 0.7 },
      { nombre: 'Tomate rallado con aceite', cantidad_g: 40, kcal: 55, proteina_g: 0.4, hidratos_g: 1.6, grasa_g: 5, fibra_g: 0.5, confianza: 0.6 },
      { nombre: 'Café con leche', cantidad_g: 200, kcal: 76, proteina_g: 4.8, hidratos_g: 7.2, grasa_g: 3, fibra_g: 0, confianza: 0.9 },
    ],
  };
}
