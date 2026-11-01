// Gastos: cuánto se va este mes de un vistazo y apuntar un gasto en dos
// segundos. Se escribe como se diría («12,50 súper», «netflix 13 al mes»,
// «ayer 30 gasolina») y Kitsune entiende el importe, la fecha, la categoría y
// si se repite. Los fijos (alquiler, suscripciones…) se cuentan solos cada mes.
import { icono } from './iconos.js';
import {
  CATEGORIAS,
  FRECUENCIAS,
  DIAS_SEMANA,
  categoria,
  euros,
  fechaISO,
  mesDe,
  nombreMes,
  sumarMeses,
  sumarDias,
  interpretarGasto,
  leerImporte,
  normalizarGastos,
  anadirMovimiento,
  editarMovimiento,
  borrarMovimiento,
  anadirFijo,
  editarFijo,
  borrarFijo,
  darDeBajaFijo,
  reactivarFijo,
  cambiarOcurrencia,
  ponerPresupuesto,
  resumenMes,
  historico,
  totalFijosAlMes,
  cuandoFijo,
  proximaFecha,
  fijoActivo,
  alMes,
  aCSV,
} from '../compartido/gastos.js';

const escapar = (t = '') => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
// «1,50» para un campo de importe.
const importeCampo = (centimos) => (centimos / 100).toFixed(2).replace('.', ',').replace(/,00$/, '');

function diaLegible(fecha, hoy) {
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, -1)) return 'Ayer';
  if (fecha === sumarDias(hoy, 1)) return 'Mañana';
  const [a, m, d] = fecha.split('-').map(Number);
  return mayuscula(new Date(a, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }));
}
const fechaCorta = (fecha) => {
  const [, m, d] = fecha.split('-').map(Number);
  return `${d} ${MESES_CORTOS[m - 1]}`;
};

