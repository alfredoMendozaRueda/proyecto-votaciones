// Biblioteca de ejercicios: los de serie y los tuyos, por grupo. Buscar (también
// por alias), crear, editar la ficha (grupo, secundarios, equipo, unilateral,
// principal, alias), fusionar duplicados, «Posibles duplicados» y copiar el
// catálogo para la IA.
import { GRUPOS, EQUIPOS } from '../../compartido/forma/datos.js';
import { crearEjercicio } from '../../compartido/forma/acciones.js';
import { normalizarNombre, limpiarAlias, sinTildes } from '../../compartido/forma/emparejar.js';
import { crearFusion } from './fusion-ui.js';
import { ic, escapar } from './ui.js';

const NOMBRE_EQUIPO = Object.fromEntries(EQUIPOS);

export function crearBiblioteca(ctx) {
  let b = null; // { hoja, texto, sel: Set | null, ficha }
  const fusion = crearFusion(ctx, { tipo: 'ejercicios', alTerminar: () => b && ((b.sel = null), pintarLista()) });
  const visibles = () => ctx.datos.ejercicios.filter((e) => !e.oculto);

  function abrir() {
    b = { texto: '', sel: null };
    b.hoja = ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Ejercicios</h2><button type="button" class="f-boton f-boton--chico" data-a="bi-nuevo">${ic('mas', 14)}Nuevo</button></div>
       <div class="f-rejilla-2">
         <button type="button" class="f-boton f-boton--chico" data-a="fu-ejercicios-catalogo">${ic('copiar', 14)}Copiar catálogo para la IA</button>
         <button type="button" class="f-boton f-boton--chico" data-a="bi-seleccionar" data-bi-sel>${ic('check', 14)}Seleccionar</button>
       </div>
       <div class="f-buscador">${ic('buscar', 17)}<input class="f-entrada" type="search" placeholder="Buscar por nombre, alias o grupo" data-entrada="bi-buscar" autocomplete="off"></div>
       <div class="f-columna" data-bi-lista></div>
       <div class="f-pie-fijo f-im-pie" data-bi-pie hidden>
         <span class="f-im-total" data-bi-cuenta></span>
         <button type="button" class="f-boton f-boton--azul" data-a="bi-fusionar" disabled>${ic('fusionar', 16)}Fusionar</button>
       </div>`,
      { clase: 'f-hoja--alta', titulo: 'Ejercicios', alCerrar: () => (b = null) },
    );
    pintarLista();
  }

  function filtrados() {
    const t = sinTildes(b.texto.trim());
    if (!t) return visibles();
    const n = normalizarNombre(t);
    return visibles().filter((e) => sinTildes(e.nombre).includes(t) || sinTildes(e.grupo).includes(t) || e.alias.some((a) => normalizarNombre(a).includes(n) || sinTildes(a).includes(t)));
  }

  function pintarLista() {
    const caja = b?.hoja.cuerpo.querySelector('[data-bi-lista]');
    if (!caja) return;
    const sel = b.sel;
    b.hoja.cuerpo.querySelector('[data-bi-sel]').innerHTML = sel ? `${ic('cerrar', 14)}Cancelar` : `${ic('check', 14)}Seleccionar`;
    const pie = b.hoja.cuerpo.querySelector('[data-bi-pie]');
    pie.hidden = !sel;
    if (sel) {
      b.hoja.cuerpo.querySelector('[data-bi-cuenta]').textContent = sel.size ? `${sel.size} ${sel.size === 1 ? 'elegido' : 'elegidos'}` : 'Marca 2 o más para fusionarlos';
      pie.querySelector('button').disabled = sel.size < 2;
    }
    const lista = filtrados();
    const grupos = GRUPOS.map((g) => [g, lista.filter((e) => e.grupo === g)]).filter(([, es]) => es.length);
    caja.innerHTML = `${!sel && !b.texto.trim() ? fusion.htmlDuplicados() : ''}
      ${sel ? '<p class="f-tenue">Marca los que son el mismo ejercicio y pulsa «Fusionar».</p>' : ''}
      ${
        grupos.length
          ? grupos
              .map(
                ([g, es]) => `<section class="f-columna" style="gap:0"><span class="f-etiqueta">${g}</span><div class="f-lista">${es
                  .map(
                    (e) => `<button type="button" class="f-item" data-a="${sel ? 'bi-marcar' : 'bi-ficha'}" data-id="${e.id}" ${sel ? `aria-pressed="${sel.has(e.id)}"` : ''}>
                      ${sel ? `<span class="f-casilla" aria-hidden="true">${sel.has(e.id) ? ic('check', 14) : ''}</span>` : ''}
                      <span class="f-item__texto"><span class="f-item__nombre">${escapar(e.nombre)}${e.principal ? ' <span style="color:var(--f-azul-2)">★</span>' : ''}</span>
                      <span class="f-item__detalle">${escapar([NOMBRE_EQUIPO[e.equipo], e.unilateral ? 'unilateral' : '', e.propio ? 'tuyo' : '', e.alias.length ? `alias: ${e.alias.join(', ')}` : ''].filter(Boolean).join(' · '))}</span></span>
                    </button>`,
                  )
                  .join('')}</div></section>`,
              )
              .join('')
          : `<p class="f-tenue">No hay ninguno así.</p><button type="button" class="f-boton" data-a="bi-nuevo">${ic('mas', 16)}Crear «${escapar(b.texto.trim())}»</button>`
      }`;
  }

  // Ficha: nuevo (sin id) o editar. El nombre de los de serie no se cambia.
  function ficha(e = null) {
    const nuevo = !e;
    const x = e ?? { nombre: b.texto.trim(), grupo: 'Otro', secundarios: [], equipo: 'otro', unilateral: false, principal: false, alias: [], propio: true };
    b.ficha = ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>${nuevo ? 'Nuevo ejercicio' : 'Ejercicio'}</h2>${nuevo ? '' : `<button type="button" class="f-boton f-boton--chico" data-a="bi-progreso" data-id="${x.id}">${ic('progreso', 14)}Progreso</button>`}</div>
       <form class="f-columna" data-form="bi-guardar" data-id="${x.id ?? ''}">
         <label class="f-campo"><span>Nombre${x.propio ? '' : ' (de serie: no se cambia; usa un alias)'}</span><input class="f-entrada" name="nombre" maxlength="80" required value="${escapar(x.nombre)}" ${x.propio ? '' : 'readonly'}></label>
         <div class="f-rejilla-2">
           <label class="f-campo"><span>Grupo</span><select class="f-entrada" name="grupo">${GRUPOS.map((g) => `<option ${g === x.grupo ? 'selected' : ''}>${g}</option>`).join('')}</select></label>
           <label class="f-campo"><span>Equipo</span><select class="f-entrada" name="equipo">${EQUIPOS.map(([k, t]) => `<option value="${k}" ${k === x.equipo ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
         </div>
         <div class="f-campo"><span>Grupos secundarios</span><div class="f-chips">${GRUPOS.map((g) => `<label class="f-chip f-chip--casilla"><input type="checkbox" name="secundarios" value="${g}" ${x.secundarios.includes(g) ? 'checked' : ''}>${g}</label>`).join('')}</div></div>
         <label class="f-interruptor"><input type="checkbox" name="unilateral" ${x.unilateral ? 'checked' : ''}><span>Unilateral <small>el peso se apunta por lado</small></span></label>
         <label class="f-interruptor"><input type="checkbox" name="principal" ${x.principal ? 'checked' : ''}><span>Principal <small>cuenta en el asesor de descarga y en los avisos de fuerza</small></span></label>
         <label class="f-campo"><span>Alias (uno por línea)</span><textarea class="f-entrada f-alias" name="alias" rows="3" placeholder="Lat pulldown, Jalón polea alta…">${escapar(x.alias.join('\n'))}</textarea></label>
         <p class="f-error" data-bi-error hidden></p>
         <button type="submit" class="f-boton f-boton--azul f-boton--ancho">${ic('check', 16)}${nuevo ? 'Crear' : 'Guardar'}</button>
       </form>`,
      { clase: 'f-hoja--alta', titulo: nuevo ? 'Nuevo ejercicio' : x.nombre },
    );
  }

  function guardar(form) {
    const error = form.querySelector('[data-bi-error]');
    const mal = (t) => {
      error.hidden = false;
      error.textContent = t;
    };
    const id = form.dataset.id;
    const actual = id ? ctx.datos.ejercicios.find((e) => e.id === id) : null;
    const nombre = actual && !actual.propio ? actual.nombre : form.elements.nombre.value.trim().slice(0, 80);
    if (!nombre) return mal('Ponle un nombre.');
    const otros = visibles().filter((e) => e.id !== id);
    // Ni el nombre ni los alias pueden ser ya otro ejercicio (se confundirían al importar).
    const igual = otros.find((e) => normalizarNombre(e.nombre) === normalizarNombre(nombre) || e.alias.some((a) => normalizarNombre(a) === normalizarNombre(nombre)));
    if (igual) return mal(`Ya tienes «${igual.nombre}» con ese nombre o alias. Si son el mismo, fusiónalos.`);
    const alias = limpiarAlias(form.elements.alias.value.split('\n'), nombre);
    const choca = alias.find((a) => otros.some((e) => normalizarNombre(e.nombre) === normalizarNombre(a)));
    if (choca) return mal(`El alias «${choca}» ya es el nombre de otro ejercicio. Si son el mismo, fusiónalos.`);
    const grupo = form.elements.grupo.value;
    const campos = {
      grupo,
      equipo: form.elements.equipo.value,
      secundarios: [...form.querySelectorAll('input[name="secundarios"]:checked')].map((i) => i.value).filter((g) => g !== grupo),
      unilateral: form.elements.unilateral.checked,
      principal: form.elements.principal.checked,
      alias,
    };
    let datos = ctx.datos;
    if (!actual) {
      const r = crearEjercicio(datos, nombre, grupo);
      datos = { ...r.datos, ejercicios: r.datos.ejercicios.map((e) => (e.id === r.ejercicio.id ? { ...e, ...campos } : e)) };
    } else datos = { ...datos, ejercicios: datos.ejercicios.map((e) => (e.id === id ? { ...e, ...campos, ...(e.propio ? { nombre } : {}) } : e)) };
    ctx.guardar(datos, { pintar: false });
    ctx.hojas.cerrar(b.ficha);
    pintarLista();
    ctx.tostada(`«${nombre}» ${actual ? 'guardado' : 'creado'}`);
  }

  const acciones = {
    ...fusion.acciones,
    'bi-ficha': (el) => {
      const e = visibles().find((x) => x.id === el.dataset.id);
      if (e) ficha(e);
    },
    'bi-nuevo': () => ficha(null),
    'bi-progreso': (el) => ctx.verEjercicio?.(el.dataset.id),
    'bi-seleccionar': () => {
      b.sel = b.sel ? null : new Set();
      pintarLista();
    },
    'bi-marcar': (el) => {
      if (!b.sel) return;
      const k = el.dataset.id;
      if (b.sel.has(k)) b.sel.delete(k);
      else b.sel.add(k);
      pintarLista();
    },
    'bi-fusionar': () => b?.sel && fusion.abrir([...b.sel]),
  };
  const entradas = {
    'bi-buscar': (el) => {
      b.texto = el.value;
      pintarLista();
    },
  };
  const formularios = { ...fusion.formularios, 'bi-guardar': (form) => guardar(form) };

  return { abrir, acciones, entradas, cambios: {}, formularios };
}
