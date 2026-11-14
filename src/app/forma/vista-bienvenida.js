// Bienvenida de Forma: el asistente de 4 pasos (datos, actividad, objetivo y
// resultado explicado). También sirve para editar el perfil desde Perfil.
import { calcularPlan, TRABAJOS, PASOS, TIPOS_ENTRENO, OBJETIVOS, aKg, deKg, aCm, deCm, unidadPeso, unidadLongitud } from '../../compartido/forma/calculos.js';
import { normalizarPerfil } from '../../compartido/forma/datos.js';
import { guardarPerfil } from '../../compartido/forma/acciones.js';
import { fechaLarga } from '../../compartido/forma/fechas.js';
import { ic, escapar, num } from './ui.js';

const RITMOS_INFO = {
  perder: { suave: '−10 % · unos 0,25–0,4 kg/sem', moderado: '−20 % · unos 0,5–0,7 kg/sem', agresivo: '−25 % · unos 0,7–0,9 kg/sem' },
  volumen: { suave: '+5 % · ganancia limpia', moderado: '+10 %', agresivo: '+15 % · más rápido, más grasa' },
};

function zonaDetectada() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Madrid';
  } catch {
    return 'Europe/Madrid';
  }
}

function zonas() {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return ['Europe/Madrid', 'Atlantic/Canary', 'Europe/London', 'America/Mexico_City', 'America/Bogota', 'America/Argentina/Buenos_Aires', 'America/New_York'];
  }
}

const PERFIL_INICIAL = () => ({
  sexo: 'hombre',
  nacimiento: '1995-01-01',
  altura: 175,
  peso: 75,
  unidades: 'metrico',
  zona: zonaDetectada(),
  trabajo: 'sentado',
  pasos: '5-8',
  diasEntreno: 4,
  minutosSesion: 60,
  tipoEntreno: 'pesas',
  cardioSemana: 0,
  objetivo: 'perder',
  ritmo: 'moderado',
  modoKcal: 'fijas',
});

