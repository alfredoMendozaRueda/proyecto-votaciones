// Añadir comida: pensado para que cueste 3 toques o menos.
//   + → toca el «+» de un reciente → apuntado (con «Deshacer»).
// También: buscar en tus alimentos o en Open Food Facts, escanear el código de
// barras, escribirlo a mano, estimarlo con la IA (texto o foto), comida libre
// de restaurante y plantillas.
import { buscarLocal, recientes, favoritos, buscarEnOpenFoodFacts, buscarProducto, guardarAlimento } from '../../compartido/forma/alimentos.js';
import { nutrientesDe, momentoPorHora, totales, comidasHabituales } from '../../compartido/forma/diario.js';
import { apuntar, contarUsoIA, borrarPlantilla } from '../../compartido/forma/acciones.js';
import { peticionEstimar, leerEstimacion, macrosDeKcal, puedeUsarIA } from '../../compartido/forma/ia.js';
import { minutosDe } from '../../compartido/forma/fechas.js';
import { ic, escapar, num, fotoReducida, vibrar } from './ui.js';

export function crearAnadir(ctx) {
  let s = null; // estado de la hoja abierta
  let lector = null; // escáner en marcha

  const ahoraMin = () => minutosDe(new Date());
  const nombreMomento = (id) => ctx.datos.momentos.find((m) => m.id === id)?.nombre ?? 'Comida';

  function abrir({ fecha = ctx.hoy(), momento = null, escaner = false } = {}) {
    const minuto = fecha === ctx.hoy() ? ahoraMin() : 13 * 60;
    s = { fecha, momento: momento ?? momentoPorHora(ctx.datos.momentos, minuto), minuto: momento ? minutosDe(ctx.datos.momentos.find((m) => m.id === momento)?.hora) ?? minuto : minuto, texto: '', off: null, buscando: false, anadidos: 0 };
    if (fecha === ctx.hoy() && momento) s.minuto = Math.max(s.minuto, 0);
    s.hoja = ctx.hojas.abrir(cuerpo(), { clase: 'f-hoja--alta', titulo: 'Añadir comida', alCerrar: () => (s = null) });
    if (escaner) abrirEscaner();
  }

  function cabecera() {
    return `<div class="f-hoja__titulo"><h2>Añadir</h2>${s.anadidos ? `<button type="button" class="f-boton f-boton--azul f-boton--chico" data-cerrar-hoja>${ic('check', 15)}Listo · ${s.anadidos}</button>` : ''}</div>
      <div class="f-chips f-chips--fila" role="group" aria-label="Momento">${ctx.datos.momentos.map((m) => `<button type="button" class="f-chip" data-a="an-momento" data-id="${m.id}" aria-pressed="${m.id === s.momento}">${escapar(m.nombre)}</button>`).join('')}</div>`;
  }

  function cuerpo() {
    return `<div data-an-cab>${cabecera()}</div>
      <div class="f-buscador">${ic('buscar', 17)}<input class="f-entrada" type="search" placeholder="Buscar alimento o marca" data-entrada="an-buscar" enterkeyhint="search" autocomplete="off" value="${escapar(s.texto)}"></div>
      <div class="f-accesos">
        <button type="button" class="f-acceso" data-a="an-escaner">${ic('escaner', 22)}Escanear</button>
        <button type="button" class="f-acceso" data-a="an-ia">${ic('chispa', 22)}Con IA</button>
        <button type="button" class="f-acceso" data-a="an-manual">${ic('lapiz', 22)}Manual</button>
        <button type="button" class="f-acceso" data-a="an-libre">${ic('restaurante', 22)}Fuera</button>
        <button type="button" class="f-acceso" data-a="an-plantillas">${ic('plantilla', 22)}Plantillas</button>
      </div>
      <div class="f-columna" data-an-lista>${lista()}</div>`;
  }

  const fila = (a, { off = false, i = 0 } = {}) => {
    const r = nutrientesDe(a, a.racion);
    return `<div class="f-item" style="cursor:pointer" data-a="${off ? 'an-off' : 'an-elegir'}" data-id="${off ? i : a.id}">
      <span class="f-item__texto"><span class="f-item__nombre">${a.favorito ? `<span style="color:var(--f-azul-2)">★</span> ` : ''}${escapar(a.nombre)}</span>
      <span class="f-item__detalle">${escapar(a.marca ? `${a.marca} · ` : '')}${num(a.racion)} g · ${num(r.kcal ?? 0)} kcal · ${num(r.proteina ?? 0)} g P${off && a.faltan?.length ? ' · faltan datos' : ''}</span></span>
      ${off ? `<span class="f-item__kcal">${num(a.por100.kcal)}<small> /100 g</small></span>` : `<button type="button" class="f-item__mas" data-a="an-rapido" data-id="${a.id}" aria-label="Añadir ${escapar(a.nombre)} (${num(a.racion)} g)">${ic('mas', 16)}</button>`}
    </div>`;
  };

  function lista() {
    const d = ctx.datos;
    if (s.texto.trim()) {
      const locales = buscarLocal(d, s.texto);
      const off = s.off;
      return `${locales.length ? `<span class="f-etiqueta">Tus alimentos</span><div class="f-lista">${locales.map((a) => fila(a)).join('')}</div>` : ''}
        ${
          off
            ? off.length
              ? `<span class="f-etiqueta">Open Food Facts <b>datos abiertos · ODbL</b></span><div class="f-lista">${off.map((a, i) => fila(a, { off: true, i })).join('')}</div>`
              : '<p class="f-tenue">Open Food Facts no ha encontrado nada con ese nombre. Prueba con la marca, escanea el código o añádelo a mano.</p>'
            : `<button type="button" class="f-boton f-boton--ancho" data-a="an-buscar-off" ${s.buscando ? 'disabled' : ''}>${s.buscando ? '<span class="f-cargando"></span>Buscando…' : `${ic('buscar', 16)}Buscar «${escapar(s.texto.trim())}» en Open Food Facts`}</button>`
        }
        <p class="f-error" data-an-error hidden></p>`;
    }
    const rec = recientes(d, 12);
    const fav = favoritos(d).filter((a) => !rec.includes(a));
    if (!rec.length && !fav.length) return '<p class="f-tenue">Aún no tienes alimentos. Búscalos, escanea su código de barras o añádelos a mano: luego aparecerán aquí para añadirlos de un toque.</p>';
    const habituales = s.fecha === ctx.hoy() ? comidasHabituales(d, s.fecha, ahoraMin()) : [];
    return `${
      habituales.length
        ? `<span class="f-etiqueta">Lo de siempre</span><div class="f-lista">${habituales
            .map((h) => `<div class="f-item"><span class="f-item__texto"><span class="f-item__nombre">${escapar(h.nombre)}</span><span class="f-item__detalle">${num(h.kcal)} kcal · ${num(h.proteina)} g P · ${h.veces} veces</span></span><button type="button" class="f-item__mas" data-a="an-habitual" data-firma="${escapar(h.firma)}" aria-label="Repetir ${escapar(h.nombre)}">${ic('mas', 16)}</button></div>`)
            .join('')}</div>`
        : ''
    }${rec.length ? `<span class="f-etiqueta">Recientes <b>+ añade una ración</b></span><div class="f-lista">${rec.map((a) => fila(a)).join('')}</div>` : ''}
      ${fav.length ? `<span class="f-etiqueta">Favoritos</span><div class="f-lista">${fav.map((a) => fila(a)).join('')}</div>` : ''}`;
  }

  function repintarLista() {
    s?.hoja?.cuerpo.querySelector('[data-an-lista]')?.replaceChildren(document.createRange().createContextualFragment(lista()));
  }

  function repintarCabecera() {
    const c = s?.hoja?.cuerpo.querySelector('[data-an-cab]');
    if (c) c.innerHTML = cabecera();
  }

  // Apunta y deja la hoja abierta por si añades más cosas a la misma comida.
  function apuntarYSeguir(items, texto) {
    const antes = ctx.datos;
    const { datos } = apuntar(ctx.datos, { fecha: s.fecha, momento: s.momento, minuto: s.minuto, items });
    vibrar(18);
    ctx.guardar(datos, { pintar: false });
    ctx.repintar();
    s.anadidos += items.length;
    repintarCabecera();
    repintarLista();
    ctx.tostada(`${texto} → ${nombreMomento(s.momento)}`, { accion: () => ctx.guardar(antes) });
  }

  // ---------- Cantidad ----------
  function hojaCantidad(alimento) {
    const fuera = !alimento.id;
    const raciones = [
      [0.5, '½ ración'],
      [1, '1 ración'],
      [1.5, '1½'],
      [2, '2 raciones'],
    ];
    const hoja = ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>${escapar(alimento.nombre)}</h2>${!fuera ? `<button type="button" class="f-icono-boton" data-a="an-favorito" data-id="${alimento.id}" aria-pressed="${alimento.favorito}" aria-label="Favorito" style="${alimento.favorito ? 'color:var(--f-azul-2);border-color:var(--f-azul)' : ''}">${ic('estrella', 17)}</button>` : ''}</div>
       <p class="f-tenue">${escapar(alimento.marca ? `${alimento.marca} · ` : '')}Por 100 g: ${num(alimento.por100.kcal ?? 0)} kcal · P ${num(alimento.por100.proteina ?? 0, 1)} · H ${num(alimento.por100.hidratos ?? 0, 1)} · G ${num(alimento.por100.grasa ?? 0, 1)}</p>
       ${alimento.faltan?.length ? `<p class="f-tenue" style="color:var(--f-aviso)">A este producto le faltan datos (${alimento.faltan.join(', ')}). Cuentan como 0 hasta que los completes en Manual.</p>` : ''}
       <form class="f-columna" data-form="an-cantidad">
         <label class="f-campo"><span>Cantidad${alimento.racionNombre ? ` · ración: ${escapar(alimento.racionNombre)}` : ''}</span><div class="f-con-unidad" data-unidad="g"><input class="f-entrada" name="gramos" type="text" inputmode="decimal" autocomplete="off" step="any" value="${alimento.racion}" data-entrada="an-gramos" required></div></label>
         <div class="f-chips">${raciones.map(([f, t]) => `<button type="button" class="f-chip" data-a="an-racion" data-g="${Math.round(alimento.racion * f)}">${t} · ${num(Math.round(alimento.racion * f))} g</button>`).join('')}</div>
         <div class="f-previa" data-an-previa>${previa(alimento, alimento.racion)}</div>
         <button type="submit" class="f-boton f-boton--azul f-boton--ancho">${ic('mas', 16)}Añadir a ${escapar(nombreMomento(s.momento).toLowerCase())}</button>
       </form>`,
      { titulo: alimento.nombre },
    );
    hoja.alimento = alimento;
    s.cantidad = hoja;
  }

  function previa(a, g) {
    const n = nutrientesDe(a, Number(g) || 0);
    return `<div><b>${num(n.kcal ?? 0)}</b><span>kcal</span></div><div><b>${num(n.proteina ?? 0, 1)}</b><span>prot.</span></div><div><b>${num(n.hidratos ?? 0, 1)}</b><span>hidr.</span></div><div><b>${num(n.grasa ?? 0, 1)}</b><span>grasa</span></div>`;
  }

  // ---------- Escáner ----------
  async function abrirEscaner() {
    const hoja = ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Escanear</h2></div>
       <div class="f-escaner"><video playsinline muted></video><div class="f-escaner__marco"></div></div>
       <p class="f-tenue" data-esc-estado>Apunta al código de barras del envase.</p>
       <form class="f-fila" data-form="an-codigo"><input class="f-entrada" name="codigo" inputmode="numeric" placeholder="O escribe el código" autocomplete="off"><button type="submit" class="f-boton">Buscar</button></form>`,
      { titulo: 'Escanear', alCerrar: () => parar() },
    );
    const video = hoja.cuerpo.querySelector('video');
    const estado = hoja.cuerpo.querySelector('[data-esc-estado]');
    try {
      const { BrowserMultiFormatReader } = await import('@zxing/browser');
      const lectorZ = new BrowserMultiFormatReader();
      let hecho = false;
      lector = await lectorZ.decodeFromConstraints({ video: { facingMode: 'environment' } }, video, (resultado) => {
        if (!resultado || hecho) return;
        hecho = true;
        vibrar(30);
        parar();
        ctx.hojas.cerrar(hoja);
        porCodigo(resultado.getText());
      });
    } catch (error) {
      estado.textContent = error?.name === 'NotAllowedError' ? 'No tengo permiso para usar la cámara. Actívalo en los ajustes del navegador o escribe el código.' : 'No he podido abrir la cámara. Escribe el código de barras debajo.';
      estado.style.color = 'var(--f-aviso)';
    }
  }

  function parar() {
    try {
      lector?.stop();
    } catch {
      // Ya estaba parado.
    }
    lector = null;
  }

  async function porCodigo(codigo) {
    codigo = String(codigo).replace(/\D/g, '');
    if (!codigo) return;
    const propio = ctx.datos.alimentos.find((a) => a.codigo === codigo);
    if (propio) return hojaCantidad(propio);
    ctx.tostada('Buscando el producto…', { ms: 8000 });
    try {
      const a = await buscarProducto(codigo);
      if (a && a.por100.kcal !== undefined) return hojaCantidad(a);
      ctx.tostada(a ? 'El producto existe pero no tiene calorías: complétalo a mano.' : 'No está en Open Food Facts: añádelo a mano y se quedará guardado.');
      hojaManual({ ...(a ?? {}), codigo });
    } catch (error) {
      ctx.tostada(error.message);
      hojaManual({ codigo });
    }
  }

  // ---------- Manual ----------
  function hojaManual(base = {}) {
    const p = base.por100 ?? {};
    const campo = (k, t, req = false) => `<label class="f-campo"><span>${t}${req ? '' : ' (opc.)'}</span><input class="f-entrada" name="${k}" type="text" inputmode="decimal" autocomplete="off" step="any" min="0" value="${p[k] ?? ''}" ${req ? 'required' : ''}></label>`;
    ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>${base.nombre ? 'Revisar alimento' : 'Nuevo alimento'}</h2></div>
       <form class="f-columna" data-form="an-manual">
         <label class="f-campo"><span>Nombre</span><input class="f-entrada" name="nombre" required value="${escapar(base.nombre ?? '')}" placeholder="Tortilla de patatas"></label>
         <div class="f-rejilla-2">
           <label class="f-campo"><span>Marca (opc.)</span><input class="f-entrada" name="marca" value="${escapar(base.marca ?? '')}"></label>
           <label class="f-campo"><span>Ración habitual</span><div class="f-con-unidad" data-unidad="g"><input class="f-entrada" name="racion" type="text" inputmode="decimal" autocomplete="off" step="any" value="${base.racion ?? 100}" required></div></label>
         </div>
         <span class="f-etiqueta">Por cada 100 g</span>
         <div class="f-rejilla-2">${campo('kcal', 'Kcal', true)}${campo('proteina', 'Proteína (g)', true)}${campo('hidratos', 'Hidratos (g)', true)}${campo('azucares', 'Azúcares (g)')}${campo('grasa', 'Grasa (g)', true)}${campo('saturadas', 'Saturadas (g)')}${campo('fibra', 'Fibra (g)')}${campo('sal', 'Sal (g)')}</div>
         <input type="hidden" name="codigo" value="${escapar(base.codigo ?? '')}">
         <input type="hidden" name="origen" value="${escapar(base.origen ?? 'manual')}">
         <label class="f-campo"><span>Lo que comes ahora</span><div class="f-con-unidad" data-unidad="g"><input class="f-entrada" name="gramos" type="text" inputmode="decimal" autocomplete="off" step="any" value="${base.racion ?? 100}"></div></label>
         <div class="f-fila">
           <button type="submit" class="f-boton" name="solo" value="1">Solo guardar</button>
           <button type="submit" class="f-boton f-boton--azul" style="flex:1">Guardar y añadir</button>
         </div>
       </form>`,
      { titulo: 'Nuevo alimento' },
    );
  }

  // ---------- IA ----------
  function hojaIA() {
    const hoja = ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Estimar con IA</h2></div>
       <form class="f-columna" data-form="an-ia">
         <textarea class="f-entrada" name="texto" placeholder="Ej.: 2 bocadillos de jamón de panadería, poco relleno, y una caña" maxlength="600"></textarea>
         <button type="submit" class="f-boton f-boton--azul">${ic('chispa', 16)}Estimar</button>
       </form>
       <div class="f-rejilla-2">
         <label class="f-boton" style="position:relative">${ic('camara', 16)}Foto del plato<input type="file" accept="image/*" capture="environment" data-cambio="an-foto" data-tipo="plato" style="position:absolute;inset:0;opacity:0"></label>
         <label class="f-boton" style="position:relative">${ic('foto', 16)}Foto de la etiqueta<input type="file" accept="image/*" capture="environment" data-cambio="an-foto" data-tipo="etiqueta" style="position:absolute;inset:0;opacity:0"></label>
       </div>
       <div data-ia-resultado></div>
       <p class="f-tenue">La IA estima; revisa y corrige antes de añadir. Quedará marcado como «estimado». Hoy llevas ${ctx.datos.usosIA[ctx.hoy()] ?? 0} de ${ctx.datos.ajustes.limiteIA} usos.</p>`,
      { clase: 'f-hoja--alta', titulo: 'Estimar con IA' },
    );
    s.ia = hoja;
  }

  async function estimar({ texto = '', imagen = null, etiqueta = false }) {
    const caja = s.ia?.cuerpo.querySelector('[data-ia-resultado]');
    if (!caja) return;
    if (!ctx.api.ia?.tarea) return (caja.innerHTML = '<p class="f-error">Para usar la IA, añade una clave en Kitsune → Ajustes → IA.</p>');
    if (!puedeUsarIA(ctx.datos, ctx.hoy())) return (caja.innerHTML = `<p class="f-error">Has llegado al límite de ${ctx.datos.ajustes.limiteIA} usos de la IA por hoy.</p>`);
    caja.innerHTML = `<div class="f-estimado"><p class="f-fila"><span class="f-cargando"></span>${imagen ? 'Mirando la foto…' : 'Estimando…'}</p>${imagen ? `<img src="${imagen.url}" alt="" style="width:100%;max-height:200px;object-fit:cover;border-radius:10px">` : ''}</div>`;
    try {
      const r = await ctx.api.ia.tarea({ ...peticionEstimar({ descripcion: texto, conFoto: Boolean(imagen), etiqueta }), ...(imagen ? { imagen: { tipo: imagen.tipo, datos: imagen.datos } } : {}) });
      ctx.guardar(contarUsoIA(ctx.datos, ctx.hoy()), { pintar: false });
      const items = leerEstimacion(r.texto);
      if (etiqueta) {
        const x = items[0];
        const f = 100 / (x.gramos || 100);
        ctx.hojas.cerrar(s.ia);
        return hojaManual({ nombre: x.nombre, racion: 100, origen: 'ia', por100: { kcal: Math.round(x.kcal * f), proteina: +(x.proteina * f).toFixed(1), hidratos: +(x.hidratos * f).toFixed(1), grasa: +(x.grasa * f).toFixed(1), fibra: +(x.fibra * f).toFixed(1) } });
      }
      s.estimacion = items;
      pintarEstimacion();
    } catch (error) {
      caja.innerHTML = `<p class="f-error">${escapar(error.message)}</p>`;
    }
  }

  function pintarEstimacion() {
    const caja = s.ia?.cuerpo.querySelector('[data-ia-resultado]');
    if (!caja) return;
    const items = s.estimacion ?? [];
    const t = totales(items);
    caja.innerHTML = `<div class="f-estimado">
      <div class="f-fila f-entre"><span class="f-etiqueta">Estimación</span><span class="f-suave" style="font-size:13px">${num(t.kcal)} kcal · ${num(t.proteina)} g P</span></div>
      ${items
        .map(
          (x, i) => `<div class="f-columna" style="gap:6px;padding-top:8px;border-top:1px solid var(--f-linea)">
          <div class="f-fila"><input class="f-entrada" style="min-height:38px;font-size:14px" value="${escapar(x.nombre)}" data-entrada="an-est" data-i="${i}" data-k="nombre"><span class="f-confianza">${Math.round(x.confianza * 100)} %</span>
          <button type="button" class="f-icono-boton" data-a="an-est-quitar" data-i="${i}" aria-label="Quitar">${ic('cerrar', 14)}</button></div>
          <div class="f-estimado__fila">${['gramos', 'kcal', 'proteina', 'hidratos', 'grasa']
            .map((k) => `<label>${{ gramos: 'g', kcal: 'kcal', proteina: 'P', hidratos: 'H', grasa: 'G' }[k]}<input class="f-entrada" type="text" inputmode="decimal" autocomplete="off" step="any" value="${x[k]}" data-entrada="an-est" data-i="${i}" data-k="${k}"></label>`)
            .join('')}</div></div>`,
        )
        .join('')}
      <button type="button" class="f-boton f-boton--azul" data-a="an-est-anadir" ${items.length ? '' : 'disabled'}>${ic('mas', 16)}Añadir ${items.length} ${items.length === 1 ? 'alimento' : 'alimentos'}</button>
    </div>`;
  }

  // ---------- Comida libre (restaurante) ----------
  function hojaLibre() {
    ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Comida fuera</h2></div>
       <p class="f-tenue">Para el restaurante o una comida que no quieres desglosar: pon las kcal a ojo o descríbela y la IA la estima en bloque.</p>
       <form class="f-columna" data-form="an-libre">
         <label class="f-campo"><span>Qué es</span><input class="f-entrada" name="nombre" placeholder="Menú del día, hamburguesa con patatas…"></label>
         <div class="f-rejilla-2">
           <label class="f-campo"><span>Kcal aproximadas</span><input class="f-entrada" name="kcal" type="number" inputmode="numeric"></label>
           <label class="f-campo"><span>Proteína (opc.)</span><div class="f-con-unidad" data-unidad="g"><input class="f-entrada" name="proteina" type="number" inputmode="numeric"></div></label>
         </div>
         <div class="f-fila">
           <button type="submit" class="f-boton" name="ia" value="1" ${ctx.api.ia?.tarea ? '' : 'disabled'}>${ic('chispa', 16)}Que la estime la IA</button>
           <button type="submit" class="f-boton f-boton--azul" style="flex:1">Añadir</button>
         </div>
         <p class="f-error" data-libre-error hidden></p>
       </form>`,
      { titulo: 'Comida fuera' },
    );
  }

  function hojaPlantillas() {
    const t = ctx.datos.plantillas;
    ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Plantillas</h2></div>
       ${
         t.length
           ? `<div class="f-lista">${t
               .map((p) => {
                 const tot = totales(p.items);
                 return `<div class="f-item" style="cursor:pointer" data-a="an-plantilla" data-id="${p.id}"><span class="f-item__texto"><span class="f-item__nombre">${escapar(p.nombre)}</span><span class="f-item__detalle">${escapar(p.items.map((x) => x.nombre).join(', '))}</span></span><span class="f-item__kcal">${num(tot.kcal)} <small>kcal</small></span>
                 <button type="button" class="f-icono-boton" style="border:0;background:none" data-a="an-plantilla-borrar" data-id="${p.id}" aria-label="Borrar plantilla">${ic('basura', 15)}</button></div>`;
               })
               .join('')}</div>`
           : '<p class="f-tenue">Aún no tienes plantillas. En el Diario, «Copiar · plantillas» guarda una comida del día para repetirla de un toque.</p>'
       }`,
      { titulo: 'Plantillas' },
    );
  }

  // ---------- Acciones ----------
  const acciones = {
    'an-momento': (el) => {
      s.momento = el.dataset.id;
      const m = ctx.datos.momentos.find((x) => x.id === s.momento);
      if (s.fecha !== ctx.hoy()) s.minuto = minutosDe(m.hora) ?? s.minuto;
      repintarCabecera();
    },
    'an-elegir': (el, e) => {
      if (e.target.closest('[data-a="an-rapido"]')) return;
      const a = ctx.datos.alimentos.find((x) => x.id === el.dataset.id);
      if (a) hojaCantidad(a);
    },
    'an-rapido': (el) => {
      const a = ctx.datos.alimentos.find((x) => x.id === el.dataset.id);
      if (a) apuntarYSeguir([{ ...nutrientesDe(a, a.racion), nombre: a.nombre, alimentoId: a.id, gramos: a.racion }], `${a.nombre} · ${num(a.racion)} g`);
    },
    'an-habitual': (el) => {
      const h = comidasHabituales(ctx.datos, s.fecha, ahoraMin()).find((x) => x.firma === el.dataset.firma);
      if (!h) return;
      s.momento = h.momento;
      repintarCabecera();
      apuntarYSeguir(
        h.items.map(({ id: _i, fecha: _f, creado: _c, minuto: _m, momento: _mo, ...x }) => x),
        h.nombre,
      );
    },
    'an-off': (el) => {
      const a = s.off?.[Number(el.dataset.id)];
      if (a) hojaCantidad(a);
    },
    'an-buscar-off': async () => {
      s.buscando = true;
      repintarLista();
      try {
        s.off = await buscarEnOpenFoodFacts(s.texto.trim());
      } catch (error) {
        s.off = null;
        s.buscando = false;
        repintarLista();
        const p = s.hoja.cuerpo.querySelector('[data-an-error]');
        if (p) {
          p.hidden = false;
          p.textContent = error.message;
        }
        return;
      }
      s.buscando = false;
      repintarLista();
    },
    'an-racion': (el) => {
      const form = s.cantidad?.cuerpo.querySelector('form');
      if (!form) return;
      form.elements.gramos.value = el.dataset.g;
      entradas['an-gramos'](form.elements.gramos);
    },
    'an-favorito': (el) => {
      const a = ctx.datos.alimentos.find((x) => x.id === el.dataset.id);
      if (!a) return;
      const nuevo = !a.favorito;
      ctx.guardar({ ...ctx.datos, alimentos: ctx.datos.alimentos.map((x) => (x.id === a.id ? { ...x, favorito: nuevo } : x)) }, { pintar: false });
      el.setAttribute('aria-pressed', String(nuevo));
      el.style.cssText = nuevo ? 'color:var(--f-azul-2);border-color:var(--f-azul)' : '';
      repintarLista();
    },
    'an-escaner': () => abrirEscaner(),
    'an-manual': () => hojaManual({ nombre: s.texto.trim() }),
    'an-ia': () => hojaIA(),
    'an-libre': () => hojaLibre(),
    'an-plantillas': () => hojaPlantillas(),
    'an-plantilla': (el, e) => {
      if (e.target.closest('[data-a="an-plantilla-borrar"]')) return;
      const p = ctx.datos.plantillas.find((x) => x.id === el.dataset.id);
      if (!p) return;
      ctx.hojas.cerrar();
      apuntarYSeguir(
        p.items.map(({ id: _i, fecha: _f, creado: _c, minuto: _m, momento: _mo, ...x }) => x),
        p.nombre,
      );
    },
    'an-plantilla-borrar': (el) => {
      ctx.guardar(borrarPlantilla(ctx.datos, el.dataset.id), { pintar: false });
      ctx.hojas.cerrar();
      hojaPlantillas();
    },
    'an-est-quitar': (el) => {
      s.estimacion.splice(Number(el.dataset.i), 1);
      pintarEstimacion();
    },
    'an-est-anadir': () => {
      const items = (s.estimacion ?? []).filter((x) => x.nombre && x.kcal >= 0).map((x) => ({ nombre: x.nombre, gramos: x.gramos, kcal: Math.round(x.kcal), proteina: x.proteina, hidratos: x.hidratos, grasa: x.grasa, fibra: x.fibra, estimado: true }));
      if (!items.length) return;
      ctx.hojas.cerrar(s.ia);
      s.estimacion = null;
      apuntarYSeguir(items, `${items.length} ${items.length === 1 ? 'alimento estimado' : 'alimentos estimados'}`);
    },
  };

  let temporizadorBusqueda = null;
  const entradas = {
    'an-buscar': (el) => {
      s.texto = el.value;
      s.off = null;
      clearTimeout(temporizadorBusqueda);
      temporizadorBusqueda = setTimeout(repintarLista, 120);
    },
    'an-gramos': (el) => {
      const caja = s.cantidad?.cuerpo.querySelector('[data-an-previa]');
      if (caja) caja.innerHTML = previa(s.cantidad.alimento, el.value);
    },
    'an-est': (el) => {
      const x = s.estimacion?.[Number(el.dataset.i)];
      if (!x) return;
      const k = el.dataset.k;
      x[k] = k === 'nombre' ? el.value : Math.max(0, Number(el.value) || 0);
    },
  };

  const cambios = {
    'an-foto': async (el) => {
      const archivo = el.files?.[0];
      el.value = '';
      if (!archivo) return;
      try {
        const imagen = await fotoReducida(archivo);
        await estimar({ imagen, etiqueta: el.dataset.tipo === 'etiqueta' });
      } catch (error) {
        ctx.tostada(error.message);
      }
    },
  };

  const formularios = {
    'an-cantidad': (form) => {
      const g = Number(form.elements.gramos.value);
      if (!(g > 0)) return;
      let a = s.cantidad.alimento;
      if (!a.id) {
        // De Open Food Facts: se guarda en tu catálogo para la próxima vez.
        const r = guardarAlimento(ctx.datos, a);
        ctx.guardar(r.datos, { pintar: false });
        a = r.alimento;
      }
      ctx.hojas.cerrar(s.cantidad);
      apuntarYSeguir([{ ...nutrientesDe(a, g), nombre: a.nombre, alimentoId: a.id, gramos: g }], `${a.nombre} · ${num(g)} g`);
    },
    'an-codigo': (form) => {
      const codigo = form.elements.codigo.value;
      parar();
      ctx.hojas.cerrar();
      porCodigo(codigo);
    },
    'an-manual': (form, e) => {
      const v = (k) => {
        const n = Number(String(form.elements[k].value).replace(',', '.'));
        return form.elements[k].value === '' || !Number.isFinite(n) ? undefined : n;
      };
      const nombre = form.elements.nombre.value.trim();
      if (!nombre || v('kcal') === undefined) return;
      const por100 = {};
      for (const k of ['kcal', 'proteina', 'hidratos', 'azucares', 'grasa', 'saturadas', 'fibra', 'sal']) if (v(k) !== undefined) por100[k] = v(k);
      const { datos, alimento } = guardarAlimento(ctx.datos, { nombre, marca: form.elements.marca.value.trim(), racion: v('racion') || 100, por100, codigo: form.elements.codigo.value, origen: form.elements.origen.value || 'manual' });
      ctx.guardar(datos, { pintar: false });
      ctx.hojas.cerrar();
      const solo = e.submitter?.name === 'solo';
      if (solo) {
        repintarLista();
        return ctx.tostada(`«${nombre}» guardado en tus alimentos`);
      }
      const g = v('gramos') || alimento.racion;
      apuntarYSeguir([{ ...nutrientesDe(alimento, g), nombre: alimento.nombre, alimentoId: alimento.id, gramos: g }], `${alimento.nombre} · ${num(g)} g`);
    },
    'an-ia': (form) => {
      const texto = form.elements.texto.value.trim();
      if (texto) estimar({ texto });
    },
    'an-libre': async (form, e) => {
      const nombre = form.elements.nombre.value.trim() || 'Comida fuera';
      const error = form.querySelector('[data-libre-error]');
      if (e.submitter?.name === 'ia') {
        if (!puedeUsarIA(ctx.datos, ctx.hoy())) {
          error.hidden = false;
          error.textContent = 'Has llegado al límite de usos de la IA por hoy.';
          return;
        }
        const boton = e.submitter;
        boton.disabled = true;
        boton.innerHTML = '<span class="f-cargando"></span>Estimando…';
        try {
          const r = await ctx.api.ia.tarea(peticionEstimar({ descripcion: `${nombre} (comida en un restaurante o fuera de casa)` }));
          ctx.guardar(contarUsoIA(ctx.datos, ctx.hoy()), { pintar: false });
          const t = totales(leerEstimacion(r.texto));
          ctx.hojas.cerrar();
          apuntarYSeguir([{ nombre, ...t, estimado: true, libre: true }], `${nombre} · ${num(t.kcal)} kcal`);
        } catch (err) {
          boton.disabled = false;
          boton.innerHTML = `${ic('chispa', 16)}Que la estime la IA`;
          error.hidden = false;
          error.textContent = err.message;
        }
        return;
      }
      const kcal = Number(form.elements.kcal.value);
      if (!(kcal > 0)) {
        error.hidden = false;
        error.textContent = 'Pon las kcal aproximadas o pide a la IA que las estime.';
        return;
      }
      const prot = Number(form.elements.proteina.value);
      ctx.hojas.cerrar();
      apuntarYSeguir([{ nombre, ...macrosDeKcal(kcal, prot > 0 ? prot : null), estimado: true, libre: true }], `${nombre} · ${num(kcal)} kcal`);
    },
  };

  return { abrir, acciones, entradas, cambios, formularios };
}
