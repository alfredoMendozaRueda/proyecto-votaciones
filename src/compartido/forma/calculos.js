// Las cuentas de Forma: metabolismo basal, gasto diario, objetivo de calorías,
// macros, agua, fibra y fechas estimadas. Todo sale del perfil; nada está fijado
// para una persona concreta. Son funciones puras: se prueban en test/forma.test.js.
import { edadEn, sumarDias, fechaISO } from './fechas.js';

export const KCAL_POR_KG_GRASA = 7700;

export const OBJETIVOS = [
  { id: 'perder', nombre: 'Perder grasa' },
  { id: 'recomposicion', nombre: 'Recomposición' },
  { id: 'mantener', nombre: 'Mantener' },
  { id: 'volumen', nombre: 'Ganar músculo' },
];

export const RITMOS = [
  { id: 'suave', nombre: 'Suave' },
  { id: 'moderado', nombre: 'Moderado' },
  { id: 'agresivo', nombre: 'Agresivo' },
];

// Cuánto se aparta el objetivo del mantenimiento (fracción).
const AJUSTE = {
  perder: { suave: -0.1, moderado: -0.2, agresivo: -0.25 },
  // Recomposición: de −5 % a −10 %; se toma el punto medio, y solo hay un ritmo.
  recomposicion: { suave: -0.075, moderado: -0.075, agresivo: -0.075 },
  mantener: { suave: 0, moderado: 0, agresivo: 0 },
  volumen: { suave: 0.05, moderado: 0.1, agresivo: 0.15 },
};

export const ajusteObjetivo = (objetivo, ritmo) => AJUSTE[objetivo]?.[ritmo] ?? AJUSTE[objetivo]?.moderado ?? 0;

export const TRABAJOS = [
  { id: 'sentado', nombre: 'Sentado', detalle: 'Oficina, estudiar, conducir', factor: 1.2 },
  { id: 'de-pie', nombre: 'De pie', detalle: 'Tienda, hostelería, profesor', factor: 1.35 },
  { id: 'fisico', nombre: 'Físico', detalle: 'Obra, almacén, reparto', factor: 1.5 },
];

export const PASOS = [
  { id: 'menos-5', nombre: 'Menos de 5.000', pasos: 3500 },
  { id: '5-8', nombre: '5.000 – 8.000', pasos: 6500 },
  { id: '8-12', nombre: '8.000 – 12.000', pasos: 10000 },
  { id: 'mas-12', nombre: 'Más de 12.000', pasos: 13500 },
];

export const TIPOS_ENTRENO = [
  { id: 'pesas', nombre: 'Pesas', met: 5 },
  { id: 'cardio', nombre: 'Cardio', met: 7 },
  { id: 'mixto', nombre: 'Mixto', met: 6 },
];

// El factor del trabajo ya incluye unos 3.000 pasos de un día normal: solo cuentan los de más.
const PASOS_BASE = 3000;
const KCAL_POR_PASO_Y_KG = 0.0005;
const MET_CARDIO_EXTRA = 7;

// kcal que suman los pasos de un día (por encima de los ~3.000 que ya cuenta el trabajo).
export const kcalPasos = (pasos, peso) => Math.max(0, pasos - PASOS_BASE) * peso * KCAL_POR_PASO_Y_KG;

export const pasosDe = (perfil) => (Number.isFinite(perfil?.pasosExactos) && perfil.pasosExactos > 0 ? perfil.pasosExactos : (PASOS.find((p) => p.id === perfil?.pasos)?.pasos ?? 6500));

// Metabolismo basal: Katch-McArdle si sabes tu % de grasa; si no, Mifflin-St Jeor.
export function metabolismoBasal({ sexo, peso, altura, edad, grasa }) {
  if (Number.isFinite(grasa) && grasa > 3 && grasa < 70) {
    const magra = peso * (1 - grasa / 100);
    return { kcal: 370 + 21.6 * magra, formula: 'Katch-McArdle', magra };
  }
  const base = 10 * peso + 6.25 * altura - 5 * edad;
  return { kcal: base + (sexo === 'mujer' ? -161 : 5), formula: 'Mifflin-St Jeor' };
}

