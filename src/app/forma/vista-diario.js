// Diario: el medidor de kcal, las barras de macros, las comidas del día por
// momentos, el agua, los suplementos, las sugerencias de comidas habituales y
// «Qué puedo comer».
import { pasosDe } from '../../compartido/forma/calculos.js';
import { nombreFuente, avisoAtajo } from '../../compartido/forma/salud.js';
import { horasYMinutos } from '../../compartido/forma/semanas.js';
import { resumenDia, comidasHabituales, avisosDelDia, quePuedoComer, nutrientesDe, totales, esDiaEntreno } from '../../compartido/forma/diario.js';
import { apuntar, editarRegistro, borrarRegistros, sumarAgua, alternarSuplemento, marcarEntreno, descartarSugerencia, verAviso, copiarDia, guardarPlantilla, contarUsoIA } from '../../compartido/forma/acciones.js';
import { peticionIdeas, leerIdeas, puedeUsarIA } from '../../compartido/forma/ia.js';
import { minutosDe, sumarDias, nombreDia } from '../../compartido/forma/fechas.js';
import { ic, escapar, num, medidor, vibrar, unidadDe } from './ui.js';

const MACROS = [
  ['proteina', 'Proteína', 'var(--f-prot)'],
  ['hidratos', 'Hidratos', 'var(--f-hc)'],
  ['grasa', 'Grasa', 'var(--f-gr)'],
  ['fibra', 'Fibra', 'var(--f-fib)'],
];

