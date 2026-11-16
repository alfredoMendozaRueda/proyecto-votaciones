// Editar un entreno ya hecho (o importado): fecha, hora, duración, notas, cada
// serie (tipo, peso, lastre, reps, RIR, fallo), añadir o quitar series y
// ejercicios, el cardio y si un ejercicio se apunta con el peso por lado.
// Se trabaja sobre una copia y se guarda de una vez (con Deshacer).
import { id as nuevoId, TIPOS_SERIE, TIPOS_CARDIO, ejercicio } from '../../compartido/forma/datos.js';
import { volumenSerie, kcalDeCardio, ejerciciosDeSesion } from '../../compartido/forma/entreno.js';
import { pesoDeReferencia } from '../../compartido/forma/progreso.js';
import { nombreDia, fechaLarga } from '../../compartido/forma/fechas.js';
import { ic, escapar, num } from './ui.js';

const TIPO_CORTO = { calentamiento: 'Calent.', efectiva: 'Efectiva', dropset: 'Dropset' };
const dosCifras = (n) => String(n).padStart(2, '0');
const horaDe = (ms) => {
  const d = new Date(ms);
  return `${dosCifras(d.getHours())}:${dosCifras(d.getMinutes())}`;
};

export function crearEditorSesion(ctx) {
  let ed = null; // { hoja, s (copia), unilateral: Map, original }

  function abrir(sid) {
    const s = ctx.datos.sesiones.find((x) => x.id === sid);
    if (!s) return;
    const copia = structuredClone(s);
    // El orden de los ejercicios queda guardado en la copia (los que solo están en las series, al final).
    copia.ejercicios = ejerciciosDeSesion(copia).map((eid) => copia.ejercicios?.find((e) => e.ejercicioId === eid) ?? { ejercicioId: eid });
    ed = { s: copia, original: s, unilateral: new Map(), errores: [] };
    ed.hoja = ctx.hojas.abrir('', { clase: 'f-hoja--alta', titulo: 'Editar entreno', alCerrar: () => (ed = null) });
    pintar();
  }

  // Elegir entre los entrenos de un día (o abrir el único).
  function abrirDia(fecha) {
    const del = ctx.datos.sesiones.filter((x) => x.fecha === fecha);
    if (!del.length) return ctx.tostada(`El ${nombreDia(fecha, ctx.hoy()).toLowerCase()} no entrenaste.`);
    if (del.length === 1) return abrir(del[0].id);
    ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>${escapar(fechaLarga(fecha))}</h2></div>
       <div class="f-lista">${del.map((x) => `<button type="button" class="f-item" data-a="es-abrir" data-id="${x.id}"><span class="f-item__texto"><span class="f-item__nombre">${escapar(x.nombre || 'Entreno')}</span><span class="f-item__detalle">${x.inicio ? horaDe(x.inicio) : ''} · ${x.series.length} series</span></span>${ic('lapiz', 15)}</button>`).join('')}</div>`,
      { titulo: 'Entrenos del día' },
    );
  }

  const unilateralDe = (eid) => (ed.unilateral.has(eid) ? ed.unilateral.get(eid) : ejercicio(ctx.datos, eid).unilateral);
  const volumen = () => Math.round(ed.s.series.reduce((t, x) => t + volumenSerie(x, { unilateral: unilateralDe(x.ejercicioId) }), 0));

  function pintar() {
    if (!ed) return;
    const s = ed.s;
    const arriba = ed.hoja.cuerpo.scrollTop;
    const duracion = s.inicio && s.fin ? Math.round((s.fin - s.inicio) / 60000) : '';
    const opciones = ctx.datos.ejercicios
      .filter((e) => !e.oculto)
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((e) => `<option value="${e.id}">${escapar(e.nombre)}</option>`)
      .join('');
    ed.hoja.cuerpo.innerHTML = `<div class="f-hoja__titulo"><h2>Editar entreno</h2></div>
      <div class="f-rejilla-2">
        <label class="f-campo"><span>Nombre</span><input class="f-entrada" value="${escapar(s.nombre ?? '')}" data-entrada="es-campo" data-k="nombre" maxlength="80"></label>
        <label class="f-campo"><span>Fecha</span><input class="f-entrada" type="date" value="${s.fecha}" max="${ctx.hoy()}" data-cambio="es-fecha"></label>
        <label class="f-campo"><span>Empezó a las</span><input class="f-entrada" type="time" value="${s.inicio ? horaDe(s.inicio) : ''}" data-cambio="es-hora"></label>
        <label class="f-campo"><span>Duración</span><div class="f-con-unidad" data-unidad="min"><input class="f-entrada" type="text" inputmode="numeric" value="${duracion}" data-cambio="es-duracion"></div></label>
      </div>
      <label class="f-campo"><span>Notas</span><textarea class="f-entrada" rows="2" data-entrada="es-campo" data-k="notas">${escapar(s.notas ?? '')}</textarea></label>
      ${s.ejercicios.map((m, j) => bloqueEjercicio(m, j)).join('')}
      <div class="f-fila"><select class="f-entrada" data-cambio="es-anadir-ejercicio" aria-label="Añadir ejercicio" style="flex:1"><option value="">Añadir ejercicio…</option>${opciones}</select></div>
      <section class="f-ie"><div class="f-ie__cab"><b>Cardio</b></div>
        ${s.cardio.map((c, k) => filaCardio(c, k)).join('')}
        <button type="button" class="f-boton f-boton--chico" data-a="es-cardio-mas">${ic('mas', 14)}Añadir cardio</button>
      </section>
      <p class="f-error" data-es-error ${ed.errores.length ? '' : 'hidden'}>${escapar(ed.errores.join(' · '))}</p>
      <div class="f-pie-fijo f-im-pie">
        <span class="f-im-total">Volumen <b data-es-volumen>${num(volumen())} kg</b></span>
        <button type="button" class="f-boton f-boton--peligro" data-a="es-borrar" aria-label="Borrar este entreno">${ic('basura', 15)}</button>
        <button type="button" class="f-boton f-boton--azul" data-a="es-guardar">${ic('check', 16)}Guardar</button>
      </div>`;
    ed.hoja.cuerpo.scrollTop = arriba;
  }

  function bloqueEjercicio(m, j) {
    const eid = m.ejercicioId;
    const e = ejercicio(ctx.datos, eid);
    const series = ed.s.series.map((x, i) => ({ x, i })).filter(({ x }) => x.ejercicioId === eid);
    const uni = unilateralDe(eid);
    const volEj = Math.round(series.reduce((t, { x }) => t + volumenSerie(x, { unilateral: uni }), 0));
    return `<section class="f-ie">
      <div class="f-ie__cab"><b>${escapar(e.nombre)}</b><span class="f-im__detalle" data-es-vol="${eid}">${num(volEj)} kg</span>
        <button type="button" class="f-icono-boton" data-a="es-quitar-ejercicio" data-j="${j}" aria-label="Quitar ${escapar(e.nombre)}">${ic('basura', 14)}</button></div>
      <label class="f-interruptor"><input type="checkbox" data-cambio="es-unilateral" data-id="${eid}" ${uni ? 'checked' : ''}><span>Peso por lado <small>${uni ? 'El peso que apuntas es de cada lado: el volumen cuenta los dos.' : 'Márcalo si apuntas el peso de un solo lado (máquinas de discos, mancuernas, poleas a una mano).'} Afecta a todas tus sesiones de este ejercicio.</small></span></label>
      <div class="f-ie__series">
        <div class="f-ie__fila f-ie__fila--cab f-ie__fila--editar"><span>#</span><span>Tipo</span><span>Kg${uni ? '/lado' : ''}</span><span>Reps</span><span>RIR</span><span>Fallo</span><span></span></div>
        ${series
          .map(({ x, i }, n) => {
            const tipo = x.tipo ?? (x.calentamiento ? 'calentamiento' : 'efectiva');
            const at = (k) => `data-entrada="es-serie" data-i="${i}" data-k="${k}"`;
            return `<div class="f-ie__fila f-ie__fila--editar f-ie__fila--${tipo}">
              <span class="f-ie__n">${n + 1}</span>
              <select class="f-entrada" data-cambio="es-tipo" data-i="${i}" aria-label="Tipo">${TIPOS_SERIE.map((t) => `<option value="${t}" ${t === tipo ? 'selected' : ''}>${TIPO_CORTO[t]}</option>`).join('')}</select>
              <input class="f-entrada" type="text" inputmode="decimal" autocomplete="off" value="${x.kg ?? ''}" ${at('kg')} aria-label="Kilos">
              <input class="f-entrada" type="text" inputmode="numeric" autocomplete="off" value="${x.segundos && !x.reps ? '' : (x.reps ?? '')}" placeholder="${x.segundos && !x.reps ? `${x.segundos}s` : ''}" ${at('reps')} aria-label="Repeticiones">
              <input class="f-entrada" type="text" inputmode="numeric" autocomplete="off" value="${x.fallo ? 0 : (x.rir ?? '')}" ${at('rir')} ${x.fallo ? 'disabled' : ''} aria-label="RIR">
              <input type="checkbox" class="f-ie__fallo" data-cambio="es-fallo" data-i="${i}" ${x.fallo ? 'checked' : ''} aria-label="Al fallo">
              <button type="button" class="f-ie__quitar" data-a="es-quitar-serie" data-i="${i}" aria-label="Quitar la serie">${ic('cerrar', 13)}</button>
              ${x.lastre ? `<span class="f-ie__extra">+${num(x.lastre, 2)} kg de lastre</span>` : ''}
            </div>`;
          })
          .join('')}
      </div>
      <button type="button" class="f-boton f-boton--chico" data-a="es-serie-mas" data-id="${eid}">${ic('mas', 14)}Serie</button>
      <label class="f-campo"><span>Notas del ejercicio</span><input class="f-entrada" value="${escapar(m.notas ?? '')}" data-entrada="es-nota-ej" data-j="${j}"></label>
    </section>`;
  }

  function filaCardio(c, k) {
    return `<div class="f-rejilla-2 f-es-cardio">
      <label class="f-campo"><span>Tipo</span><select class="f-entrada" data-cambio="es-cardio" data-k="${k}" data-c="tipo">${TIPOS_CARDIO.map(([v, t]) => `<option value="${v}" ${v === c.tipo ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="f-campo"><span>Minutos</span><input class="f-entrada" type="text" inputmode="numeric" value="${c.minutos ?? ''}" data-cambio="es-cardio" data-k="${k}" data-c="minutos"></label>
      <label class="f-campo"><span>Km/h (opc.)</span><input class="f-entrada" type="text" inputmode="decimal" value="${c.velocidad ?? ''}" data-cambio="es-cardio" data-k="${k}" data-c="velocidad"></label>
      <label class="f-campo"><span>Inclinación % (opc.)</span><input class="f-entrada" type="text" inputmode="decimal" value="${c.inclinacion ?? ''}" data-cambio="es-cardio" data-k="${k}" data-c="inclinacion"></label>
      <label class="f-campo"><span>Intensidad</span><select class="f-entrada" data-cambio="es-cardio" data-k="${k}" data-c="intensidad">${['baja', 'media', 'alta'].map((v) => `<option ${v === c.intensidad ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label class="f-campo"><span>Kcal</span><input class="f-entrada" type="text" inputmode="numeric" value="${c.kcal ?? ''}" data-cambio="es-cardio" data-k="${k}" data-c="kcal"></label>
      <div class="f-fila" style="grid-column:1/-1"><button type="button" class="f-enlace" data-a="es-cardio-kcal" data-k="${k}">Recalcular kcal</button><button type="button" class="f-enlace" style="margin-left:auto;color:#ff9a9a" data-a="es-cardio-quitar" data-k="${k}">Quitar</button></div>
    </div>`;
  }

  // Número de un campo (coma o punto); undefined si está vacío; NaN si no vale.
  const leer = (v) => {
    const t = String(v ?? '').trim().replace(',', '.');
    if (t === '') return undefined;
    const n = Number(t);
    return Number.isFinite(n) ? n : NaN;
  };

  function actualizarVolumen() {
    const c = ed?.hoja.cuerpo;
    if (!c) return;
    c.querySelector('[data-es-volumen]').textContent = `${num(volumen())} kg`;
    for (const el of c.querySelectorAll('[data-es-vol]')) {
      const eid = el.dataset.esVol;
      el.textContent = `${num(Math.round(ed.s.series.filter((x) => x.ejercicioId === eid).reduce((t, x) => t + volumenSerie(x, { unilateral: unilateralDe(eid) }), 0)))} kg`;
    }
  }

  // Comprueba todo antes de guardar: cada serie con su número.
  function validar() {
    const errores = [];
    const s = ed.s;
    s.ejercicios.forEach((m) => {
      const nombre = ejercicio(ctx.datos, m.ejercicioId).nombre;
      s.series
        .filter((x) => x.ejercicioId === m.ejercicioId)
        .forEach((x, n) => {
          const d = `${nombre} › serie ${n + 1}`;
          if (!(x.kg >= 0 && x.kg <= 500)) errores.push(`${d}: el peso debe estar entre 0 y 500`);
          if (!x.segundos && !(Number.isInteger(x.reps) && x.reps >= 1 && x.reps <= 100)) errores.push(`${d}: las reps deben ser un entero entre 1 y 100`);
          if (x.rir !== undefined && !(Number.isInteger(x.rir) && x.rir >= 0 && x.rir <= 5)) errores.push(`${d}: el RIR va de 0 a 5`);
        });
    });
    s.cardio.forEach((c, k) => {
      if (!(Number.isInteger(c.minutos) && c.minutos >= 1 && c.minutos <= 300)) errores.push(`Cardio ${k + 1}: los minutos van de 1 a 300`);
    });
    if (!s.series.length && !s.cardio.length) errores.push('El entreno se ha quedado vacío: bórralo si no lo quieres.');
    return errores;
  }

  function guardar() {
    ed.errores = validar();
    if (ed.errores.length) {
      pintar();
      ed.hoja.cuerpo.querySelector('[data-es-error]')?.scrollIntoView({ block: 'center' });
      return;
    }
    const antes = ctx.datos;
    const s = ed.s;
    const ejercicios = antes.ejercicios.map((e) => (ed.unilateral.has(e.id) ? { ...e, unilateral: ed.unilateral.get(e.id) } : e));
    const sesiones = antes.sesiones.map((x) => (x.id === s.id ? { ...s, series: s.series.map((y) => ({ ...y, calentamiento: y.tipo === 'calentamiento' })) } : x));
    const cambiaron = ed.unilateral.size;
    ctx.guardar({ ...antes, ejercicios, sesiones }, { pintar: false });
    ctx.hojas.cerrarTodas();
    ctx.repintar();
    ctx.tostada(`Entreno guardado${cambiaron ? ' · «peso por lado» actualizado' : ''}`, { accion: () => ctx.guardar(antes), ms: 6000 });
  }

  const serie = (el) => ed?.s.series[Number(el.dataset.i)];

  const acciones = {
    'es-abrir': (el) => {
      ctx.hojas.cerrar();
      abrir(el.dataset.id);
    },
    'dia-entreno': (el) => abrirDia(el.dataset.fecha),
    'es-guardar': () => guardar(),
    'es-borrar': (el) => {
      if (!el.dataset.seguro) {
        el.dataset.seguro = '1';
        el.innerHTML = `${ic('basura', 15)}¿Seguro?`;
        return;
      }
      const antes = ctx.datos;
      ctx.guardar({ ...antes, sesiones: antes.sesiones.filter((x) => x.id !== ed.s.id) }, { pintar: false });
      ctx.hojas.cerrarTodas();
      ctx.repintar();
      ctx.tostada('Entreno borrado', { accion: () => ctx.guardar(antes) });
    },
    'es-serie-mas': (el) => {
      const eid = el.dataset.id;
      const del = ed.s.series.filter((x) => x.ejercicioId === eid);
      const ultima = del.at(-1);
      const nueva = { id: nuevoId('k'), ejercicioId: eid, tipo: 'efectiva', calentamiento: false, kg: ultima?.kg ?? 0, reps: ultima?.reps ?? 0, fallo: false, hecha: true };
      const pos = ed.s.series.lastIndexOf(ultima);
      ed.s.series.splice(pos < 0 ? ed.s.series.length : pos + 1, 0, nueva);
      pintar();
    },
    'es-quitar-serie': (el) => {
      ed.s.series.splice(Number(el.dataset.i), 1);
      pintar();
    },
    'es-quitar-ejercicio': (el) => {
      const m = ed.s.ejercicios[Number(el.dataset.j)];
      ed.s.ejercicios.splice(Number(el.dataset.j), 1);
      ed.s.series = ed.s.series.filter((x) => x.ejercicioId !== m.ejercicioId);
      pintar();
    },
    'es-cardio-mas': () => {
      const peso = pesoDeReferencia(ctx.datos, ed.s.fecha) ?? ctx.datos.perfil?.peso ?? 75;
      const c = { id: nuevoId('c'), tipo: 'cinta', minutos: 20, intensidad: 'media' };
      ed.s.cardio.push({ ...c, kcal: kcalDeCardio(c, peso) });
      pintar();
    },
    'es-cardio-quitar': (el) => {
      ed.s.cardio.splice(Number(el.dataset.k), 1);
      pintar();
    },
    'es-cardio-kcal': (el) => {
      const c = ed.s.cardio[Number(el.dataset.k)];
      const peso = pesoDeReferencia(ctx.datos, ed.s.fecha) ?? ctx.datos.perfil?.peso ?? 75;
      c.kcal = kcalDeCardio(c, peso);
      pintar();
    },
  };

  const entradas = {
    'es-campo': (el) => {
      ed.s[el.dataset.k] = el.value;
    },
    'es-nota-ej': (el) => {
      const m = ed.s.ejercicios[Number(el.dataset.j)];
      if (el.value.trim()) m.notas = el.value;
      else delete m.notas;
    },
    'es-serie': (el) => {
      const x = serie(el);
      if (!x) return;
      const v = leer(el.value);
      const k = el.dataset.k;
      if (v === undefined) {
        if (k === 'rir') delete x.rir;
        else x[k] = 0;
      } else x[k] = v;
      actualizarVolumen();
    },
  };

  const cambios = {
    'es-tipo': (el) => {
      const x = serie(el);
      if (!x) return;
      x.tipo = el.value;
      x.calentamiento = el.value === 'calentamiento';
      pintar();
    },
    'es-fallo': (el) => {
      const x = serie(el);
      if (!x) return;
      x.fallo = el.checked;
      if (el.checked) x.rir = 0;
      pintar();
    },
    'es-unilateral': (el) => {
      ed.unilateral.set(el.dataset.id, el.checked);
      pintar();
    },
    'es-fecha': (el) => {
      if (!el.value) return;
      const dif = new Date(`${el.value}T12:00:00`) - new Date(`${ed.s.fecha}T12:00:00`);
      ed.s.fecha = el.value > ctx.hoy() ? ctx.hoy() : el.value;
      if (ed.s.inicio) ed.s.inicio += dif;
      if (ed.s.fin) ed.s.fin += dif;
    },
    'es-hora': (el) => {
      const dur = ed.s.inicio && ed.s.fin ? ed.s.fin - ed.s.inicio : null;
      if (!el.value) {
        delete ed.s.inicio;
        delete ed.s.fin;
        return;
      }
      ed.s.inicio = new Date(`${ed.s.fecha}T${el.value}:00`).getTime();
      if (dur) ed.s.fin = ed.s.inicio + dur;
    },
    'es-duracion': (el) => {
      const m = leer(el.value);
      if (m === undefined) return void delete ed.s.fin;
      if (!(m >= 1 && m <= 300)) return;
      if (!ed.s.inicio) ed.s.inicio = new Date(`${ed.s.fecha}T18:00:00`).getTime();
      ed.s.fin = ed.s.inicio + Math.round(m) * 60000;
    },
    'es-anadir-ejercicio': (el) => {
      const eid = el.value;
      if (!eid) return;
      if (!ed.s.ejercicios.some((m) => m.ejercicioId === eid)) ed.s.ejercicios.push({ ejercicioId: eid });
      ed.s.series.push({ id: nuevoId('k'), ejercicioId: eid, tipo: 'efectiva', calentamiento: false, kg: 0, reps: 0, fallo: false, hecha: true });
      pintar();
    },
    'es-cardio': (el) => {
      const c = ed.s.cardio[Number(el.dataset.k)];
      if (!c) return;
      const k = el.dataset.c;
      if (['tipo', 'intensidad'].includes(k)) c[k] = el.value;
      else {
        const v = leer(el.value);
        if (v === undefined) delete c[k];
        else if (!Number.isNaN(v)) c[k] = k === 'minutos' || k === 'kcal' ? Math.round(v) : v;
      }
    },
  };

  return { abrir, abrirDia, acciones, entradas, cambios, formularios: {} };
}