// kcal de más que gasta una sesión (MET − 1: la hora que entrenas ya cuenta en el basal).
export const kcalEjercicio = (met, peso, minutos) => Math.max(0, met - 1) * peso * (minutos / 60);

// Gasto diario: día de descanso, día de entreno y media de la semana.
export function gastoDiario(perfil, hoy = fechaISO()) {
  const peso = perfil.peso;
  const edad = edadEn(perfil.nacimiento, hoy) ?? 30;
  const basal = metabolismoBasal({ sexo: perfil.sexo, peso, altura: perfil.altura, edad, grasa: perfil.grasa });
  const factor = TRABAJOS.find((t) => t.id === perfil.trabajo)?.factor ?? 1.2;
  const pasos = kcalPasos(pasosDe(perfil), peso);
  const cardioDiario = kcalEjercicio(MET_CARDIO_EXTRA, peso, (perfil.cardioSemana ?? 0) / 7);
  const descanso = basal.kcal * factor + pasos + cardioDiario;
  const met = TIPOS_ENTRENO.find((t) => t.id === perfil.tipoEntreno)?.met ?? 5;
  const sesion = kcalEjercicio(met, peso, perfil.minutosSesion ?? 60);
  const entreno = descanso + sesion;
  const dias = Math.min(7, Math.max(0, perfil.diasEntreno ?? 0));
  const media = (dias * entreno + (7 - dias) * descanso) / 7;
  return { basal: basal.kcal, formula: basal.formula, edad, actividad: basal.kcal * (factor - 1) + pasos + cardioDiario, sesion, descanso, entreno, media, dias };
}

const r5 = (n) => Math.round(n / 5) * 5;
const r1 = (n) => Math.round(n);

// Macros de un día con esas kcal. bloqueados: valores que pusiste a mano.
export function macrosPara(kcal, perfil, bloqueados = {}) {
  const peso = perfil.peso;
  const gPorKg = Number.isFinite(perfil.proteinaPorKg) ? perfil.proteinaPorKg : 2;
  const proteina = Number.isFinite(bloqueados.proteina) ? bloqueados.proteina : r1(gPorKg * peso);
  const grasaMin = 0.7 * peso;
  const grasa = Number.isFinite(bloqueados.grasa) ? bloqueados.grasa : r1(Math.max((kcal * (perfil.grasaPct ?? 25)) / 100 / 9, grasaMin));
  const restoHc = (kcal - proteina * 4 - grasa * 9) / 4;
  const hidratos = Number.isFinite(bloqueados.hidratos) ? bloqueados.hidratos : Math.max(0, r1(restoHc));
  const fibra = Number.isFinite(bloqueados.fibra) ? bloqueados.fibra : r1((14 * kcal) / 1000);
  return { proteina, grasa, hidratos, fibra, faltanHidratos: restoHc < 0 };
}

export function aguaPara(perfil, entreno) {
  return Math.round((35 * perfil.peso + (entreno ? 500 : 0)) / 50) * 50;
}