export function vistaBienvenida(ctx) {
  const local = () => {
    if (!ctx.estado.local.onb) ctx.estado.local.onb = { paso: -1, p: PERFIL_INICIAL(), bloqueados: {} };
    return ctx.estado.local.onb;
  };

  const seg = (campo, opciones, valor) =>
    `<div class="f-segmento" role="group">${opciones.map(([v, t]) => `<button type="button" data-a="onb-set" data-campo="${campo}" data-valor="${v}" aria-pressed="${String(valor) === String(v)}">${escapar(t)}</button>`).join('')}</div>`;

  const opcion = (campo, v, titulo, detalle, valor) =>
    `<button type="button" class="f-opcion" data-a="onb-set" data-campo="${campo}" data-valor="${v}" aria-pressed="${valor === v}"><span><strong>${escapar(titulo)}</strong>${detalle ? `<small>${escapar(detalle)}</small>` : ''}</span><span class="f-opcion__marca"></span></button>`;

  const campoNum = (nombre, etiqueta, valor, unidad, extra = '') =>
    `<label class="f-campo"><span>${escapar(etiqueta)}</span><div class="f-con-unidad" data-unidad="${escapar(unidad)}"><input class="f-entrada" type="text" inputmode="decimal" autocomplete="off" step="any" name="${nombre}" data-entrada="onb" value="${valor ?? ''}" ${extra}></div></label>`;

  function pasoDatos(p) {
    const u = p.unidades;
    return `
      <div class="f-columna">
        <span class="f-etiqueta">Sexo</span>
        ${seg('sexo', [['hombre', 'Hombre'], ['mujer', 'Mujer']], p.sexo)}
      </div>
      <label class="f-campo"><span>Fecha de nacimiento</span><input class="f-entrada" type="date" name="nacimiento" data-entrada="onb" value="${escapar(p.nacimiento)}" max="${ctx.hoy()}"></label>
      <div class="f-rejilla-2">
        ${campoNum('altura', 'Altura', Math.round(deCm(p.altura, u) * 10) / 10, unidadLongitud(u))}
        ${campoNum('peso', 'Peso actual', Math.round(deKg(p.peso, u) * 10) / 10, unidadPeso(u))}
      </div>
      ${campoNum('grasa', '% de grasa corporal (opcional)', p.grasa ?? '', '%', 'placeholder="Si lo sabes, el cálculo mejora"')}
      <div class="f-columna">
        <span class="f-etiqueta">Unidades</span>
        ${seg('unidades', [['metrico', 'kg · cm'], ['imperial', 'lb · in']], u)}
      </div>
      <label class="f-campo"><span>Zona horaria (para saber de qué día es cada registro)</span>
        <select class="f-entrada" name="zona" data-cambio="onb-zona">${zonas()
          .map((z) => `<option value="${escapar(z)}" ${z === p.zona ? 'selected' : ''}>${escapar(z.replace(/_/g, ' '))}</option>`)
          .join('')}</select></label>`;
  }

  function pasoActividad(p) {
    return `
      <div class="f-columna"><span class="f-etiqueta">Tu trabajo</span>
        <div class="f-opciones">${TRABAJOS.map((t) => opcion('trabajo', t.id, t.nombre, t.detalle, p.trabajo)).join('')}</div></div>
      <div class="f-columna"><span class="f-etiqueta">Pasos al día</span>
        <div class="f-rejilla-2">${PASOS.map((x) => `<button type="button" class="f-chip" style="justify-content:center" data-a="onb-set" data-campo="pasos" data-valor="${x.id}" aria-pressed="${p.pasos === x.id}">${escapar(x.nombre)}</button>`).join('')}</div></div>
      <div class="f-columna"><span class="f-etiqueta">Días de entreno a la semana</span>
        <div class="f-segmento">${[0, 1, 2, 3, 4, 5, 6, 7].map((d) => `<button type="button" data-a="onb-set" data-campo="diasEntreno" data-valor="${d}" aria-pressed="${p.diasEntreno === d}">${d}</button>`).join('')}</div></div>
      <div class="f-columna"><span class="f-etiqueta">Tipo de entreno</span>${seg('tipoEntreno', TIPOS_ENTRENO.map((t) => [t.id, t.nombre]), p.tipoEntreno)}</div>
      <div class="f-rejilla-2">
        ${campoNum('minutosSesion', 'Duración de la sesión', p.minutosSesion, 'min')}
        ${campoNum('cardioSemana', 'Cardio extra a la semana', p.cardioSemana, 'min')}
      </div>`;
  }

  function pasoObjetivo(p) {
    const u = p.unidades;
    const ritmos = p.objetivo === 'perder' || p.objetivo === 'volumen';
    return `
      <div class="f-columna"><span class="f-etiqueta">Objetivo</span>
        <div class="f-rejilla-2">${OBJETIVOS.map((o) => `<button type="button" class="f-opcion" style="min-height:64px" data-a="onb-set" data-campo="objetivo" data-valor="${o.id}" aria-pressed="${p.objetivo === o.id}"><span><strong>${escapar(o.nombre)}</strong></span></button>`).join('')}</div></div>
      <div class="f-rejilla-2">
        ${campoNum('pesoObjetivo', 'Peso objetivo', p.pesoObjetivo ? Math.round(deKg(p.pesoObjetivo, u) * 10) / 10 : '', unidadPeso(u))}
        ${campoNum('grasaObjetivo', '% grasa objetivo (opcional)', p.grasaObjetivo ?? '', '%')}
      </div>
      ${
        ritmos
          ? `<div class="f-columna"><span class="f-etiqueta">Ritmo</span>
        <div class="f-opciones">${['suave', 'moderado', 'agresivo'].map((r) => opcion('ritmo', r, r[0].toUpperCase() + r.slice(1), RITMOS_INFO[p.objetivo][r], p.ritmo)).join('')}</div></div>`
          : p.objetivo === 'recomposicion'
            ? '<p class="f-explica">Recomposición: un déficit pequeño (−5 a −10 %) con mucha proteína para perder grasa sin perder músculo.</p>'
            : ''
      }
      <div class="f-columna"><span class="f-etiqueta">Calorías</span>
        <div class="f-opciones">
          ${opcion('modoKcal', 'fijas', 'Las mismas todos los días', 'Más fácil de seguir', p.modoKcal)}
          ${opcion('modoKcal', 'ciclo', 'Más los días de entreno', 'Mismo total a la semana, repartido según entrenes o descanses', p.modoKcal)}
        </div></div>`;
  }

  function pasoResultado(o) {
    const perfil = normalizarPerfil(o.p);
    const plan = calcularPlan(perfil, { bloqueados: o.bloqueados, hoy: ctx.hoy() });
    const dia = plan.descanso;
    const e = plan.estimacion;
    return `
      <div class="f-resultado">
        <div><span>Metabolismo basal</span><b>${num(plan.basal)}</b><small>kcal · ${escapar(plan.formula)}</small></div>
        <div><span>Mantenimiento</span><b>${num(plan.mantenimiento)}</b><small>kcal de media al día</small></div>
        ${
          plan.ciclo
            ? `<div><span>Día de entreno</span><b>${num(plan.entreno.kcal)}</b><small>kcal</small></div><div><span>Día de descanso</span><b>${num(plan.descanso.kcal)}</b><small>kcal</small></div>`
            : `<div class="ancho"><span>Tu objetivo</span><b>${num(dia.kcal)} kcal</b><small>${plan.ajuste ? `${plan.ajuste > 0 ? '+' : '−'}${num(Math.abs(plan.ajuste * 100), 1)} % sobre tu mantenimiento` : 'Igual que tu mantenimiento'}</small></div>`
        }
        <div><span>Proteína</span><b>${num(dia.proteina)} g</b><small>${num(perfil.proteinaPorKg ?? 2, 1)} g por kg</small></div>
        <div><span>Grasa</span><b>${num(dia.grasa)} g</b><small>25 % de las kcal (mín. 0,7 g/kg)</small></div>
        <div><span>Hidratos</span><b>${num(dia.hidratos)} g</b><small>El resto de calorías</small></div>
        <div><span>Fibra · Agua</span><b>${num(dia.fibra)} g</b><small>${num(dia.agua / 1000, 1)} L de agua${plan.ciclo ? ' (+0,5 L entrenando)' : ''}</small></div>
        ${e ? `<div class="ancho"><span>Llegarías a ${num(deKg(perfil.pesoObjetivo, perfil.unidades), 1)} ${unidadPeso(perfil.unidades)}</span><b>${escapar(fechaLarga(e.fecha))}</b><small>En ${num(e.dias)} días, a unos ${num(Math.abs(e.kgSemana), 2)} kg por semana (1 kg de grasa ≈ 7.700 kcal)</small></div>` : ''}
      </div>
      ${plan.avisos.map((a) => `<div class="f-panel f-panel--aviso"><p class="f-explica">${escapar(a)}</p></div>`).join('')}
      <details class="f-panel"><summary class="f-etiqueta" style="cursor:pointer">Cómo lo he calculado</summary>
        <p class="f-explica" style="margin-top:10px">
          Basal con ${escapar(plan.formula)}${plan.formula === 'Katch-McArdle' ? ' (usa tu masa magra)' : ''}: ${num(plan.basal)} kcal.
          Con tu trabajo, tus pasos y el cardio, el mantenimiento sale en ${num(plan.mantenimiento)} kcal de media al día contando
          ${plan.dias} entrenos de ${perfil.minutosSesion} min (${num(plan.sesion)} kcal cada uno, con valores MET).
          ${plan.ajuste ? `El objetivo aplica un ${plan.ajuste > 0 ? '+' : '−'}${num(Math.abs(plan.ajuste * 100), 1)} %.` : ''}
          Tras 2–3 semanas apuntando, Forma comparará lo que comes con cómo cambia tu peso y te propondrá ajustarlo.
        </p></details>
      <div class="f-panel f-columna">
        <span class="f-etiqueta">Ajustar a mano (opcional)</span>
        <div class="f-rejilla-2">
          ${['kcal', 'proteina', 'grasa', 'hidratos'].map((k) => `<label class="f-campo"><span>${{ kcal: 'Kcal', proteina: 'Proteína (g)', grasa: 'Grasa (g)', hidratos: 'Hidratos (g)' }[k]}</span><input class="f-entrada" type="number" inputmode="numeric" name="${k}" data-entrada="onb-bloq" placeholder="${num(dia[k])}" value="${o.bloqueados[k] ?? ''}"></label>`).join('')}
        </div>
        <p class="f-tenue">Lo que pongas aquí queda fijo y no se recalcula. Puedes cambiarlo luego en Perfil.</p>
      </div>`;
  }

  function cuerpoPasos(o) {
    const pasos = [
      ['Tus datos', pasoDatos],
      ['Tu actividad', pasoActividad],
      ['Tu objetivo', pasoObjetivo],
      ['Tu plan', pasoResultado],
    ];
    const [titulo, f] = pasos[o.paso];
    return `
      <div class="f-pasos" aria-hidden="true">${pasos.map((_, i) => `<i class="${i <= o.paso ? 'hecho' : ''}"></i>`).join('')}</div>
      <div class="f-fila f-entre"><h1 class="f-titulo" style="font-size:24px">${escapar(titulo)}</h1><span class="f-tenue">${o.paso + 1} / 4</span></div>
      <form class="f-columna" data-form="onb" novalidate>${o.paso === 3 ? f(o) : f(o.p)}</form>
      <p class="f-error" data-onb-error hidden></p>
      <div class="f-pie-fijo">
        ${o.paso > 0 || o.editando ? `<button type="button" class="f-boton" data-a="onb-atras">${ic('atras', 16)}${o.paso === 0 ? 'Cancelar' : 'Atrás'}</button>` : ''}
        <button type="button" class="f-boton f-boton--azul" style="flex:1" data-a="onb-siguiente">${o.paso === 3 ? (o.editando ? 'Guardar cambios' : 'Empezar') : 'Siguiente'}</button>
      </div>`;
  }

  function html() {
    const o = local();
    if (o.paso < 0) {
      return `<div class="f-vista">
        <div class="f-bienvenida">
          <span class="f-etiqueta">Dieta y gimnasio</span>
          <h1 class="f-titulo">Calcula tu plan<br>y entrena con datos.</h1>
          <p class="f-explica">Te pido unos datos y calculo tus calorías, macros y una fecha estimada para tu objetivo. Luego apuntas comidas en tres toques, tu peso y tus entrenos. Todo se guarda cifrado en tus dispositivos.</p>
        </div>
        <div class="f-panel f-columna">
          ${[
            ['diario', 'Diario de comidas', 'Busca, escanea códigos de barras o hazle una foto al plato'],
            ['entreno', 'Entrenos', 'Rutinas, series, lo que hiciste la última vez y cuándo subir peso'],
            ['progreso', 'Progreso', 'Media de 7 días, medidas, fotos, hitos y resumen semanal'],
          ]
            .map(([i, t, d]) => `<div class="f-fila"><span class="f-sugerencia__icono">${ic(i, 18)}</span><div><strong style="font-size:14.5px">${t}</strong><p class="f-tenue">${d}</p></div></div>`)
            .join('')}
        </div>
        <button type="button" class="f-boton f-boton--azul f-boton--ancho" data-a="onb-empezar">Empezar · 4 pasos</button>
      </div>`;
    }
    return `<div class="f-vista">${cuerpoPasos(o)}</div>`;
  }

  // Lee lo escrito en el paso actual (sin repintar, para no perder el foco).
  function leerCampo(el) {
    const o = local();
    const v = el.value.trim();
    const n = v === '' ? undefined : Number(v.replace(',', '.'));
    const u = o.p.unidades;
    const k = el.name;
    if (k === 'nacimiento') o.p.nacimiento = v;
    else if (k === 'altura') o.p.altura = n === undefined ? undefined : aCm(n, u);
    else if (k === 'peso' || k === 'pesoObjetivo') o.p[k] = n === undefined ? undefined : aKg(n, u);
    else o.p[k] = n;
  }

  function validar(o) {
    const p = o.p;
    if (o.paso === 0) {
      if (!p.nacimiento || !(p.altura > 100 && p.altura < 250) || !(p.peso > 30 && p.peso < 350)) return 'Revisa la fecha de nacimiento, la altura y el peso.';
      if (p.grasa !== undefined && !(p.grasa > 3 && p.grasa < 70)) return 'El % de grasa debe estar entre 3 y 70 (o déjalo vacío).';
    }
    if (o.paso === 2) {
      if (p.objetivo !== 'mantener' && !(p.pesoObjetivo > 30 && p.pesoObjetivo < 350)) return 'Pon tu peso objetivo.';
      if (p.objetivo === 'perder' && p.pesoObjetivo >= p.peso) return 'Para perder grasa, el peso objetivo debe ser menor que el actual.';
      if (p.objetivo === 'volumen' && p.pesoObjetivo <= p.peso) return 'Para ganar músculo, el peso objetivo debe ser mayor que el actual.';
    }
    return '';
  }

  const acciones = {
    'onb-empezar': () => {
      local().paso = 0;
      ctx.pintar();
    },
    'onb-set': (el) => {
      const o = local();
      const { campo, valor } = el.dataset;
      o.p[campo] = /^\d+$/.test(valor) && campo === 'diasEntreno' ? Number(valor) : valor;
      if (campo === 'objetivo') {
        if (valor === 'recomposicion') o.p.ritmo = 'suave';
        if (valor === 'mantener') o.p.pesoObjetivo = o.p.pesoObjetivo ?? o.p.peso;
      }
      ctx.repintar();
    },
    'onb-atras': () => {
      const o = local();
      if (o.paso === 0 && o.editando) {
        ctx.estado.local.onb = null;
        return ctx.pintar();
      }
      o.paso = Math.max(0, o.paso - 1);
      ctx.pintar();
    },
    'onb-siguiente': () => {
      const o = local();
      const error = validar(o);
      const p = document.querySelector('[data-onb-error]');
      if (error) {
        if (p) {
          p.hidden = false;
          p.textContent = error;
        }
        return;
      }
      if (o.paso < 3) {
        if (o.p.objetivo === 'mantener') o.p.pesoObjetivo = o.p.pesoObjetivo ?? o.p.peso;
        o.paso++;
        return ctx.pintar();
      }
      const perfil = normalizarPerfil({ ...ctx.datos.perfil, ...o.p });
      let datos = guardarPerfil(ctx.datos, perfil, ctx.hoy());
      datos = { ...datos, bloqueados: { ...o.bloqueados } };
      const editando = o.editando;
      ctx.estado.local.onb = null;
      ctx.guardar(datos);
      ctx.tostada(editando ? 'Plan recalculado con tus datos nuevos.' : 'Listo. Este es tu diario: apunta tu primera comida con el +.');
    },
  };

  const entradas = {
    onb: (el) => leerCampo(el),
    'onb-bloq': (el) => {
      const o = local();
      const n = Number(el.value);
      if (el.value === '' || !Number.isFinite(n) || n <= 0) delete o.bloqueados[el.name];
      else o.bloqueados[el.name] = n;
    },
  };

  const cambios = {
    'onb-zona': (el) => {
      local().p.zona = el.value;
    },
  };

  // Abrir el editor del perfil desde Perfil.
  function editar(paso = 0) {
    ctx.estado.local.onb = { paso, p: { ...ctx.datos.perfil }, bloqueados: { ...ctx.datos.bloqueados }, editando: true };
    ctx.pintar();
  }

  return { html, acciones, entradas, cambios, editar, editando: () => Boolean(ctx.estado.local.onb?.editando) };
}