export function vistaDiario(ctx) {
  const ahoraMin = () => minutosDe(new Date());

  function barraMacro([k, nombre, color], r) {
    const o = r.objetivo[k] ?? 0;
    const c = r.comido[k] ?? 0;
    const q = o - c;
    const p = o ? Math.min(100, (c / o) * 100) : 0;
    return `<div class="f-macro" style="--c:${color}">
      <div class="f-macro__cab">
        <span class="f-macro__nombre"><i></i>${nombre}</span>
        <span class="f-macro__cifras"><b>${num(c)}</b> / ${num(o)} g</span>
        <span class="f-macro__queda ${q < 0 ? (k === 'fibra' || k === 'proteina' ? 'hecho' : 'pasado') : ''}">${q > 0 ? `quedan ${num(q)}` : k === 'fibra' || k === 'proteina' ? '✓ cumplido' : q === 0 ? 'justo' : `+${num(-q)} de más`}</span>
      </div>
      <div class="f-tramos"><div class="f-tramos__lleno" style="--p:${p}%;--paso:${p ? (5 / p) * 100 : 5}%"></div></div>
    </div>`;
  }

  function instrumento(r) {
    const o = r.objetivo;
    const queda = o.kcal - r.comido.kcal;
    return `<section class="f-panel f-visor f-instrumento">
      <div class="f-medidor-caja">
        ${medidor(o.kcal ? r.comido.kcal / o.kcal : 0)}
        <div class="f-medidor__centro">
          <span class="f-medidor__cifra">${num(Math.abs(queda))}</span>
          <span class="f-medidor__unidad">${queda >= 0 ? 'kcal restantes' : 'kcal de más'}</span>
        </div>
      </div>
      <div class="f-instrumento__pie">
        <div class="f-dato"><span>Comido</span><strong>${num(r.comido.kcal)}</strong></div>
        <button type="button" class="f-tipo-dia" data-a="tipo-dia" aria-pressed="${o.entreno}" title="Cambiar el tipo de día"><i></i>${o.entreno ? 'Día de entreno' : 'Descanso'}</button>
        <div class="f-dato"><span>Objetivo</span><strong>${num(o.kcal)}</strong></div>
      </div>
      ${lineaPasos(r)}
      ${lineaSueno(r)}
    </section>`;
  }

  // «Tu resumen semanal está listo»: el día en que se genera (domingo por la
  // noche, por defecto) y el siguiente, hasta que lo abres.
  function tarjetaResumen(r) {
    const d = ctx.datos;
    const ultimo = d.resumenes.at(-1);
    const hoy = ctx.hoy();
    if (!ultimo || r.fecha !== hoy || d.resumenVisto === ultimo.id) return '';
    const dia = d.ajustes.resumenDia;
    const generado = sumarDias(ultimo.id, dia === 7 ? 6 : 6 + dia);
    if (hoy < generado || hoy > sumarDias(generado, 1)) return '';
    const p = ultimo.datos.peso;
    const logro = ultimo.datos.hitos.conseguidos.length;
    return `<button type="button" class="f-panel f-panel--azul f-tarjeta-resumen" data-a="ver-resumen">
      <span class="f-tarjeta-resumen__icono">${ic(logro ? 'trofeo' : 'progreso', 20)}</span>
      <span class="f-tarjeta-resumen__texto"><strong>${logro ? '¡Hito conseguido! ' : ''}Tu resumen semanal está listo${ultimo.datos.propuesta && !ultimo.decision ? ', con una propuesta de ajuste' : ''}</strong>
      <small>${p.media !== null ? `Media ${num(p.media, 1)} kg${p.cambioKg !== null ? ` (${p.cambioKg > 0 ? '+' : ''}${num(p.cambioKg, 2)})` : ''} · ` : ''}${ultimo.datos.entreno.hechas} entrenos · ${ultimo.datos.nutricion.dias}/7 días</small></span>
      ${ic('adelante', 16)}
    </button>`;
  }

  // Lo que dormiste la noche que acaba ese día (Apple Salud).
  function lineaSueno(r) {
    const dia = ctx.datos.dias[r.fecha];
    if (!Number.isFinite(dia?.sueno)) return '';
    const corto = dia.sueno < 420;
    return `<p class="f-pasos"><span aria-hidden="true">😴</span> <b>${escapar(horasYMinutos(dia.sueno))}</b> de sueño · ${escapar(nombreFuente(dia.suenoFuente))}${corto ? '<span class="f-pasos__efecto">menos de 7 h: hoy cuida el hambre</span>' : ''}</p>`;
  }

  // Pasos de Apple Salud: sustituyen la estimación del perfil en el objetivo.
  function lineaPasos(r) {
    const o = r.objetivo;
    if (!Number.isFinite(o.pasos)) return '';
    const habituales = pasosDe(ctx.datos.perfil);
    const efecto = o.pasosExtra
      ? `${o.pasosExtra > 0 ? '+' : '−'}${num(Math.abs(o.pasosExtra))} kcal al objetivo`
      : r.fecha >= ctx.hoy() && o.pasos < habituales
        ? `suma cuando pases de tus ${num(habituales)} habituales`
        : 'como tus pasos habituales';
    return `<p class="f-pasos" title="Los pasos reales de Apple Salud cuentan en vez de la estimación de tu perfil (${num(habituales)} al día).">
      <span aria-hidden="true">👣</span> <b>${num(o.pasos)}</b> pasos · ${escapar(nombreFuente(o.pasosFuente))}<span class="f-pasos__efecto">${efecto}</span></p>`;
  }

  function comidas(r) {
    const d = ctx.datos;
    const momentos = [...d.momentos];
    // Registros de momentos que ya no existen: van a «Otros».
    const conocidos = new Set(momentos.map((m) => m.id));
    if (r.registros.some((x) => !conocidos.has(x.momento))) momentos.push({ id: '__otros', nombre: 'Otros', hora: '' });
    return momentos
      .map((m) => {
        const items = r.registros.filter((x) => (m.id === '__otros' ? !conocidos.has(x.momento) : x.momento === m.id)).sort((a, b) => a.creado - b.creado);
        const t = totales(items);
        return `<section class="f-panel f-comida">
          <header class="f-comida__cab">
            <h3>${escapar(m.nombre)}</h3><span class="f-comida__hora">${escapar(m.hora)}</span>
            <span class="f-comida__kcal">${items.length ? `${num(t.kcal)} kcal · ${num(t.proteina)} g P` : ''}</span>
            ${m.id !== '__otros' ? `<button type="button" class="f-item__mas" data-a="anadir-en" data-momento="${m.id}" aria-label="Añadir a ${escapar(m.nombre)}">${ic('mas', 16)}</button>` : ''}
          </header>
          ${
            items.length
              ? items
                  .map(
                    (x) => `<button type="button" class="f-item" data-a="editar-registro" data-id="${x.id}">
                <span class="f-item__texto"><span class="f-item__nombre">${escapar(x.nombre)}${x.estimado ? '<span class="f-marca-estimado">estimado</span>' : ''}</span>
                <span class="f-item__detalle">${x.gramos ? `${num(x.gramos, 1)} ${unidadDe(x)} · ` : ''}P ${num(x.proteina ?? 0)} · H ${num(x.hidratos ?? 0)} · G ${num(x.grasa ?? 0)}</span></span>
                <span class="f-item__kcal">${num(x.kcal)} <small>kcal</small></span></button>`,
                  )
                  .join('')
              : ''
          }
        </section>`;
      })
      .join('');
  }

  function agua(r) {
    const objetivo = r.objetivo.agua;
    const vasos = Math.max(8, Math.min(16, Math.round(objetivo / 250)));
    const llenos = Math.round(r.agua / 250);
    return `<section class="f-panel">
      <div class="f-etiqueta"><span>${ic('agua', 14)} Agua</span><b>${num(r.agua / 1000, 2)} / ${num(objetivo / 1000, 1)} L</b></div>
      <div class="f-vasos" style="grid-template-columns:repeat(${vasos},1fr)">${Array.from({ length: vasos }, (_, i) => `<span class="f-vaso ${i < llenos ? 'lleno' : ''}"></span>`).join('')}</div>
      <div class="f-fila">
        <button type="button" class="f-boton f-boton--chico" data-a="agua+" data-ml="-250" aria-label="Quitar un vaso">${ic('menos', 14)}</button>
        <button type="button" class="f-boton f-boton--chico" style="flex:1" data-a="agua+" data-ml="250">+250 ml</button>
        <button type="button" class="f-boton f-boton--chico" style="flex:1" data-a="agua+" data-ml="500">+500 ml</button>
      </div>
    </section>`;
  }

  function suplementos(r) {
    const s = ctx.datos.suplementos;
    if (!s.length) return '';
    return `<section class="f-panel f-columna">
      <div class="f-etiqueta"><span>Suplementos</span><b>${r.suplementos.filter((x) => s.some((y) => y.id === x)).length}/${s.length}</b></div>
      <div class="f-chips">${s.map((x) => `<button type="button" class="f-chip" data-a="suplemento" data-id="${x.id}" aria-pressed="${r.suplementos.includes(x.id)}">${r.suplementos.includes(x.id) ? ic('check', 14) : ''}${escapar(x.nombre)}</button>`).join('')}</div>
    </section>`;
  }

  function sugerencias(r) {
    if (r.fecha !== ctx.hoy()) return '';
    // En el diario, solo la más habitual; el resto, en «Añadir».
    const s = comidasHabituales(ctx.datos, r.fecha, ahoraMin()).slice(0, 1);
    return s
      .map(
        (x) => `<section class="f-panel f-panel--azul f-sugerencia">
        <span class="f-sugerencia__icono">${ic('fuego', 18)}</span>
        <p>¿Repetir tu ${escapar(x.nombre.toLowerCase())}?<small>${num(x.kcal)} kcal · ${num(x.proteina)} g de proteína · ${x.veces} veces en 2 semanas</small></p>
        <button type="button" class="f-boton f-boton--azul f-boton--chico" data-a="repetir" data-firma="${escapar(x.firma)}">Repetir</button>
        <button type="button" class="f-icono-boton" style="border:0;background:none" data-a="descartar-sugerencia" data-firma="${escapar(x.firma)}" aria-label="No volver a sugerir">${ic('cerrar', 16)}</button>
      </section>`,
      )
      .join('');
  }

  function avisos(r) {
    return avisosDelDia(ctx.datos, r)
      .filter((a) => !ctx.datos.avisosVistos.includes(a.id))
      .map(
        (a) => `<section class="f-panel f-panel--aviso f-fila">${ic('info', 18)}<p class="f-explica" style="flex:1;color:var(--f-texto)">${escapar(a.texto)}</p>
        <button type="button" class="f-icono-boton" style="border:0;background:none" data-a="ver-aviso" data-id="${a.id}" aria-label="Cerrar">${ic('cerrar', 15)}</button></section>`,
      )
      .join('');
  }

  // El Atajo de Apple Salud lleva más de 36 h sin ejecutarse: se ve hoy, hasta
  // que llega algo nuevo (o lo cierras, hasta el próximo envío).
  function avisoDelAtajo(r) {
    if (r.fecha !== ctx.hoy()) return '';
    const e = ctx.estadoSalud;
    if (e && e.vinculado === false) return '';
    const a = avisoAtajo({ ultima: ctx.datos.integracion?.ultima, ultimoEnvio: e?.ultimoEnvio, tokens: e?.vinculado ? e.tokens : null });
    if (!a || ctx.estado.local.atajoCerrado === a.desde) return '';
    // En el iPhone se puede lanzar el Atajo desde aquí.
    const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
    return `<section class="f-panel f-panel--aviso f-columna" data-aviso-atajo>
      <div class="f-fila">${ic('salud', 18)}<p class="f-explica" style="flex:1;color:var(--f-texto)">${escapar(a.texto)}</p>
      <button type="button" class="f-icono-boton" style="border:0;background:none" data-a="atajo-cerrar" data-desde="${a.desde}" aria-label="Cerrar">${ic('cerrar', 15)}</button></div>
      ${ios ? '<a class="f-boton f-boton--chico" href="shortcuts://run-shortcut?name=Sincronizar%20Forma">Ejecutar «Sincronizar Forma»</a>' : ''}
    </section>`;
  }

  function html() {
    const r = resumenDia(ctx.datos, ctx.estado.fecha);
    if (!r.objetivo) return '';
    const hayAlgo = r.registros.length > 0;
    return `<div class="f-vista">
      ${avisoDelAtajo(r)}
      ${tarjetaResumen(r)}
      ${instrumento(r)}
      <section class="f-panel f-macros">${MACROS.map((m) => barraMacro(m, r)).join('')}</section>
      ${avisos(r)}
      ${sugerencias(r)}
      ${comidas(r)}
      <div class="f-rejilla-2">
        <button type="button" class="f-boton" data-a="que-comer">${ic('diana', 16)}Qué puedo comer</button>
        <button type="button" class="f-boton" data-a="menu-dia">${ic('copiar', 16)}Copiar · plantillas</button>
      </div>
      ${agua(r)}
      ${suplementos(r)}
      ${!hayAlgo && r.fecha === ctx.hoy() ? '<p class="f-tenue" style="text-align:center">Toca el <b>+</b> de abajo para apuntar tu primera comida del día.</p>' : ''}
    </div>`;
  }

  // ---------- Hojas ----------

  function hojaEditar(reg) {
    const d = ctx.datos;
    const alimento = reg.alimentoId ? d.alimentos.find((a) => a.id === reg.alimentoId) : null;
    const hoja = ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>${escapar(reg.nombre)}</h2></div>
       ${reg.estimado ? '<p class="f-tenue">Valores estimados: corrígelos si sabes los reales.</p>' : ''}
       <form class="f-columna" data-form="editar-registro">
         <div class="f-rejilla-2">
           <label class="f-campo"><span>Cantidad</span><div class="f-con-unidad" data-unidad="${unidadDe(reg)}"><input class="f-entrada" name="gramos" type="text" inputmode="decimal" autocomplete="off" step="any" value="${reg.gramos ?? ''}" data-entrada="editar-g"></div></label>
           <label class="f-campo"><span>Momento</span><select class="f-entrada" name="momento">${d.momentos.map((m) => `<option value="${m.id}" ${m.id === reg.momento ? 'selected' : ''}>${escapar(m.nombre)}</option>`).join('')}</select></label>
         </div>
         <div class="f-rejilla-2">
           ${['kcal', 'proteina', 'hidratos', 'grasa'].map((k) => `<label class="f-campo"><span>${{ kcal: 'Kcal', proteina: 'Proteína (g)', hidratos: 'Hidratos (g)', grasa: 'Grasa (g)' }[k]}</span><input class="f-entrada" name="${k}" type="text" inputmode="decimal" autocomplete="off" step="any" value="${reg[k] ?? 0}"></label>`).join('')}
         </div>
         <div class="f-fila">
           <button type="button" class="f-boton f-boton--peligro" data-a="borrar-registro" data-id="${reg.id}">${ic('basura', 16)}Quitar</button>
           <button type="submit" class="f-boton f-boton--azul" style="flex:1">Guardar</button>
         </div>
       </form>`,
      { titulo: reg.nombre },
    );
    hoja.registro = reg;
    hoja.alimento = alimento;
    ctx.estado.local.hojaEditar = hoja;
  }

  function hojaQueComer() {
    const r = resumenDia(ctx.datos, ctx.estado.fecha);
    const opciones = quePuedoComer(ctx.datos, r.quedan);
    const hoja = ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Qué puedo comer</h2></div>
       <div class="f-previa">
         <div><b>${num(Math.max(0, r.quedan.kcal))}</b><span>kcal</span></div>
         <div><b>${num(Math.max(0, r.quedan.proteina))}</b><span>prot.</span></div>
         <div><b>${num(Math.max(0, r.quedan.hidratos))}</b><span>hidr.</span></div>
         <div><b>${num(Math.max(0, r.quedan.grasa))}</b><span>grasa</span></div>
       </div>
       <span class="f-etiqueta">Con lo que sueles comer</span>
       ${
         opciones.length
           ? opciones
               .map(
                 (o, i) => `<div class="f-panel f-columna">
             <div class="f-fila f-entre"><strong>${escapar(o.items.map((x) => x.nombre).join(' + '))}</strong></div>
             <p class="f-tenue">${o.items.map((x) => `${num(x.gramos)} ${unidadDe(x.alimento)} de ${escapar(x.nombre.toLowerCase())}`).join(' · ')}</p>
             <div class="f-fila f-entre"><span class="f-suave" style="font-size:13px">${num(o.total.kcal)} kcal · ${num(o.total.proteina)} g P · ${num(o.total.grasa)} g G</span>
             <button type="button" class="f-boton f-boton--chico f-boton--azul" data-a="apuntar-opcion" data-i="${i}">Apuntar</button></div>
           </div>`,
               )
               .join('')
           : `<p class="f-tenue">${r.quedan.kcal < 80 ? 'Ya casi has llegado a tus kcal de hoy.' : 'Cuando apuntes algunas comidas, combinaré tus alimentos habituales para cuadrar lo que falta.'}</p>`
       }
       <div data-ideas></div>
       <button type="button" class="f-boton f-boton--ancho" data-a="ideas-ia" ${ctx.api.ia?.tarea && r.quedan.kcal >= 80 ? '' : 'disabled'}>${ic('chispa', 16)}Pedir ideas a la IA</button>`,
      { titulo: 'Qué puedo comer' },
    );
    hoja.opciones = opciones;
    hoja.quedan = r.quedan;
    ctx.estado.local.hojaComer = hoja;
  }

  function hojaMenuDia() {
    const f = ctx.estado.fecha;
    const ayer = sumarDias(f, -1);
    const hoyR = ctx.datos.registros.filter((x) => x.fecha === f);
    ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Copiar y plantillas</h2></div>
       <form class="f-columna" data-form="copiar-dia">
         <span class="f-etiqueta">Copiar comidas de otro día a ${escapar(nombreDia(f, ctx.hoy()).toLowerCase())}</span>
         <div class="f-rejilla-2">
           <label class="f-campo"><span>Del día</span><input class="f-entrada" type="date" name="desde" value="${ayer}" max="${ctx.hoy()}"></label>
           <label class="f-campo"><span>Qué</span><select class="f-entrada" name="momento"><option value="">Todo el día</option>${ctx.datos.momentos.map((m) => `<option value="${m.id}">${escapar(m.nombre)}</option>`).join('')}</select></label>
         </div>
         <button type="submit" class="f-boton f-boton--azul">${ic('copiar', 16)}Copiar</button>
       </form>
       <form class="f-columna" data-form="plantilla-dia">
         <span class="f-etiqueta">Guardar como plantilla</span>
         <p class="f-tenue">Guarda una comida de este día para añadirla luego de un toque desde el +.</p>
         <div class="f-rejilla-2">
           <label class="f-campo"><span>Comida</span><select class="f-entrada" name="momento">${ctx.datos.momentos
             .filter((m) => hoyR.some((x) => x.momento === m.id))
             .map((m) => `<option value="${m.id}">${escapar(m.nombre)}</option>`)
             .join('')}</select></label>
           <label class="f-campo"><span>Nombre</span><input class="f-entrada" name="nombre" placeholder="Mi desayuno"></label>
         </div>
         <button type="submit" class="f-boton" ${hoyR.length ? '' : 'disabled'}>${ic('plantilla', 16)}Guardar plantilla</button>
       </form>`,
      { titulo: 'Copiar y plantillas' },
    );
  }

  // ---------- Acciones ----------

  const acciones = {
    'atajo-cerrar': (el) => {
      ctx.estado.local.atajoCerrado = Number(el.dataset.desde);
      el.closest('[data-aviso-atajo]')?.remove();
    },
    'ver-resumen': () => ctx.irASemanas(),
    'tipo-dia': () => {
      const f = ctx.estado.fecha;
      ctx.guardar(marcarEntreno(ctx.datos, f, !esDiaEntreno(ctx.datos, f)), { pintar: false });
      ctx.repintar();
    },
    'anadir-en': (el) => ctx.abrirAnadir({ fecha: ctx.estado.fecha, momento: el.dataset.momento }),
    'editar-registro': (el) => {
      const reg = ctx.datos.registros.find((x) => x.id === el.dataset.id);
      if (reg) hojaEditar(reg);
    },
    'borrar-registro': (el) => {
      const antes = ctx.datos;
      ctx.hojas.cerrar();
      ctx.guardar(borrarRegistros(ctx.datos, [el.dataset.id]), { pintar: false });
      ctx.repintar();
      ctx.tostada('Quitado del diario', { accion: () => ctx.guardar(antes) });
    },
    'agua+': (el) => {
      vibrar();
      ctx.guardar(sumarAgua(ctx.datos, ctx.estado.fecha ?? ctx.hoy(), Number(el.dataset.ml)), { pintar: false });
      ctx.repintar();
    },
    suplemento: (el) => {
      vibrar();
      ctx.guardar(alternarSuplemento(ctx.datos, ctx.estado.fecha, el.dataset.id), { pintar: false });
      ctx.repintar();
    },
    repetir: (el) => {
      const s = comidasHabituales(ctx.datos, ctx.hoy(), ahoraMin()).find((x) => x.firma === el.dataset.firma);
      if (!s) return;
      const { datos } = apuntar(ctx.datos, {
        fecha: ctx.hoy(),
        momento: s.momento,
        minuto: ahoraMin(),
        items: s.items.map(({ id: _i, fecha: _f, creado: _c, minuto: _m, momento: _mo, ...x }) => x),
      });
      vibrar(20);
      const antes = ctx.datos;
      ctx.guardar(datos, { pintar: false });
      ctx.repintar();
      ctx.tostada(`Apuntado: ${s.nombre}`, { accion: () => ctx.guardar(antes) });
    },
    'descartar-sugerencia': (el) => {
      ctx.guardar(descartarSugerencia(ctx.datos, el.dataset.firma), { pintar: false });
      ctx.repintar();
      ctx.tostada('No te la volveré a sugerir.');
    },
    'ver-aviso': (el) => {
      ctx.guardar(verAviso(ctx.datos, el.dataset.id), { pintar: false });
      ctx.repintar();
    },
    'que-comer': () => hojaQueComer(),
    'menu-dia': () => hojaMenuDia(),
    'apuntar-opcion': (el) => {
      const hoja = ctx.estado.local.hojaComer;
      const o = hoja?.opciones?.[Number(el.dataset.i)];
      if (!o) return;
      apuntarItems(
        o.items.map((x) => ({ ...nutrientesDe(x.alimento, x.gramos), nombre: x.alimento.nombre, alimentoId: x.alimento.id, gramos: x.gramos, unidad: unidadDe(x.alimento) })),
        'Apuntado',
      );
    },
    'ideas-ia': async (el) => {
      const hoja = ctx.estado.local.hojaComer;
      if (!hoja) return;
      const caja = hoja.cuerpo.querySelector('[data-ideas]');
      if (!puedeUsarIA(ctx.datos, ctx.hoy())) {
        caja.innerHTML = `<p class="f-error">Has llegado al límite de ${ctx.datos.ajustes.limiteIA} usos de la IA por hoy (puedes cambiarlo en Perfil).</p>`;
        return;
      }
      el.disabled = true;
      el.innerHTML = '<span class="f-cargando"></span>Pensando ideas…';
      try {
        const frecuentes = [...ctx.datos.alimentos].sort((a, b) => b.veces - a.veces).slice(0, 15).map((a) => a.nombre);
        const momento = ctx.datos.momentos.find((m) => Math.abs(minutosDe(m.hora) - ahoraMin()) < 120)?.nombre ?? '';
        const r = await ctx.api.ia.tarea(peticionIdeas({ quedan: hoja.quedan, frecuentes, momento }));
        ctx.guardar(contarUsoIA(ctx.datos, ctx.hoy()), { pintar: false });
        const ideas = leerIdeas(r.texto);
        hoja.ideas = ideas;
        caja.innerHTML = `<span class="f-etiqueta">Ideas de la IA</span>${ideas
          .map((idea, i) => {
            const t = totales(idea.items);
            return `<div class="f-estimado" style="margin-top:8px">
              <div class="f-fila f-entre"><strong>${escapar(idea.nombre)}</strong><span class="f-marca-estimado">estimado</span></div>
              <p class="f-tenue">${idea.items.map((x) => `${num(x.gramos)} g ${escapar(x.nombre.toLowerCase())}`).join(' · ')}</p>
              <div class="f-fila f-entre"><span class="f-suave" style="font-size:13px">${num(t.kcal)} kcal · ${num(t.proteina)} g P</span>
              <button type="button" class="f-boton f-boton--chico f-boton--azul" data-a="apuntar-idea" data-i="${i}">Apuntar</button></div></div>`;
          })
          .join('')}`;
        el.hidden = true;
      } catch (error) {
        el.disabled = false;
        el.innerHTML = `${ic('chispa', 16)}Pedir ideas a la IA`;
        caja.innerHTML = `<p class="f-error">${escapar(error.message)}</p>`;
      }
    },
    'apuntar-idea': (el) => {
      const idea = ctx.estado.local.hojaComer?.ideas?.[Number(el.dataset.i)];
      if (idea) apuntarItems(idea.items.map((x) => ({ ...x, estimado: true })), `Apuntado: ${idea.nombre}`);
    },
  };

  function apuntarItems(items, texto) {
    const f = ctx.estado.fecha;
    const minuto = f === ctx.hoy() ? ahoraMin() : 13 * 60;
    const momento = ctx.datos.momentos.reduce((a, m) => (Math.abs(minutosDe(m.hora) - minuto) < Math.abs(minutosDe(a.hora) - minuto) ? m : a), ctx.datos.momentos[0]).id;
    const antes = ctx.datos;
    const { datos } = apuntar(ctx.datos, { fecha: f, momento, minuto, items });
    ctx.hojas.cerrarTodas();
    vibrar(20);
    ctx.guardar(datos, { pintar: false });
    ctx.repintar();
    ctx.tostada(texto, { accion: () => ctx.guardar(antes) });
  }

  const entradas = {
    // Al cambiar los gramos, se recalculan los valores (con el alimento o en proporción).
    'editar-g': (el) => {
      const hoja = ctx.estado.local.hojaEditar;
      const g = Number(el.value);
      if (!hoja || !(g > 0)) return;
      const form = el.form;
      const base = hoja.alimento ? nutrientesDe(hoja.alimento, g) : hoja.registro.gramos ? Object.fromEntries(['kcal', 'proteina', 'hidratos', 'grasa'].map((k) => [k, Math.round(((hoja.registro[k] ?? 0) * g * 10) / hoja.registro.gramos) / 10])) : null;
      if (!base) return;
      for (const k of ['kcal', 'proteina', 'hidratos', 'grasa']) form.elements[k].value = k === 'kcal' ? Math.round(base[k] ?? 0) : (base[k] ?? 0);
    },
  };

  const formularios = {
    'editar-registro': (form) => {
      const hoja = ctx.estado.local.hojaEditar;
      if (!hoja) return;
      const v = (k) => Math.max(0, Number(form.elements[k].value) || 0);
      const g = Number(form.elements.gramos.value);
      const cambios = { momento: form.elements.momento.value, kcal: Math.round(v('kcal')), proteina: v('proteina'), hidratos: v('hidratos'), grasa: v('grasa'), ...(g > 0 ? { gramos: g } : {}) };
      if (hoja.alimento && g > 0) {
        const n = nutrientesDe(hoja.alimento, g);
        if (n.fibra !== undefined) cambios.fibra = n.fibra;
      } else if (hoja.registro.gramos && g > 0) cambios.fibra = Math.round(((hoja.registro.fibra ?? 0) * g * 10) / hoja.registro.gramos) / 10;
      ctx.hojas.cerrar();
      ctx.guardar(editarRegistro(ctx.datos, hoja.registro.id, cambios), { pintar: false });
      ctx.repintar();
    },
    'copiar-dia': (form) => {
      const desde = form.elements.desde.value;
      const momento = form.elements.momento.value || null;
      const n = ctx.datos.registros.filter((x) => x.fecha === desde && (!momento || x.momento === momento)).length;
      if (!n) return ctx.tostada('Ese día no tiene comidas apuntadas.');
      const antes = ctx.datos;
      ctx.hojas.cerrar();
      ctx.guardar(copiarDia(ctx.datos, desde, ctx.estado.fecha, momento), { pintar: false });
      ctx.repintar();
      ctx.tostada(`${n} ${n === 1 ? 'alimento copiado' : 'alimentos copiados'}`, { accion: () => ctx.guardar(antes) });
    },
    'plantilla-dia': (form) => {
      const momento = form.elements.momento.value;
      const items = ctx.datos.registros.filter((x) => x.fecha === ctx.estado.fecha && x.momento === momento);
      if (!items.length) return;
      const nombre = form.elements.nombre.value.trim() || ctx.datos.momentos.find((m) => m.id === momento)?.nombre || 'Comida';
      ctx.hojas.cerrar();
      ctx.guardar(guardarPlantilla(ctx.datos, nombre, items));
      ctx.tostada(`Plantilla «${nombre}» guardada. La tienes en + → Plantillas.`);
    },
  };

  return { html, acciones, entradas, formularios };
}