// El plan completo: lo que enseña el onboarding y lo que usa el diario.
// mantenimiento: si el TDEE adaptativo lo corrigió, la media real que propuso y aceptaste.
export function calcularPlan(perfil, { bloqueados = {}, hoy = fechaISO() } = {}) {
  const gasto = gastoDiario(perfil, hoy);
  const ajuste = ajusteObjetivo(perfil.objetivo, perfil.ritmo);
  // TDEE corregido con tus datos reales: escala los tres días por igual.
  const escala = Number.isFinite(perfil.mantenimientoReal) && perfil.mantenimientoReal > 800 ? perfil.mantenimientoReal / gasto.media : 1;
  const media = gasto.media * escala;
  const ciclo = perfil.modoKcal === 'ciclo';
  // Repartir el mismo total semanal: cada día su gasto × (1 + ajuste) es lineal, así que la media cuadra.
  // + el ajuste automático por tu ritmo real (Progreso → Semanas), si lo aplicaste.
  const extra = Number.isFinite(perfil.ajusteKcal) ? perfil.ajusteKcal : 0;
  const kcalDia = (g) => (Number.isFinite(bloqueados.kcal) ? bloqueados.kcal : r5(g * escala * (1 + ajuste) + extra));
  const kcalEntreno = ciclo ? kcalDia(gasto.entreno) : kcalDia(gasto.media);
  const kcalDescanso = ciclo ? kcalDia(gasto.descanso) : kcalDia(gasto.media);
  const kcalMedia = (gasto.dias * kcalEntreno + (7 - gasto.dias) * kcalDescanso) / 7;
  const dia = (kcal, entreno) => ({ kcal, ...macrosPara(kcal, perfil, bloqueados), agua: Number.isFinite(bloqueados.agua) ? bloqueados.agua : aguaPara(perfil, entreno) });
  const entreno = dia(kcalEntreno, true);
  const descanso = dia(kcalDescanso, false);
  const avisos = [];
  if (Math.min(kcalEntreno, kcalDescanso) < gasto.basal) {
    avisos.push(`El objetivo queda por debajo de tu metabolismo basal (${r1(gasto.basal)} kcal). No es recomendable mantenerlo mucho tiempo: baja el ritmo o habla con un profesional.`);
  }
  if (entreno.faltanHidratos || descanso.faltanHidratos) avisos.push('Con esa proteína y esa grasa no quedan calorías para hidratos: revisa los macros.');
  return {
    ...gasto,
    mantenimiento: media,
    ajuste,
    ciclo,
    kcalMedia,
    entreno,
    descanso,
    avisos,
    estimacion: fechaEstimada(perfil, media - kcalMedia, hoy),
  };
}

// Cuándo llegarías al peso objetivo a este ritmo (déficit o superávit diario medio).
export function fechaEstimada(perfil, deficitDiario, hoy = fechaISO(), pesoActual = perfil.peso) {
  const objetivo = perfil.pesoObjetivo;
  if (!Number.isFinite(objetivo) || !Number.isFinite(pesoActual)) return null;
  const kg = pesoActual - objetivo;
  if (Math.abs(kg) < 0.05) return { fecha: hoy, dias: 0, kgSemana: 0 };
  // Para bajar hace falta déficit (> 0); para subir, superávit (< 0).
  if (Math.sign(kg) !== Math.sign(deficitDiario) || Math.abs(deficitDiario) < 1) return null;
  const dias = Math.ceil((Math.abs(kg) * KCAL_POR_KG_GRASA) / Math.abs(deficitDiario));
  if (dias > 3650) return null;
  return { fecha: sumarDias(hoy, dias), dias, kgSemana: (deficitDiario * 7) / KCAL_POR_KG_GRASA };
}

// ---------- Fuerza ----------

// 1RM estimado (Epley). Con una repetición es el propio peso.
export const epley = (kg, reps) => (reps <= 0 ? 0 : reps === 1 ? kg : kg * (1 + reps / 30));

// Discos por lado para cargar «total» en una barra de «barra» kg.
export function discosPorLado(total, { barra = 20, discos = [25, 20, 15, 10, 5, 2.5, 1.25] } = {}) {
  if (!Number.isFinite(total) || total < barra) return { lado: [], sobra: 0, exacto: total === barra, total: barra };
  let resto = Math.round(((total - barra) / 2) * 1000) / 1000;
  const lado = [];
  for (const d of [...discos].filter((x) => x > 0).sort((a, b) => b - a)) {
    while (resto + 1e-9 >= d) {
      lado.push(d);
      resto = Math.round((resto - d) * 1000) / 1000;
    }
  }
  const cargado = barra + 2 * lado.reduce((s, d) => s + d, 0);
  return { lado, sobra: resto * 2, exacto: resto < 1e-9, total: cargado };
}

// ---------- Unidades ----------

export const KG_POR_LB = 0.45359237;
export const CM_POR_IN = 2.54;
export const aKg = (valor, unidades) => (unidades === 'imperial' ? valor * KG_POR_LB : valor);
export const deKg = (kg, unidades) => (unidades === 'imperial' ? kg / KG_POR_LB : kg);
export const aCm = (valor, unidades) => (unidades === 'imperial' ? valor * CM_POR_IN : valor);
export const deCm = (cm, unidades) => (unidades === 'imperial' ? cm / CM_POR_IN : cm);
export const unidadPeso = (u) => (u === 'imperial' ? 'lb' : 'kg');
export const unidadLongitud = (u) => (u === 'imperial' ? 'in' : 'cm');
