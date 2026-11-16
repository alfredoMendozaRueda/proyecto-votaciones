// Importar desde JSON: pegas lo que te ha preparado una IA, revisas una vista
// previa (marcas, cantidades y comidas editables, duplicados) e importas de una
// vez. Nada se guarda hasta pulsar «Importar», y se puede deshacer.
import { leerImportacion, resolverPlan, totalesPorDia, formatoParaIA, textoError, ErrorImportacion, mismosValores } from '../../compartido/forma/importar.js';
import { resumenDia } from '../../compartido/forma/diario.js';
import { minutosDe, nombreDia, fechaCorta } from '../../compartido/forma/fechas.js';
import { buscarLocal } from '../../compartido/forma/alimentos.js';
import { normalizarNombre } from '../../compartido/forma/emparejar.js';
import { ic, escapar, num } from './ui.js';
import { crearVistaEntreno } from './importador-entreno.js';

const NIVEL = { id: 'por su id', ean: 'por el código de barras', nombre: 'por el nombre', alias: 'por un alias', manual: 'lo has elegido tú' };
const conMarca = (a) => `${a.nombre}${a.marca ? ` (${a.marca})` : ''}`;

const macros = (n) => `${num(n.kcal ?? 0)} kcal · P ${num(n.proteina ?? 0, 1)} · H ${num(n.hidratos ?? 0, 1)} · G ${num(n.grasa ?? 0, 1)}`;
const listaErrores = (errores, max = 12) =>
  errores.length ? `<ul class="f-im-errores" role="alert">${errores.slice(0, max).map((e) => `<li>${escapar(typeof e === 'string' ? e : textoError(e))}</li>`).join('')}${errores.length > max ? `<li>… y ${errores.length - max} más</li>` : ''}</ul>` : '';

