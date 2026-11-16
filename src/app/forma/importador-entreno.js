// Vista previa de los entrenos de una importación: ejercicios por resolver
// (nunca se crea uno en silencio), ejercicios nuevos, rutinas y sesiones con sus
// series editables, la última vez, récords, volumen, cardio y avisos.
import { GRUPOS, EQUIPOS, TIPOS_CARDIO, TIPOS_SERIE } from '../../compartido/forma/datos.js';
import { detallesSesion } from '../../compartido/forma/importar-entreno.js';
import { textoSeries } from '../../compartido/forma/entreno.js';
import { textoError } from '../../compartido/forma/importar.js';
import { nombreDia, fechaCorta } from '../../compartido/forma/fechas.js';
import { ic, escapar, num } from './ui.js';

const NOMBRE_EQUIPO = Object.fromEntries(EQUIPOS);
const NOMBRE_CARDIO = Object.fromEntries(TIPOS_CARDIO);
const NIVEL = { id: 'por su id', nombre: 'por el nombre', alias: 'por un alias' };
const TIPO_CORTO = { calentamiento: 'Calent.', efectiva: 'Efectiva', dropset: 'Dropset' };

export function crearVistaEntreno(ctx, { plan, repintar, actualizar }) {
  const visibles = () => ctx.datos.ejercicios.filter((e) => !e.oculto);
  const p = () => plan();

  // ---------- Secciones ----------
  function html(r) {
    const e = r.entreno;
    if (!e) return '';
    return `${pendientes(e)}${ejercicios(e)}${rutinas(e)}${sesiones(e)}`;
  }

  // Referencias a ejercicios que no están ni en el JSON ni en tu biblioteca.
  function pendientes(e) {
    const resueltas = Object.entries(p().resoluciones ?? {});
    if (!e.pendientes.length && !resueltas.length) return '';
    const opciones = visibles()
      .slice()
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map((x) => `<option value="${x.id}">${escapar(x.nombre)}</option>`)
      .join('');
    return `<section class="f-columna" style="gap:0"><span class="f-etiqueta">Ejercicios por resolver${e.pendientes.length ? ` <b>${e.pendientes.length}</b>` : ''}</span><div class="f-im-lista">
      ${e.pendientes
        .map(
          (x) => `<div class="f-im f-im--sin-marca"><div class="f-im__cuerpo">
            <div class="f-im__nombre">${escapar(x.ref.nombre || x.ref.id)} <span class="f-im__nuevo f-im__nuevo--aviso">Ejercicio nuevo</span></div>
            <p class="f-im__nota">No está en tu biblioteca. Dime cuál es, o créalo:</p>
            <div class="f-im__asociar">${x.sugerencias.map((s) => `<button type="button" class="f-chip" data-a="ie-asociar" data-ref="${escapar(x.clave)}" data-id="${s.id}">¿Es ${escapar(s.nombre)}?</button>`).join('')}</div>
            <select class="f-entrada" data-cambio="ie-asociar-otro" data-ref="${escapar(x.clave)}" aria-label="Elegir uno de tu biblioteca"><option value="">Elegir otro de tu biblioteca…</option>${opciones}</select>
            <div class="f-im__campos">
              <select class="f-entrada" data-ie-grupo="${escapar(x.clave)}" aria-label="Grupo">${GRUPOS.map((g) => `<option ${g === 'Otro' ? 'selected' : ''}>${g}</option>`).join('')}</select>
              <select class="f-entrada" data-ie-equipo="${escapar(x.clave)}" aria-label="Equipo">${EQUIPOS.map(([k, t]) => `<option value="${k}" ${k === 'otro' ? 'selected' : ''}>${t}</option>`).join('')}</select>
            </div>
            <button type="button" class="f-boton f-boton--chico" data-a="ie-crear" data-ref="${escapar(x.clave)}">${ic('mas', 14)}Crear «${escapar(x.ref.nombre || x.ref.id)}»</button>
          </div></div>`,
        )
        .join('')}
      ${resueltas
        .map(([k, v]) => {
          const ref = e.refs.find((x) => x.clave === k)?.ref;
          if (!ref) return '';
          const destino = v.tipo === 'asociar' ? `tu «${escapar(visibles().find((x) => x.id === v.ejercicioId)?.nombre ?? '?')}» (se guardará como alias)` : `nuevo · ${escapar(v.grupo)} · ${escapar(NOMBRE_EQUIPO[v.equipo] ?? v.equipo)}`;
          return `<div class="f-im f-im--sin-marca"><div class="f-im__cuerpo"><div class="f-im__nombre">${escapar(ref.nombre || ref.id)}</div><p class="f-im__nota">→ ${destino} <button type="button" class="f-enlace" data-a="ie-deshacer" data-ref="${escapar(k)}">Cambiar</button></p></div></div>`;
        })
        .join('')}
    </div></section>`;
  }

  function ejercicios() {
    const lista = p().ejercicios ?? [];
    if (!lista.length) return '';
    return `<section class="f-columna" style="gap:0"><span class="f-etiqueta">Ejercicios · biblioteca</span><div class="f-im-lista">${lista
      .map((x) => {
        const f = x.fuente ?? {};
        const existente = x.existenteId ? visibles().find((y) => y.id === x.existenteId) : null;
        const detalle = [f.grupo, f.equipo && (NOMBRE_EQUIPO[f.equipo] ?? f.equipo), f.unilateral ? 'unilateral' : '', f.principal ? 'principal' : ''].filter(Boolean).join(' · ');
        let caja;
        if (existente && x.nivel) {
          caja = `<div class="f-im__dup"><p><b>Ya lo tienes:</b> ${escapar(existente.nombre)} <span class="f-im__nivel">${NIVEL[x.nivel] ?? ''}</span></p>
            <div class="f-segmento" role="group" aria-label="Qué hago">${[
              ['usar', 'Usar el mío'],
              ['actualizar', 'Actualizarlo'],
              ['crear', 'Crear otro'],
            ]
              .map(([v, t]) => `<button type="button" data-a="ie-decision" data-clave="${x.clave}" data-v="${v}" aria-pressed="${x.decision === v}">${t}</button>`)
              .join('')}</div></div>`;
        } else if (x.sugerencias?.length) {
          const s = x.sugerencias.find((y) => y.id === x.existenteId) ?? x.sugerencias[0];
          caja = `<div class="f-im__dup f-im__dup--sugerencia"><label class="f-im__si"><input type="checkbox" data-cambio="ie-sugerencia" data-clave="${x.clave}" data-id="${s.id}" ${x.decision === 'usar' ? 'checked' : ''}><span>¿Es tu <b>${escapar(s.nombre)}</b>? <span class="f-im__nivel">parecido ${Math.round(s.similitud * 100)}&nbsp;%</span></span></label>
            <p class="f-im__nota">${x.decision === 'usar' ? `Se usará el tuyo y «${escapar(f.nombre)}» quedará como alias.` : 'Se creará como ejercicio nuevo.'}</p></div>`;
        } else caja = '<span class="f-im__nuevo">Nuevo en tu biblioteca</span>';
        return `<div class="f-im" data-im-fila="${x.clave}" ${x.incluir ? '' : 'data-fuera'}>
          <input type="checkbox" class="f-im__marca" data-cambio="im-incluir" data-clave="${x.clave}" ${x.incluir ? 'checked' : ''} aria-label="Importar ${escapar(f.nombre ?? '')}">
          <div class="f-im__cuerpo"><div class="f-im__nombre">${escapar(f.nombre ?? '')}</div>
            ${detalle ? `<div class="f-im__detalle">${escapar(detalle)}</div>` : ''}
            ${f.alias?.length ? `<div class="f-im__detalle">alias: ${escapar(f.alias.join(', '))}</div>` : ''}
            ${x.avisoId ? `<p class="f-im__aviso">${escapar(x.avisoId)}</p>` : ''}
            ${caja}
            <p class="f-error" data-im-err="${x.clave}" hidden></p></div></div>`;
      })
      .join('')}</div></section>`;
  }

  function rutinas() {
    const lista = p().rutinas ?? [];
    if (!lista.length) return '';
    return `<section class="f-columna" style="gap:0"><span class="f-etiqueta">Rutinas</span><div class="f-im-lista">${lista
      .map((x) => {
        const f = x.fuente ?? {};
        const existente = x.existenteId ? ctx.datos.rutinas.find((r) => r.id === x.existenteId) : null;
        return `<div class="f-im" data-im-fila="${x.clave}" ${x.incluir ? '' : 'data-fuera'}>
          <input type="checkbox" class="f-im__marca" data-cambio="im-incluir" data-clave="${x.clave}" ${x.incluir ? 'checked' : ''} aria-label="Importar ${escapar(f.nombre ?? '')}">
          <div class="f-im__cuerpo"><div class="f-im__nombre">${escapar(f.nombre ?? '')}</div>
            <div class="f-im__detalle">${(f.ejercicios ?? []).map((e) => `${e.superserie ? `${escapar(e.superserie)} · ` : ''}${e.series ?? '?'}×${e.reps_min ?? '?'}–${e.reps_max ?? '?'} ${escapar(e.ejercicio || e.ejercicio_id || '')}${e.descanso_s ? ` (${e.descanso_s} s)` : ''}`).join('<br>')}</div>
            ${
              existente
                ? `<div class="f-im__dup"><p><b>Ya la tienes:</b> ${escapar(existente.nombre)}</p><div class="f-segmento" role="group">${[
                    ['actualizar', 'Actualizarla'],
                    ['crear', 'Crear otra'],
                  ]
                    .map(([v, t]) => `<button type="button" data-a="ie-decision" data-clave="${x.clave}" data-v="${v}" aria-pressed="${x.decision === v}">${t}</button>`)
                    .join('')}</div></div>`
                : '<span class="f-im__nuevo">Rutina nueva</span>'
            }
            <p class="f-error" data-im-err="${x.clave}" hidden></p></div></div>`;
      })
      .join('')}</div></section>`;
  }

  function sesiones(e) {
    const lista = p().sesiones ?? [];
    if (!lista.length) return '';
    return lista
      .map((x) => {
        const f = x.fuente ?? {};
        const res = e.sesiones.find((s) => s.clave === x.clave);
        const det = res?.incluir && res.valor ? detallesSesion(ctx.datos, e, res) : null;
        const fecha = res?.valor?.fecha ?? f.fecha ?? ctx.hoy();
        const cab = [`${nombreDia(fecha, ctx.hoy())} · ${fechaCorta(fecha)}`, f.hora_inicio, f.duracion_min && `${f.duracion_min} min`, f.rutina || f.rutina_id].filter(Boolean).join(' · ');
        const avisos = [...e.avisos.filter((a) => a.clave === x.clave).map(textoError), ...(det?.avisos ?? []).map((a) => a.mensaje)];
        const duplicado = x.duplicadoId ? ctx.datos.sesiones.find((s) => s.id === x.duplicadoId) : null;
        return `<section class="f-columna" style="gap:0"><span class="f-etiqueta">Sesión · ${escapar(cab)}</span>
          <div class="f-im-lista"><div class="f-im" data-im-fila="${x.clave}" ${x.incluir ? '' : 'data-fuera'}>
            <input type="checkbox" class="f-im__marca" data-cambio="im-incluir" data-clave="${x.clave}" ${x.incluir ? 'checked' : ''} aria-label="Importar la sesión">
            <div class="f-im__cuerpo">
              ${
                duplicado
                  ? `<div class="f-im__dup f-im__dup--sugerencia"><p><b>Parece que ya la tienes:</b> ${escapar(duplicado.nombre || 'Entreno')} del mismo día (${duplicado.series.length} series). Viene desmarcada para no duplicarla.</p>
                    <div class="f-segmento" role="group" aria-label="Qué hago con la que ya tienes">${[
                      ['fusionar', 'Fusionar'],
                      ['sustituir', 'Sustituir'],
                      ['crear', 'Crear otra'],
                    ]
                      .map(([v, t]) => `<button type="button" data-a="ie-decision" data-clave="${x.clave}" data-v="${v}" aria-pressed="${x.decision === v}">${t}</button>`)
                      .join('')}</div>
                    <p class="f-im__nota">${{ fusionar: 'Añade solo los ejercicios y las series que no estén.', sustituir: 'Borra la que tienes y guarda esta.', crear: 'Para dobles sesiones el mismo día.' }[x.decision] ?? ''}</p></div>`
                  : ''
              }
              ${
                res?.rutina?.tipo === 'pendiente' || (res?.rutina && ['crear', 'ninguna'].includes(res.rutina.tipo))
                  ? `<div class="f-im__dup"><p>La rutina «${escapar(f.rutina || f.rutina_id)}» no existe.</p><div class="f-segmento" role="group">${[
                      ['crear', 'Crearla con esta sesión'],
                      ['ninguna', 'Sin rutina'],
                    ]
                      .map(([v, t]) => `<button type="button" data-a="ie-rutina" data-clave="${x.clave}" data-v="${v}" aria-pressed="${x.rutinaResolucion === v}">${t}</button>`)
                      .join('')}</div></div>`
                  : ''
              }
              ${f.notas ? `<p class="f-im__nota">${escapar(f.notas)}</p>` : ''}
              ${avisos.map((a) => `<p class="f-im__aviso">${escapar(a)}</p>`).join('')}
              <p class="f-error" data-im-err="${x.clave}" hidden></p>
            </div></div></div>
          ${(f.ejercicios ?? []).map((ej, j) => ejercicio(x, ej, j, res, det)).join('')}
          ${cardio(f, det)}
          ${det ? `<p class="f-im-queda" style="margin-top:8px">Volumen: <b>${num(det.volumen)} kg</b>${det.anterior ? ` · la última vez con esta rutina (${escapar(fechaCorta(det.anterior.fecha))}): ${num(det.anterior.volumen)} kg (${det.volumen >= det.anterior.volumen ? '+' : '−'}${num(Math.abs(det.volumen - det.anterior.volumen))})` : ''}</p>` : ''}
        </section>`;
      })
      .join('');
  }

  function ejercicio(x, ej, j, res, det) {
    const d = det?.ejercicios[j];
    const r = res?.ejercicios?.[j];
    const pendiente = r && !r.destino;
    const nombre = d?.nombre || ej.ejercicio || ej.ejercicio_id || `Ejercicio ${j + 1}`;
    const unidad = (s) => (s.duracion_s && !s.reps ? 's' : 'kg');
    return `<div class="f-ie" data-ie="${x.clave}-${j}">
      <div class="f-ie__cab"><b>${ej.superserie ? `${escapar(String(ej.superserie).toUpperCase())} · ` : ''}${escapar(nombre)}</b>
        ${pendiente ? '<span class="f-im__nuevo f-im__nuevo--aviso">por resolver</span>' : ''}
        ${d?.record ? `<span class="f-ie__record">${ic('trofeo', 12)}Récord${d.record.peso && !d.record.e1rm ? ' de peso' : ''}</span>` : ''}
        ${d?.volumen ? `<span class="f-im__detalle">${num(d.volumen)} kg</span>` : ''}</div>
      ${d?.ultima ? `<p class="f-im__nota">Última vez (${escapar(nombreDia(d.ultima.fecha, ctx.hoy()).toLowerCase())}): ${escapar(textoSeries(d.ultima.series))}</p>` : d?.eid ? '<p class="f-im__nota">Primera vez con este ejercicio.</p>' : ''}
      ${ej.notas ? `<p class="f-im__nota" style="font-style:italic">${escapar(ej.notas)}</p>` : ''}
      <div class="f-ie__series">
        <div class="f-ie__fila f-ie__fila--cab"><span>#</span><span>Tipo</span><span>Peso</span><span>Reps</span><span>RIR</span><span>Fallo</span></div>
        ${(ej.series ?? [])
          .map((s, k) => {
            const tipo = TIPOS_SERIE.includes(String(s.tipo ?? 'efectiva').toLowerCase()) ? String(s.tipo ?? 'efectiva').toLowerCase() : 'efectiva';
            const peso = s.peso_kg ?? (s.peso_lb !== undefined ? Math.round(Number(s.peso_lb) * 0.4536 * 4) / 4 : '');
            const attrs = (campo) => `data-entrada="ie-serie" data-cambio="ie-serie" data-clave="${x.clave}" data-j="${j}" data-k="${k}" data-campo="${campo}"`;
            return `<div class="f-ie__fila f-ie__fila--${tipo}" data-ie-serie="${x.clave}-${j}-${k}">
              <span class="f-ie__n">${k + 1}</span>
              <select class="f-entrada" data-cambio="ie-tipo" data-clave="${x.clave}" data-j="${j}" data-k="${k}" aria-label="Tipo de la serie ${k + 1}">${TIPOS_SERIE.map((t) => `<option value="${t}" ${t === tipo ? 'selected' : ''}>${TIPO_CORTO[t]}</option>`).join('')}</select>
              ${
                s.duracion_s && !s.reps
                  ? `<span class="f-ie__iso">${escapar(String(s.duracion_s))} ${unidad(s)}</span>`
                  : `<input class="f-entrada" type="text" inputmode="decimal" autocomplete="off" value="${escapar(String(peso))}" ${attrs('peso_kg')} aria-label="Peso (kg) de la serie ${k + 1}">
                     <input class="f-entrada" type="text" inputmode="numeric" autocomplete="off" value="${escapar(String(s.reps ?? ''))}" ${attrs('reps')} aria-label="Repeticiones de la serie ${k + 1}">`
              }
              <input class="f-entrada" type="text" inputmode="numeric" autocomplete="off" value="${escapar(String(s.fallo ? 0 : (s.rir ?? '')))}" ${attrs('rir')} aria-label="RIR de la serie ${k + 1}" ${s.fallo ? 'disabled' : ''}>
              <input type="checkbox" class="f-ie__fallo" data-cambio="ie-fallo" data-clave="${x.clave}" data-j="${j}" data-k="${k}" ${s.fallo ? 'checked' : ''} aria-label="Al fallo (serie ${k + 1})">
              ${s.lastre_kg ? `<span class="f-ie__extra">+${escapar(String(s.lastre_kg))} kg de lastre</span>` : ''}
            </div>`;
          })
          .join('')}
      </div>
    </div>`;
  }

  function cardio(f, det) {
    const lista = f.cardio ?? [];
    if (!lista.length) return '';
    return `<div class="f-ie"><div class="f-ie__cab"><b>Cardio</b></div>${lista
      .map((c, k) => {
        const kc = det?.cardio[k];
        return `<p class="f-im__nota">${escapar(NOMBRE_CARDIO[c.tipo] ?? c.tipo ?? '')} · ${escapar(String(c.duracion_min ?? '?'))} min${c.velocidad_kmh ? ` · ${num(c.velocidad_kmh, 1)} km/h` : ''}${c.inclinacion_pct ? ` · ${num(c.inclinacion_pct, 1)} %` : ''}${c.intensidad ? ` · ${escapar(c.intensidad)}` : ''}${kc ? ` → <b>${num(kc.kcal)} kcal</b>${kc.estimadas ? ' (estimadas con METs)' : ''}` : ''}</p>`;
      })
      .join('')}<p class="f-im__nota">Se suman a tu gasto de ese día (sin contar dos veces el cardio que ya incluye tu plan).</p></div>`;
  }

  // ---------- Resumen para el pie ----------
  function resumen(r) {
    const e = r.entreno;
    if (!e) return null;
    const sesionesIn = e.sesiones.filter((s) => s.incluir && s.valor);
    const series = sesionesIn.reduce((t, s) => t + s.ejercicios.reduce((u, x) => u + x.series.length, 0), 0);
    const faltan = e.pendientes.length + e.rutinasPendientes.length;
    return { elementos: e.defs.length + e.rutinas.length + sesionesIn.length, sesiones: sesionesIn.length, series, faltan };
  }

  // ---------- Acciones ----------
  const buscarSesion = (clave) => (p().sesiones ?? []).find((s) => s.clave === clave);
  const buscarCualquiera = (clave) => [...(p().ejercicios ?? []), ...(p().rutinas ?? []), ...(p().sesiones ?? [])].find((x) => x.clave === clave);
  const serieDe = (el) => buscarSesion(el.dataset.clave)?.fuente?.ejercicios?.[Number(el.dataset.j)]?.series?.[Number(el.dataset.k)];

  const acciones = {
    'ie-asociar': (el) => {
      p().resoluciones[el.dataset.ref] = { tipo: 'asociar', ejercicioId: el.dataset.id };
      repintar();
    },
    'ie-crear': (el) => {
      const raiz = el.closest('.f-im__cuerpo');
      const grupo = raiz.querySelector('[data-ie-grupo]')?.value ?? 'Otro';
      const equipo = raiz.querySelector('[data-ie-equipo]')?.value ?? 'otro';
      p().resoluciones[el.dataset.ref] = { tipo: 'crear', grupo, equipo };
      repintar();
    },
    'ie-deshacer': (el) => {
      delete p().resoluciones[el.dataset.ref];
      repintar();
    },
    'ie-decision': (el) => {
      const x = buscarCualquiera(el.dataset.clave);
      if (!x) return;
      x.decision = el.dataset.v;
      repintar();
    },
    'ie-rutina': (el) => {
      const x = buscarSesion(el.dataset.clave);
      if (!x) return;
      x.rutinaResolucion = el.dataset.v;
      repintar();
    },
  };

  const cambios = {
    'ie-asociar-otro': (el) => {
      if (!el.value) return;
      p().resoluciones[el.dataset.ref] = { tipo: 'asociar', ejercicioId: el.value };
      repintar();
    },
    'ie-sugerencia': (el) => {
      const x = buscarCualquiera(el.dataset.clave);
      if (!x) return;
      Object.assign(x, el.checked ? { decision: 'usar', existenteId: el.dataset.id, nivel: null } : { decision: 'crear' });
      repintar();
    },
    'ie-tipo': (el) => {
      const s = serieDe(el);
      if (!s) return;
      s.tipo = el.value;
      repintar();
    },
    'ie-fallo': (el) => {
      const s = serieDe(el);
      if (!s) return;
      s.fallo = el.checked;
      repintar();
    },
    // Al salir de un campo de la serie se repinta (récords, volumen, avisos), salvo
    // si saltas a otro campo: así no pierdes el foco mientras corriges varias series.
    'ie-serie': () =>
      setTimeout(() => {
        if (!document.activeElement?.matches?.('.f-hoja input, .f-hoja select')) repintar();
      }, 0),
  };

  const entradas = {
    'ie-serie': (el) => {
      const s = serieDe(el);
      if (!s) return;
      const v = el.value.trim().replace(',', '.');
      const campo = el.dataset.campo;
      if (campo === 'peso_kg') delete s.peso_lb;
      if (v === '') delete s[campo];
      else s[campo] = Number.isFinite(Number(v)) ? Number(v) : v;
      actualizar();
    },
  };

  return { html, resumen, acciones, cambios, entradas };
}
