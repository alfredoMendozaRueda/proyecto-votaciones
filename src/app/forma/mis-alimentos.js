// Mis alimentos: tu catálogo entero (buscados, escaneados, a mano, de la IA o
// importados) para buscarlos, corregirlos, ponerles alias, fusionar
// duplicados, marcarlos como favoritos o borrarlos. Cambiar un alimento no
// toca lo que ya apuntaste: el diario guarda sus valores.
import { buscarLocal } from '../../compartido/forma/alimentos.js';
import { NUTRIENTES } from '../../compartido/forma/datos.js';
import { limpiarAlias, normalizarNombre } from '../../compartido/forma/emparejar.js';
import { crearFusion } from './fusion-ui.js';
import { ic, escapar, num } from './ui.js';

const ORIGEN = { manual: 'a mano', off: 'Open Food Facts', ia: 'IA', importado: 'importado' };
const NOMBRES = { kcal: 'Kcal', proteina: 'Proteína (g)', hidratos: 'Hidratos (g)', azucares: 'Azúcares (g)', grasa: 'Grasa (g)', saturadas: 'Saturadas (g)', fibra: 'Fibra (g)', sal: 'Sal (g)' };
const OBLIGATORIOS = ['kcal', 'proteina', 'hidratos', 'grasa'];

// Busca también en los alias.
function buscar(datos, texto) {
  const n = normalizarNombre(texto);
  const porAlias = datos.alimentos.filter((a) => a.alias.some((al) => normalizarNombre(al).includes(n)));
  return [...new Map([...buscarLocal(datos, texto, 500), ...porAlias].map((a) => [a.id, a])).values()];
}

