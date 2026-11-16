// Mis alimentos: tu catálogo entero (buscados, escaneados, a mano, de la IA o
// importados) para buscarlos, corregirlos, marcarlos como favoritos o borrarlos.
// Cambiar un alimento no toca lo que ya apuntaste: el diario guarda sus valores.
import { buscarLocal } from '../../compartido/forma/alimentos.js';
import { NUTRIENTES } from '../../compartido/forma/datos.js';
import { ic, escapar, num } from './ui.js';

const ORIGEN = { manual: 'a mano', off: 'Open Food Facts', ia: 'IA', importado: 'importado' };
const NOMBRES = { kcal: 'Kcal', proteina: 'Proteína (g)', hidratos: 'Hidratos (g)', azucares: 'Azúcares (g)', grasa: 'Grasa (g)', saturadas: 'Saturadas (g)', fibra: 'Fibra (g)', sal: 'Sal (g)' };
const OBLIGATORIOS = ['kcal', 'proteina', 'hidratos', 'grasa'];

export function crearMisAlimentos(ctx) {
  let m = null; // { hoja, texto, editando }

  function abrir() {
    m = { texto: '' };
    m.hoja = ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Mis alimentos</h2><button type="button" class="f-boton f-boton--chico" data-a="importar">${ic('importar', 14)}Importar</button></div>
       <div class="f-buscador">${ic('buscar', 17)}<input class="f-entrada" type="search" placeholder="Buscar por nombre o marca" data-entrada="ma-buscar" autocomplete="off" enterkeyhint="search"></div>
       <div data-ma-lista></div>`,
      { clase: 'f-hoja--alta', titulo: 'Mis alimentos', alCerrar: () => (m = null) },
    );
    pintarLista();
  }

  function lista() {
    const d = ctx.datos;
    if (m.texto.trim()) return buscarLocal(d, m.texto, 500);
    return [...d.alimentos].sort((a, b) => b.favorito - a.favorito || a.nombre.localeCompare(b.nombre, 'es'));
  }

  function pintarLista() {
    const caja = m?.hoja.cuerpo.querySelector('[data-ma-lista]');
    if (!caja) return;
    const d = ctx.datos;
    const items = lista();
    if (!d.alimentos.length) {
      caja.innerHTML = '<p class="f-tenue">Aún no tienes alimentos guardados. Se guardan solos al buscarlos, escanearlos o añadirlos a mano, y puedes traer muchos de golpe con «Importar».</p>';
      return;
    }
    const importados = d.alimentos.filter((a) => a.origen === 'importado').length;
    caja.innerHTML = `<p class="f-tenue">${d.alimentos.length} ${d.alimentos.length === 1 ? 'alimento' : 'alimentos'}${importados ? ` · ${importados} importados` : ''}. Tócalo para corregirlo; lo que ya apuntaste no cambia.</p>
      ${
        items.length
          ? `<div class="f-lista">${items
              .map(
                (a) => `<button type="button" class="f-item" data-a="ma-editar" data-id="${a.id}">
                  <span class="f-item__texto"><span class="f-item__nombre">${a.favorito ? '<span style="color:var(--f-azul-2)">★</span> ' : ''}${escapar(a.nombre)}</span>
                  <span class="f-item__detalle">${escapar([a.marca, `${num(a.racion)} ${a.unidad}`, ORIGEN[a.origen]].filter(Boolean).join(' · '))}</span></span>
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
    'mis-alimentos': () => abrir(),
    'ma-editar': (el) => {
      const a = ctx.datos.alimentos.find((x) => x.id === el.dataset.id);
      if (a) editar(a);
    },
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

  const cambios = {};

  const formularios = {
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
      if (fallos.length) {
        error.hidden = false;
        error.textContent = `Revisa: ${fallos.join(', ')}.`;
        return;
      }
      const id = form.dataset.id;
      ctx.guardar({ ...ctx.datos, alimentos: ctx.datos.alimentos.map((x) => (x.id === id ? { ...x, nombre, marca: form.elements.marca.value.trim(), unidad: form.elements.unidad.value === 'ml' ? 'ml' : 'g', racion, por100 } : x)) }, { pintar: false });
      ctx.hojas.cerrar(m.editando);
      pintarLista();
      ctx.tostada(`«${nombre}» guardado`);
    },
  };

  // La unidad cambia las etiquetas al momento.
  cambios['ma-unidad'] = (el) => {
    const f = el.form;
    f.querySelector('[data-ma-unidad]').dataset.unidad = el.value;
    f.querySelector('[data-ma-por]').textContent = `Por cada 100 ${el.value}`;
  };

  return { abrir, acciones, entradas, cambios, formularios, repintar: () => m && pintarLista() };
}