async function entregarCSV(texto, nombre) {
  const archivo = new File([texto], nombre, { type: 'text/csv;charset=utf-8' });
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function crearGastos({ contenedor, api, alCambiar = () => {} }) {
  let datos = normalizarGastos({});
  let hoy = fechaISO();
  let mes = mesDe(hoy);
  let pestana = 'movimientos';
  let filtro = '';
  // Lo que está abierto para editar: el id de un gasto, de un fijo («f…») o «nuevo-fijo».
  let abierto = null;
  // Lo que el usuario elige a mano en la línea rápida (manda sobre lo que se adivina).
  let elegido = { categoria: null, fecha: null, repite: null, frecuencia: 'mensual', dia: null };
  let deshacer = null;
  let temporizadorAviso = null;

  async function cargar() {
    datos = normalizarGastos((await api.gastos.leer().catch(() => null)) ?? {});
  }

  async function guardar(nuevos, { aviso = '', alDeshacer = null } = {}) {
    const anteriores = datos;
    datos = normalizarGastos(nuevos);
    pintar();
    try {
      await api.gastos.guardar(datos);
      alCambiar(datos);
      if (aviso) avisar(aviso, alDeshacer ? () => guardar(alDeshacer(anteriores)) : null);
    } catch (error) {
      datos = anteriores;
      pintar();
      avisar(`No se ha podido guardar: ${error.message}`);
    }
  }

  // ---------- Esqueleto ----------

  async function mostrar() {
    hoy = fechaISO();
    if (!contenedor.querySelector('.gastos')) {
      contenedor.innerHTML = `
        <div class="apartado desplazable gastos">
          <header class="gastos__mes">
            <button type="button" class="icono-boton" data-mover="-1" aria-label="Mes anterior">${icono('volver', 18)}</button>
            <div class="gastos__mes-centro">
              <h2 id="gastos-mes"></h2>
              <button type="button" class="gastos__volver" id="gastos-volver" hidden>Volver a este mes</button>
            </div>
            <button type="button" class="icono-boton gastos__siguiente" data-mover="1" aria-label="Mes siguiente">${icono('volver', 18)}</button>
          </header>
          <section class="gastos__cifra" id="gastos-cifra" aria-live="polite"></section>
          <form class="gastos__rapido" id="gastos-rapido" autocomplete="off">
            <label class="gastos__entrada">
              <span class="visualmente-oculto">Apunta un gasto</span>
              <input class="campo" id="gastos-texto" name="texto" maxlength="120" placeholder="12,50 súper · netflix 13 al mes" enterkeyhint="done" autocomplete="off" autocapitalize="sentences">
              <button type="submit" class="boton boton--primario" id="gastos-apuntar">${icono('nueva', 15)} Apuntar</button>
            </label>
            <div class="gastos__previa" id="gastos-previa" hidden></div>
            <p class="apartado__mensaje" id="gastos-error" role="alert" hidden></p>
          </form>
          <div class="segmentado gastos__pestanas" role="tablist" aria-label="Gastos">
            ${[['movimientos', 'Movimientos'], ['fijos', 'Fijos'], ['resumen', 'Resumen']]
              .map(([v, n]) => `<button type="button" role="tab" data-pestana="${v}" aria-selected="${pestana === v}" aria-pressed="${pestana === v}">${n}</button>`)
              .join('')}
          </div>
          <div id="gastos-panel" role="tabpanel"></div>
          <div class="gastos__aviso" id="gastos-aviso" role="status" hidden></div>
        </div>`;
      conectar();
    }
    await cargar();
    pintar();
  }

  function conectar() {
    contenedor.querySelectorAll('[data-mover]').forEach((b) =>
      b.addEventListener('click', () => {
        mes = sumarMeses(mes, Number(b.dataset.mover));
        abierto = null;
        pintar();
      }),
    );
    contenedor.querySelector('#gastos-volver').addEventListener('click', () => {
      mes = mesDe(hoy);
      pintar();
    });
    contenedor.querySelectorAll('[data-pestana]').forEach((b) =>
      b.addEventListener('click', () => {
        pestana = b.dataset.pestana;
        abierto = null;
        pintar();
      }),
    );
    const texto = contenedor.querySelector('#gastos-texto');
    texto.addEventListener('input', () => {
      // Un texto nuevo vuelve a adivinar desde cero.
      if (!texto.value.trim()) elegido = { categoria: null, fecha: null, repite: null, frecuencia: 'mensual', dia: null };
      pintarPrevia();
    });
    contenedor.querySelector('#gastos-rapido').addEventListener('submit', (e) => {
      e.preventDefault();
      apuntarRapido();
    });
    contenedor.querySelector('#gastos-previa').addEventListener('click', alPulsarPrevia);
    contenedor.querySelector('#gastos-previa').addEventListener('change', alCambiarPrevia);
    contenedor.querySelector('#gastos-panel').addEventListener('click', alPulsarPanel);
    contenedor.querySelector('#gastos-cifra').addEventListener('click', (e) => {
      if (e.target.closest('[data-ir-presupuesto]')) {
        pestana = 'resumen';
        pintar();
        requestAnimationFrame(() => contenedor.querySelector('#gastos-presupuesto')?.focus());
      }
    });
  }

  function pintar() {
    const actual = mesDe(hoy);
    contenedor.querySelector('#gastos-mes').textContent = mayuscula(nombreMes(mes));
    contenedor.querySelector('#gastos-volver').hidden = mes === actual;
    for (const b of contenedor.querySelectorAll('[data-pestana]')) {
      b.setAttribute('aria-selected', String(b.dataset.pestana === pestana));
      b.setAttribute('aria-pressed', String(b.dataset.pestana === pestana));
    }
    const r = resumenMes(datos, mes, hoy);
    pintarCifra(r);
    pintarPrevia();
    const panel = contenedor.querySelector('#gastos-panel');
    panel.innerHTML = pestana === 'fijos' ? panelFijos() : pestana === 'resumen' ? panelResumen(r) : panelMovimientos(r);
  }

  // ---------- La cifra del mes ----------

  function pintarCifra(r) {
    const actual = mesDe(hoy);
    const futuro = mes > actual;
    const etiqueta = futuro ? `previsto para ${nombreMes(mes, { corto: true })}` : mes === actual ? 'gastado este mes' : `gastado en ${nombreMes(mes, { corto: true })}`;
    const cifra = futuro ? r.previsto : r.gastado;
    const anterior = resumenMes(datos, sumarMeses(mes, -1), hoy);
    let comparacion = '';
    if (!futuro && anterior.previsto && mes !== actual) {
      const cambio = Math.round(((r.previsto - anterior.previsto) / anterior.previsto) * 100);
      comparacion = cambio === 0 ? 'igual que el mes anterior' : `${cambio > 0 ? '+' : '−'}${Math.abs(cambio)} % que ${nombreMes(sumarMeses(mes, -1), { corto: true })}`;
    }
    const detalle = [
      r.pendiente && !futuro ? `+ ${euros(r.pendiente, { redondo: true })} de fijos por pagar` : '',
      r.pendiente && !futuro ? `previsto ${euros(r.previsto, { redondo: true })}` : '',
      comparacion,
    ].filter(Boolean);
    let presupuesto = '';
    if (r.presupuesto) {
      const pagado = Math.min(100, (r.gastado / r.presupuesto) * 100);
      const porPagar = Math.min(100 - pagado, (r.pendiente / r.presupuesto) * 100);
      const pasado = r.disponible < 0;
      presupuesto = `
        <div class="gastos__barra${pasado ? ' gastos__barra--pasado' : ''}" role="img" aria-label="${escapar(`${euros(r.previsto)} de ${euros(r.presupuesto)}`)}">
          <span class="gastos__barra-pagado" style="width:${pagado.toFixed(1)}%"></span><span class="gastos__barra-pendiente" style="width:${porPagar.toFixed(1)}%"></span>
        </div>
        <p class="gastos__presupuesto${pasado ? ' gastos__presupuesto--pasado' : ''}">${
          pasado
            ? `Te pasas <strong>${euros(-r.disponible, { redondo: true })}</strong> de tu presupuesto de ${euros(r.presupuesto, { redondo: true })}`
            : `Te quedan <strong>${euros(r.disponible, { redondo: true })}</strong> de tu presupuesto de ${euros(r.presupuesto, { redondo: true })}${r.pendiente ? ' · ya contados los fijos que faltan' : ''}`
        }</p>`;
    } else if (!datos.movimientos.length && !datos.fijos.length) {
      presupuesto = '';
    } else {
      presupuesto = `<button type="button" class="gastos__enlace" data-ir-presupuesto>Ponte un presupuesto mensual</button>`;
    }
    contenedor.querySelector('#gastos-cifra').innerHTML = `
      <p class="gastos__etiqueta">${escapar(etiqueta)}</p>
      <p class="gastos__total">${escapar(euros(cifra))}</p>
      ${detalle.length ? `<p class="gastos__detalle">${escapar(detalle.join(' · '))}</p>` : ''}
      ${presupuesto}`;
  }

  // ---------- La línea rápida ----------

  function interpretacion() {
    const texto = contenedor.querySelector('#gastos-texto')?.value ?? '';
    const i = interpretarGasto(texto, hoy);
    const repite = elegido.repite ?? Boolean(i.fijo);
    return {
      ...i,
      categoria: elegido.categoria ?? i.categoria,
      fecha: elegido.fecha ?? i.fecha,
      repite,
      frecuencia: elegido.repite === null && i.fijo ? i.fijo.frecuencia : elegido.frecuencia,
      dia: elegido.dia ?? Number((elegido.fecha ?? i.fecha).slice(8)),
      vacio: !texto.trim(),
    };
  }

  function pintarPrevia() {
    const caja = contenedor.querySelector('#gastos-previa');
    if (!caja) return;
    const i = interpretacion();
    if (i.vacio) {
      caja.hidden = true;
      caja.innerHTML = '';
      return;
    }
    const enFoco = document.activeElement?.closest?.('#gastos-previa') ? document.activeElement.dataset.foco : null;
    caja.hidden = false;
    const ayer = sumarDias(hoy, -1);
    caja.innerHTML = `
      <p class="gastos__entiendo">${
        i.centimos
          ? `<strong>${escapar(i.concepto || categoria(i.categoria).nombre)}</strong> · ${escapar(euros(i.centimos))} · ${
              i.repite ? escapar(textoRepite(i)) : escapar(diaLegible(i.fecha, hoy).toLowerCase())
            }`
          : 'Escribe también cuánto: «12,50 súper»'
      }</p>
      <div class="gastos__categorias" role="group" aria-label="Categoría">
        ${CATEGORIAS.map(
          (c) => `<button type="button" class="gastos__categoria" data-categoria="${c.id}" aria-pressed="${c.id === i.categoria}" style="--c:${c.color}"><span class="gastos__punto"></span>${escapar(c.nombre)}</button>`,
        ).join('')}
      </div>
      <div class="gastos__opciones">
        ${
          i.repite
            ? `<select class="campo gastos__select" data-foco="frecuencia" aria-label="Cada cuánto">${FRECUENCIAS.map((f) => `<option value="${f.id}" ${f.id === i.frecuencia ? 'selected' : ''}>${f.nombre}</option>`).join('')}</select>
               ${
                 i.frecuencia === 'semanal'
                   ? ''
                   : `<label class="gastos__dia">día <input class="campo" type="number" min="1" max="31" inputmode="numeric" data-foco="dia" value="${i.dia}" aria-label="Día del mes en que se cobra"></label>`
               }`
            : `<button type="button" class="chip" data-fecha="${hoy}" aria-pressed="${i.fecha === hoy}">Hoy</button>
               <button type="button" class="chip" data-fecha="${ayer}" aria-pressed="${i.fecha === ayer}">Ayer</button>
               <input class="campo gastos__fecha" type="date" data-foco="fecha" value="${i.fecha}" max="${sumarDias(hoy, 366)}" aria-label="Fecha del gasto">`
        }
        <button type="button" class="chip gastos__repite" data-repite aria-pressed="${i.repite}">${icono('actualizar', 13)} Se repite</button>
      </div>`;
    if (enFoco) caja.querySelector(`[data-foco="${enFoco}"]`)?.focus();
  }

  function textoRepite(i) {
    const nombre = FRECUENCIAS.find((f) => f.id === i.frecuencia)?.nombre.toLowerCase() ?? 'cada mes';
    if (i.frecuencia === 'semanal') {
      const [a, m, d] = i.fecha.split('-').map(Number);
      return `${nombre}, los ${DIAS_SEMANA[(new Date(a, m - 1, d).getDay() + 6) % 7]}`;
    }
    return `${nombre}, el día ${i.dia}`;
  }

  function alPulsarPrevia(e) {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.categoria) elegido.categoria = b.dataset.categoria;
    else if (b.dataset.fecha) elegido.fecha = b.dataset.fecha;
    else if ('repite' in b.dataset) elegido.repite = !interpretacion().repite;
    else return;
    pintarPrevia();
  }

  function alCambiarPrevia(e) {
    const campo = e.target;
    if (campo.dataset.foco === 'fecha' && campo.value) elegido.fecha = campo.value;
    if (campo.dataset.foco === 'frecuencia') elegido.frecuencia = campo.value;
    if (campo.dataset.foco === 'dia') elegido.dia = Math.min(31, Math.max(1, Number(campo.value) || 1));
    if (campo.dataset.foco === 'frecuencia' && elegido.repite === null) elegido.repite = true;
    pintarPrevia();
  }

  function error(mensaje) {
    const p = contenedor.querySelector('#gastos-error');
    p.hidden = !mensaje;
    p.textContent = mensaje;
  }

  async function apuntarRapido() {
    const i = interpretacion();
    if (i.vacio) return contenedor.querySelector('#gastos-texto').focus();
    if (!i.centimos) return error('Falta el importe: escribe por ejemplo «12,50 súper».');
    error('');
    const campo = contenedor.querySelector('#gastos-texto');
    const concepto = i.concepto || categoria(i.categoria).nombre;
    if (i.repite) {
      const [a, m, d] = i.fecha.split('-').map(Number);
      const r = anadirFijo(datos, {
        concepto,
        centimos: i.centimos,
        categoria: i.categoria,
        frecuencia: i.frecuencia,
        dia: i.dia,
        mes: m,
        diaSemana: ((new Date(a, m - 1, d).getDay() + 6) % 7) + 1,
        desde: `${mesDe(i.fecha)}-01`,
      }, hoy);
      await guardar(r.datos, { aviso: `Gasto fijo: ${concepto} · ${euros(i.centimos)} ${textoRepite(i)}`, alDeshacer: (antes) => antes });
    } else {
      const r = anadirMovimiento(datos, { concepto, centimos: i.centimos, categoria: i.categoria, fecha: i.fecha });
      mes = mesDe(i.fecha);
      await guardar(r.datos, { aviso: `Apuntado: ${concepto} · ${euros(i.centimos)}`, alDeshacer: (antes) => antes });
    }
    campo.value = '';
    elegido = { categoria: null, fecha: null, repite: null, frecuencia: 'mensual', dia: null };
    pintarPrevia();
    campo.focus();
  }

  // ---------- Movimientos del mes ----------

  function filaGasto(x) {
    const c = categoria(x.categoria);
    const detalle = [
      c.nombre,
      x.tipo === 'fijo' ? (x.pendiente ? `fijo · se cobra el ${fechaCorta(x.fecha)}` : x.cambiado ? 'fijo · importe de este mes' : 'fijo') : '',
      x.nota,
    ].filter(Boolean);
    const id = x.tipo === 'fijo' ? x.id : x.id;
    return `
      <li class="gasto${x.pendiente ? ' gasto--pendiente' : ''}${abierto === id ? ' gasto--abierto' : ''}" data-gasto="${escapar(id)}">
        <button type="button" class="gasto__fila" data-abrir="${escapar(id)}" aria-expanded="${abierto === id}">
          <span class="gasto__punto" style="--c:${c.color}" aria-hidden="true">${x.tipo === 'fijo' ? icono('actualizar', 11) : ''}</span>
          <span class="gasto__cuerpo"><span class="gasto__concepto">${escapar(x.concepto)}</span><span class="gasto__detalle">${escapar(detalle.join(' · '))}</span></span>
          <span class="gasto__importe">${escapar(euros(x.centimos))}</span>
        </button>
        ${abierto === id ? (x.tipo === 'fijo' ? editorOcurrencia(x) : editorMovimiento(x)) : ''}
      </li>`;
  }

  function panelMovimientos(r) {
    const lista = filtro ? r.lista.filter((x) => x.categoria === filtro) : r.lista;
    const chipFiltro = filtro
      ? `<button type="button" class="chip chip--acento gastos__filtro" data-quitar-filtro>Solo ${escapar(categoria(filtro).nombre)} · ${escapar(euros(lista.reduce((s, x) => s + x.centimos, 0)))} ${icono('cerrar', 12)}</button>`
      : '';
    if (!lista.length) {
      const vacio = !datos.movimientos.length && !datos.fijos.length;
      return `${chipFiltro}<div class="gastos__vacio">${
        vacio
          ? `<p><strong>Apunta tu primer gasto</strong> arriba, como lo dirías: «12,50 súper», «ayer 30 gasolina».</p>
             <p>Para lo que se repite (alquiler, Netflix, el gimnasio…) añade «al mes» o pulsa «Se repite»: se contará solo cada mes.</p>
             <p>También puedes decírselo a Kitsune en el chat: «apunta 8 € del cine».</p>`
          : `<p>Nada apuntado en ${escapar(nombreMes(mes, { corto: true }))}${filtro ? ` en ${escapar(categoria(filtro).nombre)}` : ''}.</p>`
      }</div>`;
    }
    const porPagar = lista.filter((x) => x.pendiente).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const pasados = lista.filter((x) => !x.pendiente);
    const dias = new Map();
    for (const x of pasados) dias.set(x.fecha, [...(dias.get(x.fecha) ?? []), x]);
    const suma = (xs) => xs.reduce((s, x) => s + x.centimos, 0);
    return `
      ${chipFiltro}
      ${
        porPagar.length
          ? `<div class="gastos__grupo"><p class="gastos__dia"><span>Por pagar este mes</span><span>${escapar(euros(suma(porPagar)))}</span></p><ul class="gastos__lista">${porPagar.map(filaGasto).join('')}</ul></div>`
          : ''
      }
      ${[...dias]
        .map(
          ([fecha, xs]) =>
            `<div class="gastos__grupo"><p class="gastos__dia"><span>${escapar(diaLegible(fecha, hoy))}${fecha === hoy || fecha === sumarDias(hoy, -1) ? ` · ${fechaCorta(fecha)}` : ''}</span><span>${escapar(euros(suma(xs)))}</span></p><ul class="gastos__lista">${xs.map(filaGasto).join('')}</ul></div>`,
        )
        .join('')}
      ${
        r.omitidos.length && !filtro
          ? `<p class="ajuste__ayuda apartado__nota">Este mes no se cuentan: ${escapar(r.omitidos.map((o) => o.concepto).join(', '))}.</p>`
          : ''
      }`;
  }

  const opcionesCategoria = (actual) => CATEGORIAS.map((c) => `<option value="${c.id}" ${c.id === actual ? 'selected' : ''}>${escapar(c.nombre)}</option>`).join('');

  function editorMovimiento(m) {
    return `
      <form class="formulario gasto__editor" data-editar-movimiento="${escapar(m.id)}">
        <div class="formulario__fila">
          <input class="campo" name="concepto" value="${escapar(m.concepto)}" maxlength="80" aria-label="Concepto" required>
          <input class="campo gasto__campo-importe" name="importe" value="${escapar(importeCampo(m.centimos))}" inputmode="decimal" aria-label="Importe en euros" required>
        </div>
        <div class="formulario__fila">
          <select class="campo" name="categoria" aria-label="Categoría">${opcionesCategoria(m.categoria)}</select>
          <input class="campo" type="date" name="fecha" value="${m.fecha}" aria-label="Fecha" required>
        </div>
        <input class="campo" name="nota" value="${escapar(m.nota ?? '')}" maxlength="200" placeholder="Nota (opcional)" aria-label="Nota">
        <p class="apartado__mensaje" role="alert" hidden></p>
        <div class="formulario__botones">
          <button type="submit" class="boton boton--primario">Guardar</button>
          <button type="button" class="boton" data-cerrar>Cancelar</button>
          <button type="button" class="boton boton--peligro gasto__borrar" data-borrar-movimiento="${escapar(m.id)}">${icono('papelera', 14)} Borrar</button>
        </div>
      </form>`;
  }

  function editorOcurrencia(x) {
    const fijo = datos.fijos.find((f) => f.id === x.fijoId);
    if (!fijo) return '';
    return `
      <form class="formulario gasto__editor" data-editar-ocurrencia="${escapar(x.fijoId)}" data-fecha="${x.fecha}">
        <p class="gasto__explicacion">${escapar(cuandoFijo(fijo))} · normalmente ${escapar(euros(fijo.centimos))}.</p>
        <label class="gasto__etiqueta">Este mes ${x.pendiente ? 'será' : 'fue'}
          <input class="campo gasto__campo-importe" name="importe" value="${escapar(importeCampo(x.centimos))}" inputmode="decimal" aria-label="Importe de este mes en euros">
        </label>
        <p class="apartado__mensaje" role="alert" hidden></p>
        <div class="formulario__botones">
          <button type="submit" class="boton boton--primario">Guardar este mes</button>
          ${x.cambiado ? `<button type="button" class="boton" data-restaurar>Como siempre</button>` : ''}
          <button type="button" class="boton" data-omitir>Este mes no</button>
          <button type="button" class="boton" data-ver-fijo="${escapar(x.fijoId)}">Editar el fijo</button>
        </div>
      </form>`;
  }

  // ---------- Fijos ----------

  function panelFijos() {
    const activos = datos.fijos.filter((f) => fijoActivo(f, hoy));
    const baja = datos.fijos.filter((f) => !fijoActivo(f, hoy));
    const ordenar = (xs) =>
      [...xs].sort((a, b) => (proximaFecha(a, hoy)?.fecha ?? '9999').localeCompare(proximaFecha(b, hoy)?.fecha ?? '9999') || a.concepto.localeCompare(b.concepto, 'es'));
    const fila = (f) => {
      const c = categoria(f.categoria);
      const proxima = proximaFecha(f, hoy);
      const detalle = [cuandoFijo(f), fijoActivo(f, hoy) ? (proxima ? `próximo ${fechaCorta(proxima.fecha)}` : '') : `de baja desde el ${fechaCorta(f.hasta)}`];
      return `
        <li class="gasto${abierto === f.id ? ' gasto--abierto' : ''}${fijoActivo(f, hoy) ? '' : ' gasto--baja'}" data-gasto="${f.id}">
          <button type="button" class="gasto__fila" data-abrir="${f.id}" aria-expanded="${abierto === f.id}">
            <span class="gasto__punto" style="--c:${c.color}" aria-hidden="true">${icono('actualizar', 11)}</span>
            <span class="gasto__cuerpo"><span class="gasto__concepto">${escapar(f.concepto)}</span><span class="gasto__detalle">${escapar(detalle.filter(Boolean).join(' · '))}</span></span>
            <span class="gasto__importe">${escapar(euros(f.centimos))}${f.frecuencia !== 'mensual' ? `<small>${escapar(euros(alMes(f), { redondo: true }))}/mes</small>` : ''}</span>
          </button>
          ${abierto === f.id ? editorFijo(f) : ''}
        </li>`;
    };
    return `
      <div class="gastos__fijos-cabecera">
        <p><span class="gastos__etiqueta">tus fijos</span><strong>${escapar(euros(totalFijosAlMes(datos, hoy)))}</strong> al mes${activos.length ? ` · ${activos.length} ${activos.length === 1 ? 'gasto' : 'gastos'}` : ''}</p>
        <button type="button" class="boton" data-abrir="nuevo-fijo">${icono('nueva', 15)} Nuevo</button>
      </div>
      ${abierto === 'nuevo-fijo' ? `<div class="gasto gasto--abierto gasto--nuevo">${editorFijo(null)}</div>` : ''}
      ${
        activos.length
          ? `<ul class="gastos__lista">${ordenar(activos).map(fila).join('')}</ul>`
          : abierto === 'nuevo-fijo'
          ? ''
          : `<div class="gastos__vacio"><p><strong>Aquí van los gastos que se repiten</strong>: alquiler o hipoteca, luz, móvil, Netflix, el gimnasio, el seguro del coche…</p><p>Apúntalos una vez y Kitsune los cuenta solos cada mes (o cada año) en su día.</p></div>`
      }
      ${baja.length ? `<p class="gastos__dia"><span>Dados de baja</span></p><ul class="gastos__lista">${baja.map(fila).join('')}</ul>` : ''}`;
  }

  function editorFijo(f) {
    const v = f ?? { concepto: '', centimos: 0, categoria: 'casa', frecuencia: 'mensual', dia: Number(hoy.slice(8)), diaSemana: 1, mes: Number(hoy.slice(5, 7)), desde: `${mesDe(hoy)}-01` };
    const activo = f ? fijoActivo(f, hoy) : true;
    return `
      <form class="formulario gasto__editor" data-editar-fijo="${f ? f.id : ''}">
        <div class="formulario__fila">
          <input class="campo" name="concepto" value="${escapar(v.concepto)}" maxlength="80" placeholder="Qué es (alquiler, Netflix…)" aria-label="Concepto" required>
          <input class="campo gasto__campo-importe" name="importe" value="${v.centimos ? escapar(importeCampo(v.centimos)) : ''}" inputmode="decimal" placeholder="€" aria-label="Importe en euros" required>
        </div>
        <div class="formulario__fila">
          <select class="campo" name="categoria" aria-label="Categoría">${opcionesCategoria(v.categoria)}</select>
          <select class="campo" name="frecuencia" aria-label="Cada cuánto">${FRECUENCIAS.map((x) => `<option value="${x.id}" ${x.id === v.frecuencia ? 'selected' : ''}>${x.nombre}</option>`).join('')}</select>
        </div>
        <div class="formulario__fila gasto__cuando">
          <label class="gasto__etiqueta" data-solo="mensual trimestral anual" ${v.frecuencia === 'semanal' ? 'hidden' : ''}>Día
            <input class="campo" type="number" name="dia" min="1" max="31" inputmode="numeric" value="${v.dia}" aria-label="Día en que se cobra">
          </label>
          <label class="gasto__etiqueta" data-solo="anual trimestral" ${v.frecuencia === 'anual' || v.frecuencia === 'trimestral' ? '' : 'hidden'}>${v.frecuencia === 'trimestral' ? 'Empieza en' : 'Mes'}
            <select class="campo" name="mes" aria-label="Mes">${MESES_CORTOS.map((m, i) => `<option value="${i + 1}" ${i + 1 === v.mes ? 'selected' : ''}>${m}</option>`).join('')}</select>
          </label>
          <label class="gasto__etiqueta" data-solo="semanal" ${v.frecuencia === 'semanal' ? '' : 'hidden'}>Los
            <select class="campo" name="diaSemana" aria-label="Día de la semana">${DIAS_SEMANA.map((d, i) => `<option value="${i + 1}" ${i + 1 === v.diaSemana ? 'selected' : ''}>${d}</option>`).join('')}</select>
          </label>
          <label class="gasto__etiqueta">Desde
            <input class="campo" type="date" name="desde" value="${v.desde}" aria-label="Desde cuándo cuenta">
          </label>
        </div>
        <p class="apartado__mensaje" role="alert" hidden></p>
        <div class="formulario__botones">
          <button type="submit" class="boton boton--primario">${f ? 'Guardar' : 'Añadir'}</button>
          <button type="button" class="boton" data-cerrar>Cancelar</button>
          ${
            f
              ? `${activo ? `<button type="button" class="boton" data-baja="${f.id}" title="Deja de contar a partir de ahora; lo ya pagado se queda">Dar de baja</button>` : `<button type="button" class="boton" data-reactivar="${f.id}">Reactivar</button>`}
                 <button type="button" class="boton boton--peligro gasto__borrar" data-borrar-fijo="${f.id}" title="Lo quita también de los meses pasados">${icono('papelera', 14)} Borrar</button>`
              : ''
          }
        </div>
      </form>`;
  }

  // ---------- Resumen ----------

  function panelResumen(r) {
    const meses = historico(datos, mes, 6, hoy);
    const maximo = Math.max(1, ...meses.map((m) => m.total));
    const categorias = r.porCategoria.length
      ? `<ul class="gastos__categorias-resumen">${r.porCategoria
          .map(
            (c) => `<li><button type="button" class="gastos__cat-fila" data-filtrar="${c.id}" title="Ver solo ${escapar(c.nombre)}">
              <span class="gastos__cat-nombre"><span class="gastos__punto" style="--c:${c.color}"></span>${escapar(c.nombre)}</span>
              <span class="gastos__cat-cifra">${escapar(euros(c.centimos))} <small>${Math.round(c.parte * 100)} %</small></span>
              <span class="gastos__cat-barra"><span style="width:${(c.parte * 100).toFixed(1)}%;--c:${c.color}"></span></span>
            </button></li>`,
          )
          .join('')}</ul>`
      : `<p class="gastos__vacio">Sin gastos en ${escapar(nombreMes(mes, { corto: true }))}.</p>`;
    return `
      <p class="gastos__dia"><span>En qué se va ${mes === mesDe(hoy) ? 'este mes' : `en ${escapar(nombreMes(mes, { corto: true }))}`}</span><span>${escapar(euros(r.previsto))}</span></p>
      ${categorias}
      <p class="gastos__dia"><span>Últimos 6 meses</span><span>media ${escapar(euros(Math.round(meses.reduce((s, m) => s + m.total, 0) / meses.length), { redondo: true }))}</span></p>
      <div class="gastos__meses" role="group" aria-label="Gasto de los últimos meses">
        ${meses
          .map(
            (m) => `<button type="button" class="gastos__mes-barra${m.mes === mes ? ' gastos__mes-barra--actual' : ''}" data-ir-mes="${m.mes}" title="${escapar(`${mayuscula(nombreMes(m.mes))}: ${euros(m.total)}`)}">
              <span class="gastos__mes-cifra">${m.total ? escapar(euros(m.total, { redondo: true }).replace(/\s?€/, '')) : ''}</span>
              <span class="gastos__mes-columna"><span style="height:${((m.total / maximo) * 100).toFixed(1)}%"></span></span>
              <span class="gastos__mes-nombre">${MESES_CORTOS[Number(m.mes.slice(5)) - 1]}</span>
            </button>`,
          )
          .join('')}
      </div>
      <form class="gastos__ajuste" data-presupuesto>
        <label for="gastos-presupuesto"><span class="gastos__etiqueta">presupuesto mensual</span>
          <span class="ajuste__ayuda">Lo que quieres gastar como mucho cada mes, fijos incluidos.</span></label>
        <div class="formulario__fila">
          <input class="campo" id="gastos-presupuesto" name="presupuesto" inputmode="decimal" placeholder="por ejemplo 1.500" value="${datos.presupuesto ? escapar(importeCampo(datos.presupuesto)) : ''}">
          <button type="submit" class="boton">Guardar</button>
          ${datos.presupuesto ? '<button type="button" class="boton" data-quitar-presupuesto>Quitar</button>' : ''}
        </div>
      </form>
      <div class="gastos__exportar">
        <span class="gastos__etiqueta">exportar (Excel, Numbers…)</span>
        <div class="formulario__botones">
          <button type="button" class="boton" data-csv="mes">${icono('descargar', 15)} ${escapar(mayuscula(nombreMes(mes, { corto: true })))}</button>
          <button type="button" class="boton" data-csv="anio">${icono('descargar', 15)} Todo ${mes.slice(0, 4)}</button>
        </div>
      </div>`;
  }

  // ---------- Pulsaciones en el panel ----------

  async function alPulsarPanel(e) {
    const b = e.target.closest('button');
    if (!b) return;
    const d = b.dataset;
    if (d.abrir) {
      abierto = abierto === d.abrir ? null : d.abrir;
      pintar();
      if (abierto) {
        const caja = contenedor.querySelector(`[data-gasto="${CSS.escape(abierto)}"], .gasto--nuevo`);
        caja?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        caja?.querySelector('.gasto__editor input')?.focus({ preventScroll: true });
      }
      return;
    }
    if ('cerrar' in d) {
      abierto = null;
      return pintar();
    }
    if ('quitarFiltro' in d) {
      filtro = '';
      return pintar();
    }
    if (d.filtrar) {
      filtro = d.filtrar;
      pestana = 'movimientos';
      return pintar();
    }
    if (d.irMes) {
      mes = d.irMes;
      return pintar();
    }
    if (d.verFijo) {
      pestana = 'fijos';
      abierto = d.verFijo;
      return pintar();
    }
    if (d.borrarMovimiento) {
      const m = datos.movimientos.find((x) => x.id === d.borrarMovimiento);
      abierto = null;
      return guardar(borrarMovimiento(datos, d.borrarMovimiento), { aviso: `Borrado: ${m?.concepto ?? 'gasto'}`, alDeshacer: (antes) => antes });
    }
    if (d.borrarFijo) {
      const f = datos.fijos.find((x) => x.id === d.borrarFijo);
      abierto = null;
      return guardar(borrarFijo(datos, d.borrarFijo), { aviso: `Borrado: ${f?.concepto ?? 'gasto fijo'}`, alDeshacer: (antes) => antes });
    }
    if (d.baja) {
      const f = datos.fijos.find((x) => x.id === d.baja);
      abierto = null;
      return guardar(darDeBajaFijo(datos, d.baja, hoy), { aviso: `${f?.concepto ?? 'Gasto fijo'}: dado de baja`, alDeshacer: (antes) => antes });
    }
    if (d.reactivar) {
      abierto = null;
      return guardar(reactivarFijo(datos, d.reactivar, hoy), { aviso: 'Reactivado' });
    }
    const formOcurrencia = b.closest('[data-editar-ocurrencia]');
    if (formOcurrencia && ('omitir' in d || 'restaurar' in d)) {
      abierto = null;
      const cambio = 'omitir' in d ? { omitido: true } : null;
      return guardar(cambiarOcurrencia(datos, formOcurrencia.dataset.editarOcurrencia, formOcurrencia.dataset.fecha, cambio, hoy), {
        aviso: 'omitir' in d ? 'Este mes no se cuenta' : 'Vuelve a su importe de siempre',
        alDeshacer: (antes) => antes,
      });
    }
    if ('quitarPresupuesto' in d) return guardar(ponerPresupuesto(datos, 0), { aviso: 'Sin presupuesto' });
    if (d.csv) {
      const desde = d.csv === 'mes' ? mes : `${mes.slice(0, 4)}-01`;
      const hasta = d.csv === 'mes' ? mes : `${mes.slice(0, 4)}-12`;
      return entregarCSV(aCSV(datos, desde, hasta, hoy), d.csv === 'mes' ? `gastos-${mes}.csv` : `gastos-${mes.slice(0, 4)}.csv`);
    }
  }

  contenedor.addEventListener('submit', (e) => {
    const form = e.target;
    if (form.id === 'gastos-rapido') return;
    e.preventDefault();
    try {
      enviarFormulario(form);
    } catch (err) {
      const p = form.querySelector('.apartado__mensaje');
      if (p) {
        p.hidden = false;
        p.textContent = err.message;
      }
    }
  });

  // En el editor de un fijo, los campos de «cuándo» cambian con la frecuencia.
  contenedor.addEventListener('change', (e) => {
    if (e.target.name !== 'frecuencia' || !e.target.closest('[data-editar-fijo]')) return;
    const form = e.target.closest('form');
    for (const l of form.querySelectorAll('[data-solo]')) l.hidden = !l.dataset.solo.split(' ').includes(e.target.value);
  });

  function importeDe(valor) {
    const centimos = leerImporte(valor);
    if (!centimos) throw new Error('Escribe un importe válido, por ejemplo 12,50.');
    return centimos;
  }

  function enviarFormulario(form) {
    if (form.dataset.editarMovimiento) {
      const nuevos = editarMovimiento(datos, form.dataset.editarMovimiento, {
        concepto: form.concepto.value,
        centimos: importeDe(form.importe.value),
        categoria: form.categoria.value,
        fecha: form.fecha.value,
        nota: form.nota.value,
      });
      abierto = null;
      if (form.fecha.value && mesDe(form.fecha.value) !== mes) mes = mesDe(form.fecha.value);
      return guardar(nuevos, { aviso: 'Guardado' });
    }
    if ('editarOcurrencia' in form.dataset) {
      abierto = null;
      return guardar(cambiarOcurrencia(datos, form.dataset.editarOcurrencia, form.dataset.fecha, { centimos: importeDe(form.importe.value) }, hoy), {
        aviso: `Este mes: ${euros(importeDe(form.importe.value))}`,
        alDeshacer: (antes) => antes,
      });
    }
    if ('editarFijo' in form.dataset) {
      const campos = {
        concepto: form.concepto.value,
        centimos: importeDe(form.importe.value),
        categoria: form.categoria.value,
        frecuencia: form.frecuencia.value,
        dia: Math.min(31, Math.max(1, Number(form.dia.value) || 1)),
        mes: Number(form.mes.value),
        diaSemana: Number(form.diaSemana.value),
        desde: form.desde.value || `${mesDe(hoy)}-01`,
      };
      if (!campos.concepto.trim()) throw new Error('Pon qué es: alquiler, Netflix…');
      const id = form.dataset.editarFijo;
      abierto = null;
      if (id) return guardar(editarFijo(datos, id, campos, hoy), { aviso: 'Guardado' });
      return guardar(anadirFijo(datos, campos, hoy).datos, { aviso: `Gasto fijo: ${campos.concepto.trim()} · ${euros(campos.centimos)}`, alDeshacer: (antes) => antes });
    }
    if ('presupuesto' in form.dataset) {
      const texto = form.presupuesto.value.trim();
      return guardar(ponerPresupuesto(datos, texto ? importeDe(texto) : 0), { aviso: texto ? `Presupuesto: ${euros(importeDe(texto))} al mes` : 'Sin presupuesto' });
    }
  }

  // ---------- Aviso con «Deshacer» ----------

  function avisar(texto, alDeshacer = null) {
    const caja = contenedor.querySelector('#gastos-aviso');
    if (!caja) return;
    clearTimeout(temporizadorAviso);
    deshacer = alDeshacer;
    caja.innerHTML = `<span></span>${alDeshacer ? '<button type="button" class="gastos__deshacer">Deshacer</button>' : ''}`;
    caja.querySelector('span').textContent = texto;
    caja.hidden = false;
    caja.querySelector('button')?.addEventListener('click', async () => {
      caja.hidden = true;
      const accion = deshacer;
      deshacer = null;
      await accion?.();
    });
    temporizadorAviso = setTimeout(() => {
      caja.hidden = true;
      deshacer = null;
    }, 5000);
  }

  return {
    mostrar,
    // Cambios de otro dispositivo o del chat.
    async recargar() {
      await cargar();
      if (contenedor.querySelector('.gastos')) pintar();
    },
    // Desde Hoy o el buscador: enfocar la línea rápida.
    apuntar() {
      contenedor.querySelector('#gastos-texto')?.focus();
    },
    abrirPestana(nombre) {
      pestana = nombre;
      abierto = null;
      if (contenedor.querySelector('.gastos')) pintar();
    },
  };
}