export function crearImportador(ctx) {
  let im = null; // { hoja, texto, plan }
  const entreno = crearVistaEntreno(ctx, { plan: () => im.plan, repintar: () => repintarRevision(), actualizar: () => actualizar() });

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
        ${x.avisoId ? `<p class="f-im__aviso">${escapar(x.avisoId)}</p>` : ''}
        ${cajaCoincidencia(x, existente)}
        <p class="f-error" data-im-err="${x.clave}" hidden></p>
      </div>
    </div>`;
  }

  // Qué pasa con este alimento frente a los tuyos: ya lo tienes (niveles 1-4 o
  // elegido a mano), se parece a uno (nivel 5, sugerencia) o es nuevo.
  function cajaCoincidencia(x, existente) {
    const a = x.alimento;
    const otroNombre = existente && normalizarNombre(a.nombre) !== normalizarNombre(existente.nombre);
    const nota = (texto) => `<p class="f-im__nota">${texto}</p>`;
    const segmento = `<div class="f-segmento" role="group" aria-label="Qué hago con el que ya tienes">
        ${[
          ['usar', 'Usar el mío'],
          ['actualizar', 'Actualizarlo'],
          ['crear', 'Crear otro'],
        ]
          .map(([v, t]) => `<button type="button" data-a="im-decision" data-clave="${x.clave}" data-v="${v}" aria-pressed="${x.decision === v}">${t}</button>`)
          .join('')}
      </div>`;
    if (existente && x.nivel !== 'aproximado') {
      return `<div class="f-im__dup">
        <p><b>Ya lo tienes:</b> ${escapar(conMarca(existente))} <span class="f-im__nivel">${NIVEL[x.nivel] ?? ''}</span></p>
        ${x.iguales ? '' : nota(`Tus valores: ${macros(existente.por100)} por 100 ${existente.unidad ?? 'g'}${existente.unidad !== a.unidad ? ' (otra unidad)' : ''}.`)}
        ${otroNombre && x.decision !== 'crear' ? nota(`«${escapar(a.nombre)}» se guardará como alias para reconocerlo solo la próxima vez.`) : ''}
        ${segmento}
      </div>`;
    }
    if (x.nivel === 'aproximado' && x.sugerencias?.length) {
      const s = x.sugerencias.find((y) => y.id === x.existenteId) ?? x.sugerencias[0];
      const si = x.decision !== 'crear';
      return `<div class="f-im__dup f-im__dup--sugerencia">
        <label class="f-im__si"><input type="checkbox" data-cambio="im-sugerencia" data-clave="${x.clave}" ${si ? 'checked' : ''}><span>¿Es tu <b>${escapar(conMarca(s))}</b>? <span class="f-im__nivel">parecido ${Math.round(s.similitud * 100)}&nbsp;%</span></span></label>
        ${s.marcaDistinta ? `<p class="f-im__aviso">Marca distinta (${escapar(a.marca)} ≠ ${escapar(s.marca)}): por defecto se crea como alimento nuevo.</p>` : ''}
        ${
          x.sugerencias.length > 1
            ? `<select class="f-entrada" data-cambio="im-sugerida" data-clave="${x.clave}" aria-label="Cuál de los tuyos">${x.sugerencias.map((y) => `<option value="${y.id}" ${y.id === s.id ? 'selected' : ''}>${escapar(conMarca(y))}</option>`).join('')}</select>`
            : ''
        }
        ${si ? nota(`Se usará el tuyo y «${escapar(a.nombre)}» quedará como alias.`) : nota('Se creará como alimento nuevo.')}
        <button type="button" class="f-enlace" data-a="im-elegir" data-clave="${x.clave}">Es otro de los míos…</button>
      </div>`;
    }
    return `<div class="f-fila f-entre"><span class="f-im__nuevo">Nuevo en Mis alimentos</span><button type="button" class="f-enlace" data-a="im-elegir" data-clave="${x.clave}">Es uno que ya tengo…</button></div>`;
  }

  // Elegir uno de tus alimentos para un alimento o un registro importado.
  function hojaElegir(clave) {
    const x = buscar(clave);
    if (!x) return;
    const nombre = typeof x.alimento === 'string' ? x.alimento : x.alimento.nombre;
    im.eligiendo = { clave, texto: nombre };
    im.hojaElegir = ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>¿Cuál es?</h2></div>
       <p class="f-tenue">Elige el alimento tuyo que corresponde a «${escapar(nombre)}». Ese nombre se guardará como alias.</p>
       <div class="f-buscador">${ic('buscar', 17)}<input class="f-entrada" type="search" value="${escapar(nombre)}" data-entrada="im-buscar-mio" autocomplete="off" aria-label="Buscar en tus alimentos"></div>
       <div data-im-mios></div>`,
      { clase: 'f-hoja--alta', titulo: 'Elegir alimento', alCerrar: () => (im && (im.eligiendo = null)) },
    );
    pintarMios();
  }

  function pintarMios() {
    const caja = im?.hojaElegir?.cuerpo.querySelector('[data-im-mios]');
    if (!caja) return;
    const t = im.eligiendo.texto.trim();
    // Por palabras sueltas: basta con que coincida alguna.
    let lista = t ? buscarLocal(ctx.datos, t, 40) : [];
    if (!lista.length && t) lista = [...new Map(t.split(/\s+/).flatMap((w) => buscarLocal(ctx.datos, w, 15)).map((a) => [a.id, a])).values()].slice(0, 40);
    if (!t) lista = [...ctx.datos.alimentos].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')).slice(0, 60);
    caja.innerHTML = lista.length
      ? `<div class="f-lista">${lista.map((a) => `<button type="button" class="f-item" data-a="im-mio" data-id="${a.id}"><span class="f-item__texto"><span class="f-item__nombre">${escapar(a.nombre)}</span><span class="f-item__detalle">${escapar([a.marca, `${num(a.por100.kcal ?? 0)} kcal/100 ${a.unidad}`].filter(Boolean).join(' · '))}</span></span></button>`).join('')}</div>`
      : '<p class="f-tenue">No encuentro ninguno con ese nombre. Prueba con otra palabra.</p>';
  }

  function filaRegistro(x) {
    const unidad = unidadRegistro(x);
    return `<div class="f-im" data-im-fila="${x.clave}" ${x.incluir ? '' : 'data-fuera'}>
      <input type="checkbox" class="f-im__marca" data-cambio="im-incluir" data-clave="${x.clave}" ${x.incluir ? 'checked' : ''} aria-label="Importar ${escapar(x.alimento)}">
      <div class="f-im__cuerpo">
        <div class="f-im__nombre">${escapar(x.alimento || x.alimentoId)}${x.marca ? ` <small>${escapar(x.marca)}</small>` : ''}</div>
        <div class="f-im__campos">
          <span class="f-con-unidad" data-unidad="${unidad}" data-im-unidad="${x.clave}"><input class="f-entrada" type="text" inputmode="decimal" autocomplete="off" value="${x.cantidad}" data-entrada="im-cantidad" data-clave="${x.clave}" aria-label="Cantidad"></span>
          <select class="f-entrada" data-cambio="im-momento" data-clave="${x.clave}" aria-label="Comida">${ctx.datos.momentos.map((m) => `<option value="${m.id}" ${m.id === x.momento ? 'selected' : ''}>${escapar(m.nombre)}</option>`).join('')}</select>
        </div>
        <div class="f-im__detalle" data-im-n="${x.clave}"></div>
        <p class="f-im__nota" data-im-av="${x.clave}" hidden></p>
        ${x.avisoMomento ? `<p class="f-im__aviso" data-im-aviso-momento>${escapar(x.avisoMomento)}</p>` : ''}
        ${(im.plan.avisos ?? [])
          .filter((v) => v.clave === x.clave)
          .map((v) => `<p class="f-im__aviso">${escapar(`${v.campo}: ${v.mensaje}`)}</p>`)
          .join('')}
        <p class="f-error" data-im-err="${x.clave}" hidden></p>
        <div class="f-im__asociar" data-im-asociar="${x.clave}"></div>
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
      <p class="f-tenue">${[
        p.alimentos.length ? `${p.alimentos.length} ${p.alimentos.length === 1 ? 'alimento' : 'alimentos'}` : '',
        p.registros.length ? `${p.registros.length} ${p.registros.length === 1 ? 'comida' : 'comidas'}` : '',
        p.ejercicios?.length ? `${p.ejercicios.length} ${p.ejercicios.length === 1 ? 'ejercicio' : 'ejercicios'}` : '',
        p.rutinas?.length ? `${p.rutinas.length} ${p.rutinas.length === 1 ? 'rutina' : 'rutinas'}` : '',
        p.sesiones?.length ? `${p.sesiones.length} ${p.sesiones.length === 1 ? 'sesión' : 'sesiones'}` : '',
      ]
        .filter(Boolean)
        .join(', ')
        .replace(/, ([^,]*)$/, ' y $1')}. Desmarca lo que no quieras y corrige lo que haga falta: los valores se recalculan al momento.</p>
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
      ${entreno.html(im.resuelto)}
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
      // En entrenos, el error dice también el ejercicio y la serie.
      fila.textContent = propios.map((e) => (/^[eqs]\d/.test(e.clave) ? textoError(e) : `${e.campo ? `${e.campo}: ` : ''}${e.mensaje}`)).join(' · ');
      // Un registro que no encuentra su alimento: «¿Es…?» con los tuyos más parecidos.
      const caja = c.querySelector(`[data-im-asociar="${fila.dataset.imErr}"]`);
      if (caja) {
        const conAlimento = propios.find((e) => e.campo === 'alimento');
        caja.innerHTML = conAlimento
          ? `${(conAlimento.sugerencias ?? []).map((y) => `<button type="button" class="f-chip" data-a="im-asociar" data-clave="${fila.dataset.imErr}" data-id="${y.id}">¿Es ${escapar(conMarca(y))}?</button>`).join('')}<button type="button" class="f-chip" data-a="im-elegir" data-clave="${fila.dataset.imErr}">${ic('buscar', 13)}Buscar en los míos…</button>`
          : '';
      }
    }
    // Notas de cada registro: asociado a mano, o un alimento_id que no existe.
    for (const x of im.plan.registros) {
      const p = c.querySelector(`[data-im-av="${x.clave}"]`);
      if (!p) continue;
      const res = r.registros.find((y) => y.clave === x.clave);
      const destino = x.asociado ? ctx.datos.alimentos.find((a) => a.id === x.alimentoId) : null;
      const texto = destino ? `Asociado a tu «${escapar(conMarca(destino))}»: «${escapar(x.alimento)}» se guardará como alias. <button type="button" class="f-enlace" data-a="im-desasociar" data-clave="${x.clave}">Quitar</button>` : res?.aviso ? escapar(res.aviso) : '';
      p.hidden = !texto;
      p.innerHTML = texto;
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
    const ent = entreno.resumen(r);
    const total = c.querySelector('[data-im-total]');
    const textoEntreno = ent?.sesiones ? `<b>${ent.sesiones} ${ent.sesiones === 1 ? 'sesión' : 'sesiones'}</b> · ${ent.series} series` : ent?.elementos ? `${ent.elementos} de entreno` : '';
    const textoComida = nR ? `<b>+${num(kcal)} kcal</b> en ${Object.keys(porDia).length === 1 ? '1 día' : `${Object.keys(porDia).length} días`}` : nA ? `${nA} ${nA === 1 ? 'alimento' : 'alimentos'} a Mis alimentos` : '';
    if (total)
      total.innerHTML = r.errores.length
        ? `<span class="f-error">${r.errores.length === 1 ? 'Hay 1 error' : `Hay ${r.errores.length} errores`}: corrígelo o desmárcalo</span>`
        : ent?.faltan
          ? `<span class="f-error">Faltan ${ent.faltan} por resolver</span>`
          : [textoComida, textoEntreno].filter(Boolean).join(' · ') || 'Nada marcado';
    const boton = c.querySelector('[data-im-boton]');
    const n = nR + r.alimentos.length + (ent?.elementos ?? 0);
    if (boton) {
      boton.disabled = Boolean(r.errores.length) || Boolean(ent?.faltan) || !n;
      boton.innerHTML = `${ic('check', 16)}Importar${n ? ` ${n}` : ''}`;
    }
    for (const fila of c.querySelectorAll('[data-im-fila]')) {
      const x = todos().find((y) => y.clave === fila.dataset.imFila);
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
    if (resumen.alias) partes.push(`${resumen.alias} ${resumen.alias === 1 ? 'alias nuevo' : 'alias nuevos'}`);
    if (resumen.registros) partes.push(`${resumen.registros} ${resumen.registros === 1 ? 'comida' : 'comidas'} en el diario`);
    if (resumen.ejerciciosCreados) partes.push(`${resumen.ejerciciosCreados} ${resumen.ejerciciosCreados === 1 ? 'ejercicio nuevo' : 'ejercicios nuevos'}`);
    if (resumen.rutinasCreadas || resumen.rutinasActualizadas) partes.push(`${(resumen.rutinasCreadas ?? 0) + (resumen.rutinasActualizadas ?? 0)} ${(resumen.rutinasCreadas ?? 0) + (resumen.rutinasActualizadas ?? 0) === 1 ? 'rutina' : 'rutinas'}`);
    if (resumen.sesiones || resumen.sesionesFusionadas) partes.push(`${(resumen.sesiones ?? 0) + (resumen.sesionesFusionadas ?? 0)} ${(resumen.sesiones ?? 0) + (resumen.sesionesFusionadas ?? 0) === 1 ? 'sesión' : 'sesiones'} (${resumen.series} series)`);
    ctx.hojas.cerrarTodas();
    if (resumen.fechasEntreno?.length && !resumen.registros) ctx.irA('entreno');
    else if (resumen.fechas.length) {
      const hoy = ctx.hoy();
      ctx.estado.fecha = resumen.fechas.filter((f) => f <= hoy).at(-1) ?? hoy;
      ctx.irA('diario');
    } else ctx.repintar();
    ctx.tostada(`Importado: ${partes.join(', ') || 'nada nuevo'}`, { accion: () => ctx.guardar(antes), ms: 7000 });
  }

  const todos = () => ['alimentos', 'registros', 'ejercicios', 'rutinas', 'sesiones'].flatMap((k) => im?.plan?.[k] ?? []);
  const buscar = (clave) => todos().find((x) => x.clave === clave);

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
      repintarRevision();
    },
    'im-importar': (el) => importar(el),
    ...entreno.acciones,
    'im-elegir': (el) => hojaElegir(el.dataset.clave),
    // Elegido en «¿Cuál es?»: un alimento importado pasa a usar el tuyo; un registro se asocia.
    'im-mio': (el) => {
      const clave = im?.eligiendo?.clave;
      const x = buscar(clave);
      ctx.hojas.cerrar(im.hojaElegir);
      if (!x) return;
      if (clave.startsWith('a')) {
        const e = ctx.datos.alimentos.find((a) => a.id === el.dataset.id);
        Object.assign(x, { existenteId: el.dataset.id, nivel: 'manual', decision: 'usar', iguales: e ? mismosValores(x.alimento, e) : false });
      } else Object.assign(x, { alimentoId: el.dataset.id, asociado: true });
      repintarRevision();
    },
    'im-asociar': (el) => {
      const x = buscar(el.dataset.clave);
      if (!x) return;
      Object.assign(x, { alimentoId: el.dataset.id, asociado: true });
      actualizar();
    },
    'im-desasociar': (el) => {
      const x = buscar(el.dataset.clave);
      if (!x) return;
      delete x.alimentoId;
      x.asociado = false;
      actualizar();
    },
  };

  // Repinta la vista previa sin perder por dónde ibas.
  function repintarRevision() {
    const arriba = im.hoja.cuerpo.scrollTop;
    pintarRevision();
    im.hoja.cuerpo.scrollTop = arriba;
  }

  const entradas = {
    ...entreno.entradas,
    'im-buscar-mio': (el) => {
      if (!im?.eligiendo) return;
      im.eligiendo.texto = el.value;
      pintarMios();
    },
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
    // «¿Es tu X?»: sí → se usa el tuyo (y el nombre queda como alias); no → nuevo.
    'im-sugerencia': (el) => {
      const x = buscar(el.dataset.clave);
      if (!x) return;
      x.decision = el.checked ? 'usar' : 'crear';
      repintarRevision();
    },
    'im-sugerida': (el) => {
      const x = buscar(el.dataset.clave);
      if (!x) return;
      x.existenteId = el.value;
      repintarRevision();
    },
    'im-incluir': (el) => {
      const x = buscar(el.dataset.clave);
      if (!x) return;
      x.incluir = el.checked;
      // En entrenos cambian las referencias, los duplicados y lo que falta por resolver.
      if (/^[eqs]\d/.test(x.clave)) repintarRevision();
      else actualizar();
    },
    ...entreno.cambios,
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