export function crearMisAlimentos(ctx) {
  let m = null; // { hoja, texto, sel: Set | null, editando }
  const fusion = crearFusion(ctx, { tipo: 'alimentos', alTerminar: () => m && ((m.sel = null), pintarLista()) });

  function abrir() {
    m = { texto: '', sel: null };
    m.hoja = ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Mis alimentos</h2><button type="button" class="f-boton f-boton--chico" data-a="importar">${ic('importar', 14)}Importar</button></div>
       <div class="f-rejilla-2">
         <button type="button" class="f-boton f-boton--chico" data-a="fu-alimentos-catalogo">${ic('copiar', 14)}Copiar catálogo para la IA</button>
         <button type="button" class="f-boton f-boton--chico" data-a="ma-seleccionar" data-ma-sel>${ic('check', 14)}Seleccionar</button>
       </div>
       <div class="f-buscador">${ic('buscar', 17)}<input class="f-entrada" type="search" placeholder="Buscar por nombre, marca o alias" data-entrada="ma-buscar" autocomplete="off" enterkeyhint="search"></div>
       <div data-ma-lista></div>
       <div class="f-pie-fijo f-im-pie" data-ma-pie hidden>
         <span class="f-im-total" data-ma-cuenta></span>
         <button type="button" class="f-boton f-boton--azul" data-a="ma-fusionar" disabled>${ic('fusionar', 16)}Fusionar</button>
       </div>`,
      { clase: 'f-hoja--alta', titulo: 'Mis alimentos', alCerrar: () => (m = null) },
    );
    pintarLista();
  }

  function lista() {
    const d = ctx.datos;
    if (m.texto.trim()) return buscar(d, m.texto);
    return [...d.alimentos].sort((a, b) => b.favorito - a.favorito || a.nombre.localeCompare(b.nombre, 'es'));
  }

  function pintarLista() {
    const caja = m?.hoja.cuerpo.querySelector('[data-ma-lista]');
    if (!caja) return;
    const d = ctx.datos;
    const items = lista();
    const sel = m.sel;
    const boton = m.hoja.cuerpo.querySelector('[data-ma-sel]');
    if (boton) boton.innerHTML = sel ? `${ic('cerrar', 14)}Cancelar` : `${ic('check', 14)}Seleccionar`;
    const pie = m.hoja.cuerpo.querySelector('[data-ma-pie]');
    pie.hidden = !sel;
    if (sel) {
      m.hoja.cuerpo.querySelector('[data-ma-cuenta]').textContent = sel.size ? `${sel.size} ${sel.size === 1 ? 'elegido' : 'elegidos'}` : 'Marca 2 o más para fusionarlos';
      pie.querySelector('button').disabled = sel.size < 2;
    }
    if (!d.alimentos.length) {
      caja.innerHTML = '<p class="f-tenue">Aún no tienes alimentos guardados. Se guardan solos al buscarlos, escanearlos o añadirlos a mano, y puedes traer muchos de golpe con «Importar».</p>';
      return;
    }
    const importados = d.alimentos.filter((a) => a.origen === 'importado').length;
    caja.innerHTML = `${!sel && !m.texto.trim() ? fusion.htmlDuplicados() : ''}
      <p class="f-tenue">${d.alimentos.length} ${d.alimentos.length === 1 ? 'alimento' : 'alimentos'}${importados ? ` · ${importados} importados` : ''}. ${sel ? 'Marca los que son el mismo y pulsa «Fusionar».' : 'Tócalo para corregirlo o ponerle alias; lo que ya apuntaste no cambia.'}</p>
      ${
        items.length
          ? `<div class="f-lista">${items
              .map(
                (a) => `<button type="button" class="f-item" data-a="${sel ? 'ma-marcar' : 'ma-editar'}" data-id="${a.id}" ${sel ? `aria-pressed="${sel.has(a.id)}"` : ''}>
                  ${sel ? `<span class="f-casilla" aria-hidden="true">${sel.has(a.id) ? ic('check', 14) : ''}</span>` : ''}
                  <span class="f-item__texto"><span class="f-item__nombre">${a.favorito ? '<span style="color:var(--f-azul-2)">★</span> ' : ''}${escapar(a.nombre)}</span>
                  <span class="f-item__detalle">${escapar([a.marca, `${num(a.racion)} ${a.unidad}`, ORIGEN[a.origen], a.alias.length ? `${a.alias.length} alias` : ''].filter(Boolean).join(' · '))}</span></span>
                  <span class="f-item__kcal">${num(a.por100.kcal ?? 0)}<small> /100 ${a.unidad}</small></span>
                </button>`,
              )
              .join('')}</div>`
          : '<p class="f-tenue">No hay ninguno con ese nombre.</p>'
      }`;
  }

  function editar(a) {
    const campo = (k) => `<label class="f-campo"><span>${NOMBRES[k]}${OBLIGATORIOS.includes(k) ? '' : ' (opc.)'}</span><input class="f-entrada" name="${k}" type="text" inputmode="decimal" autocomplete="off" value="${a.por100[k] ?? ''}" ${OBLIGATORIOS.includes(k) ? 'required' : ''}></label>`;
    m.editando = ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Editar</h2><button type="button" class="f-icono-boton" data-a="ma-favorito" aria-pressed="${a.favorito}" aria-label="Favorito" style="${a.favorito ? 'color:var(--f-azul-2);border-color:var(--f-azul)' : ''}">${ic('estrella', 17)}</button></div>
       <form class="f-columna" data-form="ma-guardar" data-id="${a.id}">
         <label class="f-campo"><span>Nombre</span><input class="f-entrada" name="nombre" required maxlength="120" value="${escapar(a.nombre)}"></label>
         <div class="f-rejilla-2">
           <label class="f-campo"><span>Marca (opc.)</span><input class="f-entrada" name="marca" maxlength="80" value="${escapar(a.marca)}"></label>
           <label class="f-campo"><span>Unidad</span><select class="f-entrada" name="unidad" data-cambio="ma-unidad"><option value="g" ${a.unidad === 'g' ? 'selected' : ''}>Gramos (g)</option><option value="ml" ${a.unidad === 'ml' ? 'selected' : ''}>Mililitros (ml)</option></select></label>
         </div>
         <label class="f-campo"><span>Ración habitual</span><span class="f-con-unidad" data-unidad="${a.unidad}" data-ma-unidad><input class="f-entrada" name="racion" type="text" inputmode="decimal" autocomplete="off" value="${a.racion}" required></span></label>
         <span class="f-etiqueta" data-ma-por>Por cada 100 ${a.unidad}</span>
         <div class="f-rejilla-2">${NUTRIENTES.map(campo).join('')}</div>
         <label class="f-campo"><span>Alias (uno por línea)</span><textarea class="f-entrada f-alias" name="alias" rows="3" placeholder="Otros nombres con los que lo reconoces al importar: «Yogur proteínas fresa»…">${escapar(a.alias.join('\n'))}</textarea></label>
         <p class="f-error" data-ma-error hidden></p>
         <p class="f-tenue">${escapar(ORIGEN[a.origen] ? `Origen: ${ORIGEN[a.origen]}` : '')}${a.codigo ? ` · código ${escapar(a.codigo)}` : ''}${a.veces ? ` · usado ${a.veces} ${a.veces === 1 ? 'vez' : 'veces'}` : ''}</p>
         <div class="f-fila">
           <button type="button" class="f-boton f-boton--peligro" data-a="ma-borrar" data-id="${a.id}">${ic('basura', 15)}Borrar</button>
           <button type="submit" class="f-boton f-boton--azul" style="flex:1">${ic('check', 16)}Guardar</button>
         </div>
       </form>`,
      { titulo: 'Editar alimento' },
    );
    m.editando.id = a.id;
  }

  const acciones = {
    ...fusion.acciones,
    'mis-alimentos': () => abrir(),
    'ma-editar': (el) => {
      const a = ctx.datos.alimentos.find((x) => x.id === el.dataset.id);
      if (a) editar(a);
    },
    'ma-seleccionar': () => {
      m.sel = m.sel ? null : new Set();
      pintarLista();
    },
    'ma-marcar': (el) => {
      if (!m.sel) return;
      const k = el.dataset.id;
      if (m.sel.has(k)) m.sel.delete(k);
      else m.sel.add(k);
      pintarLista();
    },
    'ma-fusionar': () => m?.sel && fusion.abrir([...m.sel]),
    'ma-favorito': (el) => {
      const a = ctx.datos.alimentos.find((x) => x.id === m?.editando?.id);
      if (!a) return;
      const nuevo = !a.favorito;
      ctx.guardar({ ...ctx.datos, alimentos: ctx.datos.alimentos.map((x) => (x.id === a.id ? { ...x, favorito: nuevo } : x)) }, { pintar: false });
      el.setAttribute('aria-pressed', String(nuevo));
      el.style.cssText = nuevo ? 'color:var(--f-azul-2);border-color:var(--f-azul)' : '';
      pintarLista();
    },
    // Dos toques para borrar: el primero pide confirmación.
    'ma-borrar': (el) => {
      if (!el.dataset.seguro) {
        el.dataset.seguro = '1';
        el.innerHTML = `${ic('basura', 15)}¿Seguro?`;
        return;
      }
      const antes = ctx.datos;
      const a = antes.alimentos.find((x) => x.id === el.dataset.id);
      ctx.guardar({ ...antes, alimentos: antes.alimentos.filter((x) => x.id !== el.dataset.id) }, { pintar: false });
      ctx.hojas.cerrar(m.editando);
      pintarLista();
      ctx.tostada(`«${a?.nombre ?? 'Alimento'}» borrado`, {
        accion: () => {
          ctx.guardar(antes, { pintar: false });
          pintarLista();
        },
      });
    },
  };

  const entradas = {
    'ma-buscar': (el) => {
      m.texto = el.value;
      pintarLista();
    },
  };

  const cambios = {
    // La unidad cambia las etiquetas al momento.
    'ma-unidad': (el) => {
      const f = el.form;
      f.querySelector('[data-ma-unidad]').dataset.unidad = el.value;
      f.querySelector('[data-ma-por]').textContent = `Por cada 100 ${el.value}`;
    },
  };

  const formularios = {
    ...fusion.formularios,
    'ma-guardar': (form) => {
      const error = form.querySelector('[data-ma-error]');
      const valor = (k) => {
        const t = String(form.elements[k].value).trim().replace(',', '.');
        if (t === '') return undefined;
        const n = Number(t);
        return Number.isFinite(n) && n >= 0 ? n : NaN;
      };
      const fallos = [];
      const nombre = form.elements.nombre.value.trim();
      if (!nombre) fallos.push('el nombre es obligatorio');
      const racion = valor('racion');
      if (!(racion > 0) || racion > 5000) fallos.push('la ración debe ser un número mayor que 0');
      const por100 = {};
      for (const k of NUTRIENTES) {
        const v = valor(k);
        if (v === undefined) {
          if (OBLIGATORIOS.includes(k)) fallos.push(`${NOMBRES[k].replace(/ \(g\)$/, '').toLowerCase()} es obligatorio`);
        } else if (Number.isNaN(v) || v > (k === 'kcal' ? 900 : 100)) fallos.push(`${NOMBRES[k].replace(/ \(g\)$/, '').toLowerCase()}: número no válido`);
        else por100[k] = v;
      }
      // Un alias no puede ser el nombre de otro alimento tuyo (se confundirían al importar).
      const alias = limpiarAlias(form.elements.alias.value.split('\n'), nombre);
      const id = form.dataset.id;
      const choca = alias.find((al) => ctx.datos.alimentos.some((x) => x.id !== id && normalizarNombre(x.nombre) === normalizarNombre(al)));
      if (choca) fallos.push(`el alias «${choca}» ya es el nombre de otro de tus alimentos (si son el mismo, fusiónalos)`);
      if (fallos.length) {
        error.hidden = false;
        error.textContent = `Revisa: ${fallos.join(', ')}.`;
        return;
      }
      ctx.guardar({ ...ctx.datos, alimentos: ctx.datos.alimentos.map((x) => (x.id === id ? { ...x, nombre, marca: form.elements.marca.value.trim(), unidad: form.elements.unidad.value === 'ml' ? 'ml' : 'g', racion, por100, alias } : x)) }, { pintar: false });
      ctx.hojas.cerrar(m.editando);
      pintarLista();
      ctx.tostada(`«${nombre}» guardado`);
    },
  };

  return { abrir, acciones, entradas, cambios, formularios, repintar: () => m && pintarLista() };
}
