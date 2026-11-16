// Importar desde JSON: pegas lo que te ha preparado una IA, revisas una vista
// previa (marcas, cantidades y comidas editables, duplicados) e importas de una
// vez. Nada se guarda hasta pulsar «Importar», y se puede deshacer.
import { leerImportacion, resolverPlan, totalesPorDia, formatoParaIA, textoError, ErrorImportacion } from '../../compartido/forma/importar.js';
import { resumenDia } from '../../compartido/forma/diario.js';
import { minutosDe, nombreDia, fechaCorta } from '../../compartido/forma/fechas.js';
import { ic, escapar, num } from './ui.js';

const macros = (n) => `${num(n.kcal ?? 0)} kcal · P ${num(n.proteina ?? 0, 1)} · H ${num(n.hidratos ?? 0, 1)} · G ${num(n.grasa ?? 0, 1)}`;
const listaErrores = (errores, max = 12) =>
  errores.length ? `<ul class="f-im-errores" role="alert">${errores.slice(0, max).map((e) => `<li>${escapar(typeof e === 'string' ? e : textoError(e))}</li>`).join('')}${errores.length > max ? `<li>… y ${errores.length - max} más</li>` : ''}</ul>` : '';

export function crearImportador(ctx) {
  let im = null; // { hoja, texto, plan }

  const opciones = () => ({ hoy: ctx.hoy(), ahoraMin: minutosDe(new Date()) });

  function abrir({ texto = '' } = {}) {
    im = { texto, plan: null };
    im.hoja = ctx.hojas.abrir('', { clase: 'f-hoja--alta', titulo: 'Importar', alCerrar: () => (im = null) });
    pintarPegar();
  }

  // ---------- Paso 1: pegar ----------
  function pintarPegar(errores = []) {
    im.plan = null;
    im.hoja.cuerpo.innerHTML = `<div class="f-hoja__titulo"><h2>Importar</h2></div>
      <p class="f-explica">Pega el JSON que te ha preparado una IA (Claude, ChatGPT…) con alimentos, comidas o las dos cosas. Puede venir dentro de un bloque <code>\`\`\`json</code> o con texto alrededor.</p>
      <div class="f-rejilla-2">
        <button type="button" class="f-boton" data-a="im-pegar">${ic('importar', 16)}Pegar del portapapeles</button>
        <button type="button" class="f-boton" data-a="im-formato">${ic('copiar', 16)}Copiar formato para la IA</button>
      </div>
      <form class="f-columna" data-form="im-leer">
        <textarea class="f-entrada f-im-texto" name="texto" data-entrada="im-texto" spellcheck="false" autocapitalize="off" autocomplete="off" autocorrect="off" placeholder='{ "forma_import": 1, "alimentos": [ … ], "registros": [ … ] }' aria-label="JSON para importar">${escapar(im.texto)}</textarea>
        <div data-im-errores>${listaErrores(errores)}</div>
        <button type="submit" class="f-boton f-boton--azul f-boton--ancho" ${im.texto.trim() ? '' : 'disabled'} data-im-revisar>Revisar antes de importar</button>
      </form>
      <ol class="f-im-pasos">
        <li>Toca <b>Copiar formato para la IA</b> y pégaselo al asistente junto con lo que has comido o las fotos de las etiquetas.</li>
        <li>Copia su respuesta y pégala aquí.</li>
        <li>Revisa la vista previa: nada se guarda hasta que pulses <b>Importar</b>.</li>
      </ol>`;
  }

  function revisar() {
    try {
      im.plan = leerImportacion(ctx.datos, im.texto, opciones());
    } catch (error) {
      const errores = error instanceof ErrorImportacion ? error.errores : [{ mensaje: error.message }];
      const caja = im.hoja.cuerpo.querySelector('[data-im-errores]');
      if (caja) caja.innerHTML = listaErrores(errores);
      return;
    }
    pintarRevision();
    im.hoja.cuerpo.scrollTop = 0;
  }

  // ---------- Paso 2: vista previa ----------
  function filaAlimento(x) {
    const a = x.alimento;
    const u = a.unidad;
    const existente = x.existenteId ? ctx.datos.alimentos.find((e) => e.id === x.existenteId) : null;
    const avisos = (im.plan.avisos ?? []).filter((v) => v.clave === x.clave);
    return `<div class="f-im" data-im-fila="${x.clave}" ${x.incluir ? '' : 'data-fuera'}>
      <input type="checkbox" class="f-im__marca" data-cambio="im-incluir" data-clave="${x.clave}" ${x.incluir ? 'checked' : ''} aria-label="Importar ${escapar(a.nombre)}">
      <div class="f-im__cuerpo">
        <div class="f-im__nombre">${escapar(a.nombre)}${a.marca ? ` <small>${escapar(a.marca)}</small>` : ''}</div>
        <div class="f-im__detalle">Por 100 ${u} · ${macros(a.por100)}</div>
        <label class="f-im__campo"><span>Ración habitual</span><span class="f-con-unidad" data-unidad="${u}"><input class="f-entrada" type="text" inputmode="decimal" autocomplete="off" value="${a.racion}" data-entrada="im-racion" data-clave="${x.clave}" aria-label="Ración habitual"></span></label>
        ${avisos.map((v) => `<p class="f-im__aviso">${escapar(v.mensaje)}</p>`).join('')}
        ${
          existente
            ? `<div class="f-im__dup">
                <p>${x.iguales ? 'Ya lo tienes en Mis alimentos, con los mismos valores.' : `Ya lo tienes en Mis alimentos con otros valores: ${macros(existente.por100)} por 100 ${existente.unidad ?? 'g'}${existente.unidad !== u ? ' (otra unidad)' : ''}.`}</p>
                <div class="f-segmento" role="group" aria-label="Qué hago con el que ya tienes">
                  ${[
                    ['usar', 'Usar el mío'],
                    ['actualizar', 'Actualizarlo'],
                    ['crear', 'Crear otro'],
                  ]
                    .map(([v, t]) => `<button type="button" data-a="im-decision" data-clave="${x.clave}" data-v="${v}" aria-pressed="${x.decision === v}">${t}</button>`)
                    .join('')}
                </div>
              </div>`
            : '<span class="f-im__nuevo">Nuevo en Mis alimentos</span>'
        }
        <p class="f-error" data-im-err="${x.clave}" hidden></p>
      </div>
    </div>`;
  }

  function filaRegistro(x) {
    const unidad = unidadRegistro(x);
    return `<div class="f-im" data-im-fila="${x.clave}" ${x.incluir ? '' : 'data-fuera'}>
      <input type="checkbox" class="f-im__marca" data-cambio="im-incluir" data-clave="${x.clave}" ${x.incluir ? 'checked' : ''} aria-label="Importar ${escapar(x.alimento)}">
      <div class="f-im__cuerpo">
        <div class="f-im__nombre">${escapar(x.alimento)}${x.marca ? ` <small>${escapar(x.marca)}</small>` : ''}</div>
        <div class="f-im__campos">
          <span class="f-con-unidad" data-unidad="${unidad}" data-im-unidad="${x.clave}"><input class="f-entrada" type="text" inputmode="decimal" autocomplete="off" value="${x.cantidad}" data-entrada="im-cantidad" data-clave="${x.clave}" aria-label="Cantidad"></span>
          <select class="f-entrada" data-cambio="im-momento" data-clave="${x.clave}" aria-label="Comida">${ctx.datos.momentos.map((m) => `<option value="${m.id}" ${m.id === x.momento ? 'selected' : ''}>${escapar(m.nombre)}</option>`).join('')}</select>
        </div>
        <div class="f-im__detalle" data-im-n="${x.clave}"></div>
        ${x.avisoMomento ? `<p class="f-im__aviso" data-im-aviso-momento>${escapar(x.avisoMomento)}</p>` : ''}
        ${(im.plan.avisos ?? [])
          .filter((v) => v.clave === x.clave)
          .map((v) => `<p class="f-im__aviso">${escapar(`${v.campo}: ${v.mensaje}`)}</p>`)
          .join('')}
        <p class="f-error" data-im-err="${x.clave}" hidden></p>
      </div>
    </div>`;
  }

  // La unidad del alimento al que apunta el registro (del JSON o de los tuyos).
  function unidadRegistro(x) {
    const r = im.resuelto?.registros.find((y) => y.clave === x.clave);
    if (r) return r.unidad;
    const delJSON = im.plan.alimentos.find((a) => a.alimento.nombre.toLowerCase() === x.alimento.toLowerCase());
    return delJSON?.alimento.unidad ?? ctx.datos.alimentos.find((a) => a.nombre.toLowerCase() === x.alimento.toLowerCase())?.unidad ?? 'g';
  }

  function pintarRevision() {
    const p = im.plan;
    im.resuelto = resolverPlan(ctx.datos, p, opciones());
    const dias = [...new Set(p.registros.map((r) => r.fecha))].sort();
    const generales = (p.avisos ?? []).filter((v) => !v.clave);
    im.hoja.cuerpo.innerHTML = `<div class="f-hoja__titulo"><h2>Revisar</h2><button type="button" class="f-boton f-boton--chico" data-a="im-volver">${ic('atras', 14)}Cambiar texto</button></div>
      <p class="f-tenue">${[p.alimentos.length ? `${p.alimentos.length} ${p.alimentos.length === 1 ? 'alimento' : 'alimentos'}` : '', p.registros.length ? `${p.registros.length} ${p.registros.length === 1 ? 'comida' : 'comidas'}` : ''].filter(Boolean).join(' y ')}. Desmarca lo que no quieras y ajusta cantidades o comidas: los valores se recalculan al momento.</p>
      ${generales.length ? `<ul class="f-im-avisos">${generales.map((v) => `<li>${escapar(textoError(v))}</li>`).join('')}</ul>` : ''}
      <div data-im-errores></div>
      ${
        p.alimentos.length
          ? `<section class="f-columna" style="gap:0"><span class="f-etiqueta">Alimentos · Mis alimentos</span><div class="f-im-lista">${p.alimentos.map(filaAlimento).join('')}</div></section>`
          : ''
      }
      ${dias
        .map(
          (f) => `<section class="f-columna" style="gap:0">
            <div class="f-im-dia"><span class="f-etiqueta">${escapar(nombreDia(f, ctx.hoy()))} · ${escapar(fechaCorta(f))}</span><b data-im-dia="${f}"></b></div>
            <p class="f-im-queda" data-im-queda="${f}"></p>
            <div class="f-im-lista">${p.registros
              .filter((r) => r.fecha === f)
              .map(filaRegistro)
              .join('')}</div>
          </section>`,
        )
        .join('')}
      <div class="f-pie-fijo f-im-pie">
        <span class="f-im-total" data-im-total></span>
        <button type="button" class="f-boton f-boton--azul" data-a="im-importar" data-im-boton>${ic('check', 16)}Importar</button>
      </div>`;
    actualizar();
  }

  // Recalcula sin repintar (para no perder el foco al escribir).
  function actualizar() {
    const c = im.hoja.cuerpo;
    let r;
    try {
      r = resolverPlan(ctx.datos, im.plan, opciones());
    } catch (error) {
      r = { alimentos: [], registros: [], errores: [{ mensaje: error.message }] };
    }
    im.resuelto = r;
    for (const x of im.plan.registros) {
      const caja = c.querySelector(`[data-im-n="${x.clave}"]`);
      const res = r.registros.find((y) => y.clave === x.clave);
      if (caja) caja.textContent = !x.incluir ? 'No se importa' : res ? macros(res.nutrientes) : '';
      const u = c.querySelector(`[data-im-unidad="${x.clave}"]`);
      if (u && res) u.dataset.unidad = res.unidad;
    }
    for (const fila of c.querySelectorAll('[data-im-err]')) {
      const propios = r.errores.filter((e) => e.clave === fila.dataset.imErr);
      fila.hidden = !propios.length;
      fila.textContent = propios.map((e) => `${e.campo ? `${e.campo}: ` : ''}${e.mensaje}`).join(' · ');
    }
    const sueltos = r.errores.filter((e) => !e.clave);
    c.querySelector('[data-im-errores]').innerHTML = listaErrores(sueltos);
    const porDia = totalesPorDia(r);
    for (const f of new Set(im.plan.registros.map((x) => x.fecha))) {
      const t = porDia[f];
      const b = c.querySelector(`[data-im-dia="${f}"]`);
      if (b) b.textContent = t ? `+${num(t.kcal)} kcal · P ${num(t.proteina)} g` : 'nada';
      const q = c.querySelector(`[data-im-queda="${f}"]`);
      if (q) {
        const dia = resumenDia(ctx.datos, f);
        const llevas = dia.comido.kcal;
        const total = llevas + (t?.kcal ?? 0);
        q.textContent = dia.objetivo ? `Con lo que ya llevas ese día: ${num(total)} de ${num(dia.objetivo.kcal)} kcal${total > dia.objetivo.kcal ? ` (te pasas en ${num(total - dia.objetivo.kcal)})` : ` (quedan ${num(dia.objetivo.kcal - total)})`} · proteína ${num(dia.comido.proteina + (t?.proteina ?? 0))} de ${num(dia.objetivo.proteina)} g` : `Ese día ya llevas ${num(llevas)} kcal.`;
      }
    }
    const nA = r.alimentos.filter((a) => a.decision !== 'usar').length;
    const nR = r.registros.length;
    const kcal = r.registros.reduce((s, x) => s + (x.nutrientes.kcal ?? 0), 0);
    const total = c.querySelector('[data-im-total]');
    if (total) total.innerHTML = r.errores.length ? `<span class="f-error">${r.errores.length === 1 ? 'Hay 1 error' : `Hay ${r.errores.length} errores`}: corrígelo o desmárcalo</span>` : nR ? `<b>+${num(kcal)} kcal</b> en ${Object.keys(porDia).length === 1 ? '1 día' : `${Object.keys(porDia).length} días`}` : `${nA} ${nA === 1 ? 'alimento' : 'alimentos'} a Mis alimentos`;
    const boton = c.querySelector('[data-im-boton]');
    const n = nR + r.alimentos.length;
    if (boton) {
      boton.disabled = Boolean(r.errores.length) || !n;
      boton.innerHTML = `${ic('check', 16)}Importar${n ? ` ${n}` : ''}`;
    }
    for (const fila of c.querySelectorAll('[data-im-fila]')) {
      const x = [...im.plan.alimentos, ...im.plan.registros].find((y) => y.clave === fila.dataset.imFila);
      fila.toggleAttribute('data-fuera', !x?.incluir);
    }
  }

  async function importar(boton) {
    const antes = ctx.datos;
    boton.disabled = true;
    boton.innerHTML = '<span class="f-cargando"></span>Importando…';
    let resumen;
    try {
      resumen = await ctx.importar(im.plan);
    } catch (error) {
      const errores = String(error.message || error)
        .split('\n')
        .filter((l) => l && !/^Hay \d+ errores:$/.test(l));
      im.hoja.cuerpo.querySelector('[data-im-errores]').innerHTML = listaErrores([`No se ha importado nada. ${errores.length > 1 ? 'Errores:' : ''}`.trim(), ...errores]);
      im.hoja.cuerpo.scrollTop = 0;
      boton.disabled = false;
      boton.innerHTML = `${ic('check', 16)}Importar`;
      return;
    }
    const partes = [];
    if (resumen.creados) partes.push(`${resumen.creados} ${resumen.creados === 1 ? 'alimento nuevo' : 'alimentos nuevos'}`);
    if (resumen.actualizados) partes.push(`${resumen.actualizados} ${resumen.actualizados === 1 ? 'actualizado' : 'actualizados'}`);
    if (resumen.registros) partes.push(`${resumen.registros} ${resumen.registros === 1 ? 'comida' : 'comidas'} en el diario`);
    ctx.hojas.cerrarTodas();
    if (resumen.fechas.length) {
      const hoy = ctx.hoy();
      ctx.estado.fecha = resumen.fechas.filter((f) => f <= hoy).at(-1) ?? hoy;
      ctx.irA('diario');
    } else ctx.repintar();
    ctx.tostada(`Importado: ${partes.join(', ') || 'nada nuevo'}`, { accion: () => ctx.guardar(antes), ms: 7000 });
  }

  const buscar = (clave) => [...(im?.plan?.alimentos ?? []), ...(im?.plan?.registros ?? [])].find((x) => x.clave === clave);

  const acciones = {
    importar: () => abrir(),
    'an-importar': () => abrir(),
    'im-pegar': async () => {
      try {
        const texto = await navigator.clipboard.readText();
        if (!texto.trim()) return ctx.tostada('El portapapeles está vacío.');
        im.texto = texto;
        const area = im.hoja.cuerpo.querySelector('textarea');
        if (area) area.value = texto;
        revisar();
      } catch {
        ctx.tostada('No puedo leer el portapapeles: mantén pulsado el cuadro y elige «Pegar».', { ms: 6000 });
        im.hoja.cuerpo.querySelector('textarea')?.focus();
      }
    },
    'im-formato': async () => {
      try {
        await navigator.clipboard.writeText(formatoParaIA(ctx.datos.momentos));
        ctx.tostada('Formato copiado. Pégaselo a la IA junto con lo que quieras importar.', { ms: 5000 });
      } catch {
        ctx.tostada('No he podido copiar. Prueba otra vez.');
      }
    },
    'im-volver': () => pintarPegar(),
    'im-decision': (el) => {
      const x = buscar(el.dataset.clave);
      if (!x) return;
      x.decision = el.dataset.v;
      for (const b of el.parentElement.querySelectorAll('button')) b.setAttribute('aria-pressed', String(b === el));
      actualizar();
    },
    'im-importar': (el) => importar(el),
  };

  const entradas = {
    'im-texto': (el) => {
      im.texto = el.value;
      const b = im.hoja.cuerpo.querySelector('[data-im-revisar]');
      if (b) b.disabled = !el.value.trim();
    },
    'im-cantidad': (el) => {
      const x = buscar(el.dataset.clave);
      if (!x) return;
      x.cantidad = el.value.trim() === '' ? undefined : el.value;
      actualizar();
    },
    'im-racion': (el) => {
      const x = buscar(el.dataset.clave);
      if (!x) return;
      x.alimento.racion = el.value.trim() === '' ? undefined : el.value;
      actualizar();
    },
  };

  const cambios = {
    'im-incluir': (el) => {
      const x = buscar(el.dataset.clave);
      if (!x) return;
      x.incluir = el.checked;
      actualizar();
    },
    'im-momento': (el) => {
      const x = buscar(el.dataset.clave);
      if (!x) return;
      x.momento = el.value;
      // Ya lo has elegido tú: fuera el aviso.
      x.avisoMomento = null;
      el.closest('.f-im__cuerpo')?.querySelector('[data-im-aviso-momento]')?.remove();
      actualizar();
    },
  };

  const formularios = {
    'im-leer': () => revisar(),
  };

  return { abrir, acciones, entradas, cambios, formularios };
}
