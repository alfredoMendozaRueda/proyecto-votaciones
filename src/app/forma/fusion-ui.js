// Fusionar duplicados y «Posibles duplicados», igual para Mis alimentos y la
// biblioteca de ejercicios. Las acciones llevan el tipo en el nombre
// (fu-alimentos-…, fu-ejercicios-…) para que no se pisen entre sí.
import { fusionarAlimentos, fusionarEjercicios, posiblesDuplicados, noSonElMismo, catalogoParaIA } from '../../compartido/forma/catalogo.js';
import { ic, escapar, num } from './ui.js';

const TEXTOS = {
  alimentos: { uno: 'alimento', varios: 'alimentos' },
  ejercicios: { uno: 'ejercicio', varios: 'ejercicios' },
};

export function crearFusion(ctx, { tipo, alTerminar }) {
  const t = TEXTOS[tipo];
  const lista = () => (tipo === 'alimentos' ? ctx.datos.alimentos : ctx.datos.ejercicios.filter((e) => !e.oculto));
  const buscar = (eid) => lista().find((x) => x.id === eid);
  let hoja = null;

  // Qué cuelga de cada uno (para decidir cuál conservar y explicar qué se mueve).
  function usos(x) {
    const d = ctx.datos;
    if (tipo === 'alimentos') {
      const registros = d.registros.filter((r) => r.alimentoId === x.id).length;
      const plantillas = d.plantillas.filter((p) => p.items.some((i) => i.alimentoId === x.id)).length;
      return { total: registros + plantillas, texto: [registros && `${registros} ${registros === 1 ? 'comida apuntada' : 'comidas apuntadas'}`, plantillas && `${plantillas} ${plantillas === 1 ? 'plantilla' : 'plantillas'}`].filter(Boolean).join(' · ') || 'sin usar' };
    }
    const series = d.sesiones.reduce((n, s) => n + s.series.filter((y) => y.ejercicioId === x.id).length, 0);
    const rutinas = d.rutinas.filter((r) => r.ejercicios.some((y) => y.ejercicioId === x.id)).length;
    return { total: series + rutinas, texto: [series && `${series} series`, rutinas && `${rutinas} ${rutinas === 1 ? 'rutina' : 'rutinas'}`].filter(Boolean).join(' · ') || 'sin usar' };
  }

  const detalle = (x) =>
    tipo === 'alimentos'
      ? [x.marca, `${num(x.por100.kcal ?? 0)} kcal · ${num(x.por100.proteina ?? 0, 1)} g P /100 ${x.unidad}`].filter(Boolean).join(' · ')
      : [x.grupo, x.propio ? 'tuyo' : 'de serie'].join(' · ');

  // Elegir cuál se conserva (por defecto, el más usado) y fusionar.
  function abrir(ids) {
    const elegidos = ids.map(buscar).filter(Boolean);
    if (elegidos.length < 2) return ctx.tostada(`Elige al menos dos ${t.varios}.`);
    // Por defecto, el más usado (veces que lo has añadido + lo que cuelga de él); en ejercicios, a igualdad, el de serie.
    const peso = (x) => usos(x).total + (x.veces ?? 0);
    const conservar = [...elegidos].sort((a, b) => peso(b) - peso(a) || (b.propio === false) - (a.propio === false))[0].id;
    hoja = ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Fusionar</h2></div>
       <p class="f-tenue">Elige cuál se conserva. Los demás desaparecen${tipo === 'ejercicios' ? ' (los de serie quedan ocultos)' : ''}, sus nombres pasan a ser alias y todo lo suyo (${tipo === 'alimentos' ? 'comidas apuntadas y plantillas' : 'series de tus entrenos, rutinas e hitos'}) pasa al que conservas.${tipo === 'alimentos' ? ' Lo ya apuntado conserva sus kcal y macros.' : ''}</p>
       <form class="f-columna" data-form="fu-${tipo}-confirmar" data-ids="${ids.join(',')}">
         <div class="f-lista">${elegidos
           .map(
             (x) => `<label class="f-item f-fu">
               <input type="radio" name="conservar" value="${x.id}" ${x.id === conservar ? 'checked' : ''}>
               <span class="f-item__texto"><span class="f-item__nombre">${escapar(x.nombre)}</span><span class="f-item__detalle">${escapar(detalle(x))}</span><span class="f-item__detalle">${escapar(usos(x).texto)}${x.alias?.length ? ` · alias: ${escapar(x.alias.join(', '))}` : ''}</span></span>
             </label>`,
           )
           .join('')}</div>
         <p class="f-error" data-fu-error hidden></p>
         <button type="submit" class="f-boton f-boton--azul f-boton--ancho">${ic('check', 16)}Fusionar ${elegidos.length} ${t.varios}</button>
       </form>`,
      { titulo: 'Fusionar' },
    );
  }

  function confirmar(form) {
    const conservar = form.elements.conservar.value;
    const ids = form.dataset.ids.split(',');
    const antes = ctx.datos;
    let nuevos;
    try {
      nuevos = (tipo === 'alimentos' ? fusionarAlimentos : fusionarEjercicios)(antes, conservar, ids);
    } catch (error) {
      const p = form.querySelector('[data-fu-error]');
      p.hidden = false;
      p.textContent = error.message;
      return;
    }
    const nombre = buscar(conservar)?.nombre ?? '';
    ctx.guardar(nuevos, { pintar: false });
    ctx.hojas.cerrar(hoja);
    alTerminar?.();
    ctx.tostada(`Fusionados en «${nombre}»`, {
      accion: () => {
        ctx.guardar(antes, { pintar: false });
        alTerminar?.();
      },
      ms: 7000,
    });
  }

  // Sección «Posibles duplicados» (o nada si no hay).
  function htmlDuplicados(max = 6) {
    const pares = posiblesDuplicados(ctx.datos, tipo, max);
    if (!pares.length) return '';
    return `<section class="f-columna f-fu-duplicados" style="gap:0">
      <span class="f-etiqueta">Posibles duplicados <b>${pares.length}</b></span>
      <div class="f-lista">${pares
        .map(
          (p) => `<div class="f-item f-fu-par">
            <span class="f-item__texto"><span class="f-item__nombre">${escapar(p.a.nombre)} <span class="f-tenue">≈</span> ${escapar(p.b.nombre)}</span><span class="f-item__detalle">${escapar(detalle(p.a))} | ${escapar(detalle(p.b))} · parecido ${Math.round(p.similitud * 100)}&nbsp;%</span></span>
            <span class="f-fu-par__botones">
              <button type="button" class="f-boton f-boton--chico" data-a="fu-${tipo}-par" data-ids="${p.a.id},${p.b.id}">Fusionar</button>
              <button type="button" class="f-enlace" data-a="fu-${tipo}-no" data-ids="${p.a.id},${p.b.id}">No son el mismo</button>
            </span>
          </div>`,
        )
        .join('')}</div>
    </section>`;
  }

  async function copiarCatalogo() {
    try {
      await navigator.clipboard.writeText(catalogoParaIA(ctx.datos));
      ctx.tostada('Catálogo copiado. Pégaselo a la IA antes de pedirle el JSON.', { ms: 5000 });
    } catch {
      ctx.tostada('No he podido copiar. Prueba otra vez.');
    }
  }

  const acciones = {
    [`fu-${tipo}-par`]: (el) => abrir(el.dataset.ids.split(',')),
    [`fu-${tipo}-no`]: (el) => {
      const [a, b] = el.dataset.ids.split(',');
      ctx.guardar(noSonElMismo(ctx.datos, a, b), { pintar: false });
      alTerminar?.();
    },
    [`fu-${tipo}-catalogo`]: () => copiarCatalogo(),
  };
  const formularios = { [`fu-${tipo}-confirmar`]: (form) => confirmar(form) };

  return { abrir, htmlDuplicados, acciones, formularios, cambios: {}, entradas: {} };
}
