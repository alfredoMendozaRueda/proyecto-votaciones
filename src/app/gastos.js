// Gastos: cuánto se va este mes de un vistazo y apuntar un gasto en dos
// segundos. Se escribe como se diría («12,50 súper», «netflix 13 al mes»,
// «ayer 30 gasolina») y Kitsune entiende el importe, la fecha, la categoría y
// si se repite. Los fijos (alquiler, suscripciones…) se cuentan solos cada mes.
import { icono } from './iconos.js';
import {
  CATEGORIAS,
  CATEGORIAS_INGRESO,
  esCategoriaIngreso,
  adivinarCategoria,
  adivinarIngreso,
  ponerSaldo,
  saldoDe,
  saldosAlFinal,
  nombreCuenta,
  otraCuenta,
  conceptoTraspaso,
  anadirTraspaso,
  editarTraspaso,
  borrarTraspaso,
  apuntarMovimiento,
  fijoQueEs,
  prevision,
  serieBalance,
  totalIngresosFijosAlMes,
  FRECUENCIAS,
  DIAS_SEMANA,
  categoria,
  euros,
  aprox,
  fechaISO,
  mesDe,
  nombreMes,
  sumarMeses,
  sumarDias,
  interpretarGasto,
  leerImporte,
  normalizarGastos,
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
// Lo que el usuario elige a mano en la línea rápida (manda sobre lo que se adivina).
const NADA_ELEGIDO = () => ({ categoria: null, fecha: null, repite: null, frecuencia: 'mensual', dia: null, tipo: null, cuenta: null, de: null });
// «Banco ~2.300 € · efectivo ~45 €» (lo que se sepa).
const textoSaldos = (s, formato) =>
  [s.banco !== null ? `banco ${formato(s.banco)}` : '', s.efectivo !== null ? `efectivo ${formato(s.efectivo)}` : ''].filter(Boolean).join(' · ');
// «1,50» para un campo de importe.
const importeCampo = (centimos) => (centimos / 100).toFixed(2).replace('.', ',').replace(/,00$/, '');

function diaLegible(fecha, hoy) {
  if (fecha === hoy) return 'Hoy';
  if (fecha === sumarDias(hoy, -1)) return 'Ayer';
  if (fecha === sumarDias(hoy, 1)) return 'Mañana';
  const [a, m, d] = fecha.split('-').map(Number);
  return mayuscula(new Date(a, m - 1, d).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }));
}
// «+420», «−1,2k»: para la gráfica, donde cabe poco.
function corto(centimos, { signo = false } = {}) {
  const e = Math.round(centimos / 100);
  const abs = Math.abs(e);
  const texto = abs >= 10000 ? `${Math.round(abs / 1000)}k` : abs >= 1000 ? `${(abs / 1000).toFixed(1).replace('.', ',').replace(',0', '')}k` : String(abs);
  return `${e < 0 ? '−' : signo && e > 0 ? '+' : ''}${texto}`;
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
  let elegido = NADA_ELEGIDO();
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
      if (!texto.value.trim()) elegido = NADA_ELEGIDO();
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
    const p = prevision(datos, mes, hoy);
    const etiqueta = futuro ? `previsto para ${nombreMes(mes, { corto: true })}` : mes === actual ? 'gastado este mes' : `gastado en ${nombreMes(mes, { corto: true })}`;
    const cifra = futuro ? p.gastos : r.gastado;
    const anterior = resumenMes(datos, sumarMeses(mes, -1), hoy);
    let comparacion = '';
    if (!futuro && anterior.previsto && mes !== actual) {
      const cambio = Math.round(((r.previsto - anterior.previsto) / anterior.previsto) * 100);
      comparacion = cambio === 0 ? 'igual que el mes anterior' : `${cambio > 0 ? '+' : '−'}${Math.abs(cambio)} % que ${nombreMes(sumarMeses(mes, -1), { corto: true })}`;
    }
    const detalle = [
      r.enEfectivo && !futuro ? `${euros(r.enEfectivo, { redondo: true })} en efectivo` : '',
      r.pendiente && !futuro ? `+ ${euros(r.pendiente, { redondo: true })} de fijos por pagar` : '',
      // A fin de mes: lo previsto más lo que falta del día a día (según tus meses anteriores).
      mes === actual && (r.pendiente || p.estimado) ? `a fin de mes, ~${aprox(p.gastos)}` : '',
      futuro && p.motivo ? `${p.factor > 1 ? 'más' : 'menos'} de lo normal: ${p.motivo}` : '',
      comparacion,
    ].filter(Boolean);
    // Ingresos y ahorro: lo real en los meses pasados; lo previsto en este y los que vienen.
    const ingresos = futuro || mes === actual ? p.ingresos : r.ingresos;
    const ahorro = futuro || mes === actual ? p.ahorro : r.ingresos - r.previsto;
    const balance = ingresos
      ? `<p class="gastos__balance">Ingresos <strong class="gastos__mas">+${escapar(mes < actual ? euros(ingresos, { redondo: true }) : aprox(ingresos))}</strong> · ${
          mes < actual ? (ahorro >= 0 ? 'ahorraste' : 'gastaste de más') : ahorro >= 0 ? 'ahorrarás ~' : 'gastarás de más ~'
        }<strong class="${ahorro >= 0 ? 'gastos__mas' : 'gastos__menos'}">${escapar(mes < actual ? euros(Math.abs(ahorro), { redondo: true }) : aprox(Math.abs(ahorro)))}</strong></p>`
      : '';
    const s = saldosAlFinal(datos, mes, hoy);
    const ambos = s.banco !== null && s.efectivo !== null;
    const lineaSaldo =
      s.total !== null && mes >= actual
        ? `<p class="gastos__balance">${ambos ? 'Tendrás a fin de mes' : s.banco !== null ? 'En el banco a fin de mes' : 'En efectivo a fin de mes'} <strong>~${escapar(aprox(s.total))}</strong>${
            ambos ? ` <span class="gastos__saldos">(${escapar(textoSaldos(s, (c) => `~${aprox(c)}`))})</span>` : ''
          }</p>`
        : '';
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
    } else if (datos.movimientos.length || datos.fijos.length) {
      presupuesto = `<button type="button" class="gastos__enlace" data-ir-presupuesto>Ponte un presupuesto mensual</button>`;
    }
    contenedor.querySelector('#gastos-cifra').innerHTML = `
      <p class="gastos__etiqueta">${escapar(etiqueta)}</p>
      <p class="gastos__total">${futuro ? `~${escapar(aprox(cifra))}` : escapar(euros(cifra))}</p>
      ${detalle.length ? `<p class="gastos__detalle">${escapar(detalle.join(' · '))}</p>` : ''}
      ${balance}${lineaSaldo}
      ${presupuesto}`;
  }

  // ---------- La línea rápida ----------

  function interpretacion() {
    const texto = contenedor.querySelector('#gastos-texto')?.value ?? '';
    const i = interpretarGasto(texto, hoy);
    // Gasto (resta), ingreso (suma) o saldo (lo que hay en la cuenta): lo adivinado o lo que elijas.
    const tipo = elegido.tipo ?? i.tipo;
    const ingreso = tipo === 'ingreso';
    const repite = tipo === 'saldo' || tipo === 'traspaso' ? false : elegido.repite ?? Boolean(i.fijo);
    const adivinada = ingreso === i.ingreso ? i.categoria : ingreso ? adivinarIngreso(i.concepto) : adivinarCategoria(i.concepto);
    return {
      ...i,
      tipo,
      ingreso,
      categoria: elegido.categoria && esCategoriaIngreso(elegido.categoria) === ingreso ? elegido.categoria : adivinada,
      fecha: elegido.fecha ?? i.fecha,
      repite,
      frecuencia: elegido.repite === null && i.fijo ? i.fijo.frecuencia : elegido.frecuencia,
      dia: elegido.dia ?? Number((elegido.fecha ?? i.fecha).slice(8)),
      // Banco o efectivo (sin decir nada, el banco). En un traspaso, de dónde sale.
      cuenta: elegido.cuenta ?? (i.tipo === 'traspaso' ? null : i.cuenta) ?? 'banco',
      de: elegido.de ?? (i.tipo === 'traspaso' ? i.cuenta : null) ?? 'banco',
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
    // Si ya es un fijo (la nómina, el alquiler), se ajusta ese mes en vez de sumarlo otra vez.
    const yaFijo = i.centimos && !i.repite && i.tipo !== 'saldo' && i.tipo !== 'traspaso' ? fijoQueEs(datos, { concepto: i.concepto || categoria(i.categoria).nombre, categoria: i.categoria, ingreso: i.ingreso, fecha: i.fecha }) : null;
    const explicacion =
      i.tipo === 'traspaso'
        ? i.de === 'banco'
          ? `Pasas ${euros(i.centimos ?? 0)} del banco al efectivo: no es un gasto, el total no cambia.`
          : `Pasas ${euros(i.centimos ?? 0)} del efectivo al banco: no es un ingreso, el total no cambia.`
        : i.tipo === 'saldo'
        ? i.cuenta === 'efectivo'
          ? 'Lo que llevas en efectivo: no suma ni resta, es desde donde calculo cómo acabas cada mes.'
          : 'Lo que tienes en el banco: no suma ni resta, es desde donde calculo cómo acabas cada mes.'
        : yaFijo
        ? yaFijo.centimos === i.centimos
          ? `Ya cuento «${yaFijo.fijo.concepto}» del ${fechaCorta(yaFijo.fecha)}: no lo sumo otra vez.`
          : `Es «${yaFijo.fijo.concepto}» del ${fechaCorta(yaFijo.fecha)}: lo dejo en ${euros(i.centimos)} ese mes (normalmente ${euros(yaFijo.centimos)}), sin sumarlo otra vez.`
        : i.ingreso
        ? `Suma a lo que entra este mes${i.cuenta === 'efectivo' ? ', en efectivo' : ''}.`
        : i.cuenta === 'efectivo'
        ? 'Sale de tu efectivo, no del banco.'
        : '';
    const titulo = i.tipo === 'traspaso' ? conceptoTraspaso(i.de) : i.tipo === 'saldo' ? (i.cuenta === 'efectivo' ? 'Tu efectivo' : 'Saldo del banco') : i.concepto || categoria(i.categoria).nombre;
    const signo = i.ingreso ? '+' : i.tipo === 'gasto' ? '−' : i.tipo === 'traspaso' ? '⇄ ' : '';
    const cuentas =
      i.tipo === 'traspaso'
        ? `<div class="gastos__cuenta" role="group" aria-label="De dónde a dónde">
            <button type="button" class="chip" data-de="banco" aria-pressed="${i.de === 'banco'}">${icono('tarjeta', 13)} Banco → efectivo</button>
            <button type="button" class="chip" data-de="efectivo" aria-pressed="${i.de === 'efectivo'}">${icono('billete', 13)} Efectivo → banco</button>
          </div>`
        : `<div class="gastos__cuenta" role="group" aria-label="${i.tipo === 'saldo' ? 'Dónde' : 'Cómo lo pagas'}">
            <button type="button" class="chip" data-cuenta="banco" aria-pressed="${i.cuenta === 'banco'}" title="Tarjeta, Bizum, domiciliado…">${icono('tarjeta', 13)} Banco</button>
            <button type="button" class="chip" data-cuenta="efectivo" aria-pressed="${i.cuenta === 'efectivo'}" title="En efectivo, en mano">${icono('billete', 13)} Efectivo</button>
          </div>`;
    caja.innerHTML = `
      <p class="gastos__entiendo">${
        i.centimos
          ? `<strong>${escapar(titulo)}</strong> · <span class="${i.ingreso ? 'gastos__mas' : i.tipo === 'gasto' ? 'gastos__resta' : ''}">${signo}${escapar(euros(i.centimos))}</span> · ${
              i.repite ? escapar(textoRepite(i)) : escapar(diaLegible(i.fecha, hoy).toLowerCase())
            }`
          : 'Escribe también cuánto: «12,50 súper», «nómina 1.850», «tengo 2.300», «he sacado 50 del cajero»'
      }</p>
      ${explicacion && i.centimos ? `<p class="gastos__explica">${escapar(explicacion)}</p>` : ''}
      <div class="gastos__tipo" role="group" aria-label="Qué es">
        <button type="button" class="chip" data-tipo="gasto" aria-pressed="${i.tipo === 'gasto'}" title="Lo que gastas: resta">− Gasto</button>
        <button type="button" class="chip" data-tipo="ingreso" aria-pressed="${i.tipo === 'ingreso'}" title="Lo que te entra: suma">+ Ingreso</button>
        <button type="button" class="chip" data-tipo="saldo" aria-pressed="${i.tipo === 'saldo'}" title="Lo que tienes en el banco o en efectivo">= Saldo</button>
        <button type="button" class="chip" data-tipo="traspaso" aria-pressed="${i.tipo === 'traspaso'}" title="Sacar del cajero o ingresar efectivo en el banco: no es gasto ni ingreso">⇄ Cajero</button>
      </div>
      ${i.tipo === 'saldo' || i.tipo === 'traspaso' ? '' : `<div class="gastos__categorias" role="group" aria-label="Categoría">
        ${(i.ingreso ? CATEGORIAS_INGRESO : CATEGORIAS).map(
          (c) => `<button type="button" class="gastos__categoria" data-categoria="${c.id}" aria-pressed="${c.id === i.categoria}" style="--c:${c.color}"><span class="gastos__punto"></span>${escapar(c.nombre)}</button>`,
        ).join('')}
      </div>`}
      <div class="gastos__opciones">
        ${cuentas}
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
        ${i.tipo === 'saldo' || i.tipo === 'traspaso' ? '' : `<button type="button" class="chip gastos__repite" data-repite aria-pressed="${i.repite}">${icono('actualizar', 13)} Se repite</button>`}
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
    else if (b.dataset.cuenta) elegido.cuenta = b.dataset.cuenta;
    else if (b.dataset.de) elegido.de = b.dataset.de;
    else if (b.dataset.tipo) {
      elegido.tipo = b.dataset.tipo;
      elegido.categoria = null;
    }
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
    const cuando = i.fecha === hoy ? ' hoy' : ` el ${fechaCorta(i.fecha)}`;
    if (i.tipo === 'saldo') {
      mes = mesDe(hoy);
      await guardar(ponerSaldo(datos, i.centimos, i.fecha, i.cuenta), { aviso: `${i.cuenta === 'efectivo' ? 'En efectivo' : 'En el banco'}: ${euros(i.centimos)}${cuando}`, alDeshacer: (antes) => antes });
    } else if (i.tipo === 'traspaso') {
      mes = mesDe(i.fecha);
      await guardar(anadirTraspaso(datos, { centimos: i.centimos, fecha: i.fecha, de: i.de }).datos, {
        aviso: `${conceptoTraspaso(i.de)}: ${euros(i.centimos)} (${nombreCuenta(i.de).toLowerCase()} → ${nombreCuenta(otraCuenta(i.de)).toLowerCase()})`,
        alDeshacer: (antes) => antes,
      });
    } else if (i.repite) {
      const [a, m, d] = i.fecha.split('-').map(Number);
      const r = anadirFijo(datos, {
        concepto,
        centimos: i.centimos,
        categoria: i.categoria,
        ingreso: i.ingreso,
        cuenta: i.cuenta,
        frecuencia: i.frecuencia,
        dia: i.dia,
        mes: m,
        diaSemana: ((new Date(a, m - 1, d).getDay() + 6) % 7) + 1,
        desde: `${mesDe(i.fecha)}-01`,
      }, hoy);
      await guardar(r.datos, { aviso: `${i.ingreso ? 'Ingreso' : 'Gasto'} fijo: ${concepto} · ${i.ingreso ? '+' : ''}${euros(i.centimos)} ${textoRepite(i)}`, alDeshacer: (antes) => antes });
    } else {
      const { datos: nuevos, resultado } = apuntarMovimiento(datos, { concepto, centimos: i.centimos, categoria: i.categoria, ingreso: i.ingreso, fecha: i.fecha, cuenta: i.cuenta }, hoy);
      mes = mesDe(resultado.fecha);
      const aviso =
        resultado.tipo === 'fijo-ajustado'
          ? resultado.igual
            ? `Ya contado: ${resultado.concepto} del ${fechaCorta(resultado.fecha)}`
            : `${resultado.concepto} de ${nombreMes(mesDe(resultado.fecha), { corto: true })}: ${euros(i.centimos)}`
          : `${i.ingreso ? 'Ingreso' : 'Gasto'}: ${concepto} · ${i.ingreso ? '+' : '−'}${euros(i.centimos)}${i.cuenta === 'efectivo' ? ' en efectivo' : ''}`;
      await guardar(nuevos, { aviso, alDeshacer: (antes) => antes });
    }
    campo.value = '';
    elegido = NADA_ELEGIDO();
    pintarPrevia();
    campo.focus();
  }

  // ---------- Movimientos del mes ----------

  function filaGasto(x) {
    const c = categoria(x.categoria);
    const detalle = [
      c.nombre,
      x.tipo === 'fijo' ? (x.pendiente ? `fijo · ${x.ingreso ? 'llega' : 'se cobra'} el ${fechaCorta(x.fecha)}` : x.cambiado ? 'fijo · importe de este mes' : 'fijo') : '',
      x.cuenta === 'efectivo' ? 'en efectivo' : '',
      x.nota,
    ].filter(Boolean);
    const id = x.tipo === 'fijo' ? x.id : x.id;
    return `
      <li class="gasto${x.pendiente ? ' gasto--pendiente' : ''}${x.ingreso ? ' gasto--ingreso' : ''}${abierto === id ? ' gasto--abierto' : ''}" data-gasto="${escapar(id)}">
        <button type="button" class="gasto__fila" data-abrir="${escapar(id)}" aria-expanded="${abierto === id}">
          <span class="gasto__punto" style="--c:${c.color}" aria-hidden="true">${x.tipo === 'fijo' ? icono('actualizar', 11) : ''}</span>
          <span class="gasto__cuerpo"><span class="gasto__concepto">${escapar(x.concepto)}</span><span class="gasto__detalle">${escapar(detalle.join(' · '))}</span></span>
          <span class="gasto__importe">${x.ingreso ? '+' : ''}${escapar(euros(x.centimos))}</span>
        </button>
        ${abierto === id ? (x.tipo === 'fijo' ? editorOcurrencia(x) : editorMovimiento(x)) : ''}
      </li>`;
  }

  // Sacar del cajero o ingresar efectivo: ni suma ni resta, solo cambia de sitio.
  function filaTraspaso(t) {
    return `
      <li class="gasto gasto--traspaso${abierto === t.id ? ' gasto--abierto' : ''}" data-gasto="${escapar(t.id)}">
        <button type="button" class="gasto__fila" data-abrir="${escapar(t.id)}" aria-expanded="${abierto === t.id}">
          <span class="gasto__punto" aria-hidden="true">${icono('traspaso', 13)}</span>
          <span class="gasto__cuerpo"><span class="gasto__concepto">${escapar(t.concepto)}</span><span class="gasto__detalle">${escapar([`${nombreCuenta(t.de)} → ${nombreCuenta(t.a).toLowerCase()} · no es gasto`, t.nota].filter(Boolean).join(' · '))}</span></span>
          <span class="gasto__importe">${escapar(euros(t.centimos))}</span>
        </button>
        ${abierto === t.id ? editorTraspaso(t) : ''}
      </li>`;
  }

  function editorTraspaso(t) {
    return `
      <form class="formulario gasto__editor" data-editar-traspaso="${escapar(t.id)}">
        <div class="formulario__fila">
          <select class="campo" name="de" aria-label="De dónde a dónde">
            <option value="banco" ${t.de === 'banco' ? 'selected' : ''}>Banco → efectivo</option>
            <option value="efectivo" ${t.de === 'efectivo' ? 'selected' : ''}>Efectivo → banco</option>
          </select>
          <input class="campo gasto__campo-importe" name="importe" value="${escapar(importeCampo(t.centimos))}" inputmode="decimal" aria-label="Importe en euros" required>
        </div>
        <div class="formulario__fila">
          <input class="campo" type="date" name="fecha" value="${t.fecha}" aria-label="Fecha" required>
          <input class="campo" name="nota" value="${escapar(t.nota ?? '')}" maxlength="200" placeholder="Nota (opcional)" aria-label="Nota">
        </div>
        <p class="apartado__mensaje" role="alert" hidden></p>
        <div class="formulario__botones">
          <button type="submit" class="boton boton--primario">Guardar</button>
          <button type="button" class="boton" data-cerrar>Cancelar</button>
          <button type="button" class="boton boton--peligro gasto__borrar" data-borrar-traspaso="${escapar(t.id)}">${icono('papelera', 14)} Borrar</button>
        </div>
      </form>`;
  }

  function panelMovimientos(r) {
    const lista = filtro ? r.lista.filter((x) => x.categoria === filtro) : r.lista;
    const traspasos = filtro ? [] : r.traspasos;
    const chipFiltro = filtro
      ? `<button type="button" class="chip chip--acento gastos__filtro" data-quitar-filtro>Solo ${escapar(categoria(filtro).nombre)} · ${escapar(euros(lista.reduce((s, x) => s + x.centimos, 0)))} ${icono('cerrar', 12)}</button>`
      : '';
    if (!lista.length && !traspasos.length) {
      const vacio = !datos.movimientos.length && !datos.fijos.length && !datos.traspasos.length;
      return `${chipFiltro}<div class="gastos__vacio">${
        vacio
          ? `<p><strong>Apunta tu primer gasto</strong> arriba, como lo dirías: «12,50 súper», «ayer 30 gasolina».</p>
             <p>Para lo que se repite (alquiler, Netflix, el gimnasio…) añade «al mes» o pulsa «Se repite»: se contará solo cada mes.</p>
             <p>También puedes decírselo a Kitsune en el chat: «apunta 8 € del cine».</p>`
          : `<p>Nada apuntado en ${escapar(nombreMes(mes, { corto: true }))}${filtro ? ` en ${escapar(categoria(filtro).nombre)}` : ''}.</p>`
      }</div>`;
    }
    const pendientes = lista.filter((x) => x.pendiente).sort((a, b) => a.fecha.localeCompare(b.fecha));
    const porPagar = pendientes.filter((x) => !x.ingreso);
    const porCobrar = pendientes.filter((x) => x.ingreso);
    const pasados = [...lista.filter((x) => !x.pendiente), ...traspasos].sort((a, b) => b.fecha.localeCompare(a.fecha) || (b.creado ?? 0) - (a.creado ?? 0));
    const dias = new Map();
    for (const x of pasados) dias.set(x.fecha, [...(dias.get(x.fecha) ?? []), x]);
    const suma = (xs) => xs.reduce((s, x) => s + x.centimos, 0);
    // El total del día: lo gastado y, si hubo, lo que entró.
    // (Lo que se saca del cajero no cuenta: no es gasto.)
    const totalDia = (xs) => {
      const g = suma(xs.filter((x) => !x.ingreso && x.tipo !== 'traspaso'));
      const i = suma(xs.filter((x) => x.ingreso));
      return [g ? euros(g) : '', i ? `+${euros(i)}` : ''].filter(Boolean).join(' · ');
    };
    const grupo = (titulo, xs, total) =>
      `<div class="gastos__grupo"><p class="gastos__dia"><span>${titulo}</span><span>${escapar(total)}</span></p><ul class="gastos__lista">${xs.map((x) => (x.tipo === 'traspaso' ? filaTraspaso(x) : filaGasto(x))).join('')}</ul></div>`;
    return `
      ${chipFiltro}
      ${porCobrar.length ? grupo('Por cobrar este mes', porCobrar, `+${euros(suma(porCobrar))}`) : ''}
      ${porPagar.length ? grupo('Por pagar este mes', porPagar, euros(suma(porPagar))) : ''}
      ${[...dias]
        .map(([fecha, xs]) => grupo(`${escapar(diaLegible(fecha, hoy))}${fecha === hoy || fecha === sumarDias(hoy, -1) ? ` · ${fechaCorta(fecha)}` : ''}`, xs, totalDia(xs)))
        .join('')}
      ${
        r.omitidos.length && !filtro
          ? `<p class="ajuste__ayuda apartado__nota">Este mes no se cuentan: ${escapar(r.omitidos.map((o) => o.concepto).join(', '))}.</p>`
          : ''
      }`;
  }

  const opciones = (lista, actual) => lista.map((c) => `<option value="${c.id}" ${c.id === actual ? 'selected' : ''}>${escapar(c.nombre)}</option>`).join('');
  // Gasto o ingreso se decide con la categoría (Nómina, Pagas y extras… son de ingreso).
  const opcionesCategoria = (actual) => `<optgroup label="Gasto">${opciones(CATEGORIAS, actual)}</optgroup><optgroup label="Ingreso">${opciones(CATEGORIAS_INGRESO, actual)}</optgroup>`;

  const selectorCuenta = (actual) =>
    `<select class="campo gasto__cuenta" name="cuenta" aria-label="Banco o efectivo"><option value="banco" ${actual !== 'efectivo' ? 'selected' : ''}>Banco</option><option value="efectivo" ${actual === 'efectivo' ? 'selected' : ''}>Efectivo</option></select>`;

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
        <div class="formulario__fila">
          ${selectorCuenta(m.cuenta)}
          <input class="campo" name="nota" value="${escapar(m.nota ?? '')}" maxlength="200" placeholder="Nota (opcional)" aria-label="Nota">
        </div>
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
    const ordenar = (xs) =>
      [...xs].sort((a, b) => (proximaFecha(a, hoy)?.fecha ?? '9999').localeCompare(proximaFecha(b, hoy)?.fecha ?? '9999') || a.concepto.localeCompare(b.concepto, 'es'));
    const activos = datos.fijos.filter((f) => fijoActivo(f, hoy));
    const gastosFijos = activos.filter((f) => !f.ingreso);
    const ingresosFijos = activos.filter((f) => f.ingreso);
    const baja = datos.fijos.filter((f) => !fijoActivo(f, hoy));
    const fila = (f) => {
      const c = categoria(f.categoria);
      const proxima = proximaFecha(f, hoy);
      const detalle = [cuandoFijo(f), fijoActivo(f, hoy) ? (proxima ? `próximo ${fechaCorta(proxima.fecha)}` : '') : `de baja desde el ${fechaCorta(f.hasta)}`];
      return `
        <li class="gasto${abierto === f.id ? ' gasto--abierto' : ''}${f.ingreso ? ' gasto--ingreso' : ''}${fijoActivo(f, hoy) ? '' : ' gasto--baja'}" data-gasto="${f.id}">
          <button type="button" class="gasto__fila" data-abrir="${f.id}" aria-expanded="${abierto === f.id}">
            <span class="gasto__punto" style="--c:${c.color}" aria-hidden="true">${icono('actualizar', 11)}</span>
            <span class="gasto__cuerpo"><span class="gasto__concepto">${escapar(f.concepto)}</span><span class="gasto__detalle">${escapar(detalle.filter(Boolean).join(' · '))}</span></span>
            <span class="gasto__importe">${f.ingreso ? '+' : ''}${escapar(euros(f.centimos))}${f.frecuencia !== 'mensual' ? `<small>${escapar(euros(alMes(f), { redondo: true }))}/mes</small>` : ''}</span>
          </button>
          ${abierto === f.id ? editorFijo(f) : ''}
        </li>`;
    };
    const ingresosMes = totalIngresosFijosAlMes(datos, hoy);
    return `
      <div class="gastos__fijos-cabecera">
        <p><span class="gastos__etiqueta">tus gastos fijos</span><strong>${escapar(euros(totalFijosAlMes(datos, hoy)))}</strong> al mes${
          ingresosMes ? ` · ingresos fijos <strong class="gastos__mas gastos__fijos-ingresos">+${escapar(euros(ingresosMes, { redondo: true }))}</strong>` : ''
        }</p>
        <button type="button" class="boton" data-abrir="nuevo-fijo">${icono('nueva', 15)} Nuevo</button>
      </div>
      ${abierto === 'nuevo-fijo' ? `<div class="gasto gasto--abierto gasto--nuevo">${editorFijo(null)}</div>` : ''}
      ${ingresosFijos.length ? `<p class="gastos__dia"><span>Ingresos</span><span>+${escapar(euros(ingresosMes))}/mes</span></p><ul class="gastos__lista">${ordenar(ingresosFijos).map(fila).join('')}</ul>` : ''}
      ${
        gastosFijos.length
          ? `${ingresosFijos.length ? `<p class="gastos__dia"><span>Gastos</span><span>${escapar(euros(totalFijosAlMes(datos, hoy)))}/mes</span></p>` : ''}<ul class="gastos__lista">${ordenar(gastosFijos).map(fila).join('')}</ul>`
          : abierto === 'nuevo-fijo'
          ? ''
          : `<div class="gastos__vacio"><p><strong>Aquí van los gastos que se repiten</strong>: alquiler o hipoteca, luz, móvil, Netflix, el gimnasio, el seguro del coche…</p><p>Apúntalos una vez y Kitsune los cuenta solos cada mes (o cada año) en su día.</p></div>`
      }
      ${
        !ingresosFijos.length && abierto !== 'nuevo-fijo'
          ? `<p class="ajuste__ayuda apartado__nota">Apunta también tu nómina (por ejemplo «nómina 1.850 al mes») para ver cuánto ahorras y la previsión de los próximos meses.</p>`
          : ''
      }
      ${baja.length ? `<p class="gastos__dia"><span>Dados de baja</span></p><ul class="gastos__lista">${baja.map(fila).join('')}</ul>` : ''}`;
  }

  function editorFijo(f) {
    const v = f ?? { concepto: '', centimos: 0, categoria: 'casa', frecuencia: 'mensual', dia: Number(hoy.slice(8)), diaSemana: 1, mes: Number(hoy.slice(5, 7)), desde: `${mesDe(hoy)}-01`, cuenta: 'banco' };
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
          <label class="gasto__etiqueta">Con
            ${selectorCuenta(v.cuenta)}
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

  // La gráfica de ingresos y gastos: los 5 meses anteriores, este y los 3 siguientes (estimados).
  function graficaBalance() {
    const serie = serieBalance(datos, hoy);
    if (!serie.some((m) => m.gastos || m.ingresos)) return '';
    const maximo = Math.max(1, ...serie.flatMap((m) => [m.gastos, m.ingresos]));
    const alto = (c) => `${((c / maximo) * 100).toFixed(1)}%`;
    const conSaldo = serie.some((m) => m.saldo !== null);
    const conIngresos = serie.some((m) => m.ingresos);
    const columnas = serie
      .map((m) => {
        const nombre = MESES_CORTOS[Number(m.mes.slice(5)) - 1];
        const parteEstimada = m.gastos ? (m.tipo === 'futuro' ? 100 : (m.estimado / m.gastos) * 100) : 0;
        const titulo = `${mayuscula(nombreMes(m.mes))}${m.tipo === 'futuro' ? ' (estimado)' : m.tipo === 'actual' ? ' (en curso)' : ''}: gastos ${euros(m.gastos)}${m.ingresos ? `, ingresos ${euros(m.ingresos)}, ${m.ahorro >= 0 ? 'ahorro' : 'déficit'} ${euros(Math.abs(m.ahorro))}` : ''}${m.motivo && m.tipo !== 'pasado' ? ` · ${m.motivo}` : ''}`;
        return `<button type="button" class="balance__mes balance__mes--${m.tipo}${m.mes === mes ? ' balance__mes--visto' : ''}" data-ir-mes="${m.mes}" title="${escapar(titulo)}" aria-label="${escapar(titulo)}">
          <span class="balance__barras">
            ${conIngresos ? `<span class="balance__barra balance__barra--ingreso" style="height:${alto(m.ingresos)}"></span>` : ''}
            <span class="balance__barra balance__barra--gasto" style="height:${alto(m.gastos)}"><span class="balance__estimado" style="height:${parteEstimada.toFixed(1)}%"></span></span>
          </span>
          <span class="balance__nombre">${nombre}${m.tipo === 'futuro' && m.motivo ? '<i class="balance__marca" aria-hidden="true"></i>' : ''}</span>
          ${conIngresos ? `<span class="balance__ahorro ${m.ahorro >= 0 ? 'gastos__mas' : 'gastos__menos'}">${corto(m.ahorro, { signo: true })}</span>` : ''}
          ${conSaldo ? `<span class="balance__saldo">${m.saldo === null ? '·' : corto(m.saldo)}</span>` : ''}
        </button>`;
      })
      .join('');
    // Lo que viene: el mes que viene, con su porqué.
    const siguiente = serie.find((m) => m.tipo === 'futuro');
    const fijos = siguiente.fijos;
    const variable = siguiente.diaADia;
    const porque = siguiente.motivo
      ? siguiente.factor > 1
        ? `, +${Math.round((siguiente.factor - 1) * 100)} % por ${siguiente.motivo}`
        : `, −${Math.round((1 - siguiente.factor) * 100)} %: ${siguiente.motivo}`
      : '';
    const texto = `<strong>${mayuscula(nombreMes(siguiente.mes, { corto: true }))}</strong>: estimo <strong>~${aprox(siguiente.gastos)}</strong> de gastos (${aprox(fijos)} fijos${
      variable ? ` + ~${aprox(variable)} del día a día${porque}` : ''
    }${siguiente.añoPasado ? `, contando lo que gastaste el ${nombreMes(siguiente.mes, { corto: true })} pasado` : ''})${
      siguiente.ingresos ? ` e ingresos de ${euros(siguiente.ingresos, { redondo: true })}: ${siguiente.ahorro >= 0 ? `ahorrarías <strong class="gastos__mas">~${aprox(siguiente.ahorro)}</strong>` : `te faltarían <strong class="gastos__menos">~${aprox(-siguiente.ahorro)}</strong>`}` : ''
    }.${
      siguiente.saldo !== null
        ? siguiente.saldos.banco !== null && siguiente.saldos.efectivo !== null
          ? ` Acabarías el mes con ~${aprox(siguiente.saldo)} (${textoSaldos(siguiente.saldos, (c) => `~${aprox(c)}`)}).`
          : ` Acabarías el mes con ~${aprox(siguiente.saldo)} ${siguiente.saldos.banco !== null ? 'en el banco' : 'en efectivo'}.`
        : ''
    }${
      !siguiente.fiable ? ' <span class="gastos__nota-fina">Con pocos meses apuntados la estimación es aproximada; mejora sola con el tiempo.</span>' : ''
    }`;
    return `
      <p class="gastos__dia"><span>Ingresos y gastos</span><span>${conIngresos ? 'por mes' : ''}</span></p>
      <p class="balance__leyenda">${conIngresos ? '<i class="balance__ley balance__ley--ingreso"></i>ingresos ' : ''}<i class="balance__ley balance__ley--gasto"></i>gastos <i class="balance__ley balance__ley--estimado"></i>estimado <i class="balance__marca balance__marca--ley"></i>época especial</p>
      <div class="balance" style="--columnas:${serie.length}" role="group" aria-label="Ingresos y gastos por mes, con la previsión de los próximos">${columnas}</div>
      ${conIngresos || conSaldo ? `<p class="balance__pie">Debajo de cada mes: ${conIngresos ? '<span class="gastos__mas">lo que ahorras</span>' : ''}${conIngresos && conSaldo ? ' y ' : ''}${conSaldo ? 'el saldo con que acabas' : ''} (en euros; k = mil).</p>` : ''}
      <p class="gastos__prevision">${texto}</p>
      ${conIngresos ? '' : '<p class="ajuste__ayuda">Apunta tu nómina («nómina 1.850 al mes») para ver cuánto ahorras cada mes.</p>'}`;
  }

  function panelResumen(r) {
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
    const formSaldo = (cuenta) => {
      const saldo = saldoDe(datos, cuenta);
      const banco = cuenta === 'banco';
      return `
      <form class="gastos__ajuste" data-saldo="${cuenta}">
        <label for="gastos-saldo-${cuenta}"><span class="gastos__etiqueta">${banco ? 'saldo del banco' : 'efectivo'}</span>
          <span class="ajuste__ayuda">${
            saldo
              ? `Apuntaste ${escapar(euros(saldo.centimos))} el ${escapar(fechaCorta(saldo.fecha))}. Ponlo al día cuando quieras: desde ahí calculo cómo acabas cada mes.`
              : banco
              ? 'Lo que tienes hoy en el banco. Con él calculo cómo acabarás cada mes.'
              : 'Lo que llevas en la cartera o tienes en casa. Lo que pagues en efectivo sale de aquí, y lo que saques del cajero entra aquí.'
          }</span></label>
        <div class="formulario__fila">
          <input class="campo" id="gastos-saldo-${cuenta}" name="saldo" inputmode="decimal" placeholder="por ejemplo ${banco ? '2.340,50' : '60'}" value="">
          <button type="submit" class="boton">${saldo ? 'Actualizar' : 'Guardar'}</button>
          ${saldo ? `<button type="button" class="boton" data-quitar-saldo="${cuenta}">Quitar</button>` : ''}
        </div>
      </form>`;
    };
    return `
      ${graficaBalance()}
      <p class="gastos__dia"><span>En qué se va ${mes === mesDe(hoy) ? 'este mes' : `en ${escapar(nombreMes(mes, { corto: true }))}`}</span><span>${escapar(euros(r.previsto))}</span></p>
      ${categorias}
      ${formSaldo('banco')}
      ${formSaldo('efectivo')}
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
    if (d.borrarTraspaso) {
      const t = datos.traspasos.find((x) => x.id === d.borrarTraspaso);
      abierto = null;
      return guardar(borrarTraspaso(datos, d.borrarTraspaso), { aviso: `Borrado: ${t ? conceptoTraspaso(t.de).toLowerCase() : 'movimiento'}`, alDeshacer: (antes) => antes });
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
    if (d.quitarSaldo) return guardar(ponerSaldo(datos, null, hoy, d.quitarSaldo), { aviso: d.quitarSaldo === 'efectivo' ? 'Sin saldo del efectivo' : 'Sin saldo del banco', alDeshacer: (antes) => antes });
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
        ingreso: esCategoriaIngreso(form.categoria.value),
        fecha: form.fecha.value,
        nota: form.nota.value,
        cuenta: form.cuenta.value,
      });
      abierto = null;
      if (form.fecha.value && mesDe(form.fecha.value) !== mes) mes = mesDe(form.fecha.value);
      return guardar(nuevos, { aviso: 'Guardado' });
    }
    if (form.dataset.editarTraspaso) {
      const nuevos = editarTraspaso(datos, form.dataset.editarTraspaso, { centimos: importeDe(form.importe.value), de: form.de.value, fecha: form.fecha.value, nota: form.nota.value });
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
        ingreso: esCategoriaIngreso(form.categoria.value),
        frecuencia: form.frecuencia.value,
        dia: Math.min(31, Math.max(1, Number(form.dia.value) || 1)),
        mes: Number(form.mes.value),
        diaSemana: Number(form.diaSemana.value),
        desde: form.desde.value || `${mesDe(hoy)}-01`,
        cuenta: form.cuenta.value,
      };
      if (!campos.concepto.trim()) throw new Error('Pon qué es: alquiler, Netflix, nómina…');
      const id = form.dataset.editarFijo;
      abierto = null;
      if (id) return guardar(editarFijo(datos, id, campos, hoy), { aviso: 'Guardado' });
      return guardar(anadirFijo(datos, campos, hoy).datos, { aviso: `${campos.ingreso ? 'Ingreso' : 'Gasto'} fijo: ${campos.concepto.trim()} · ${euros(campos.centimos)}`, alDeshacer: (antes) => antes });
    }
    if (form.dataset.saldo) {
      const cuenta = form.dataset.saldo;
      const texto = form.saldo.value.trim();
      if (!texto) throw new Error(cuenta === 'efectivo' ? 'Escribe lo que llevas en efectivo, por ejemplo 60.' : 'Escribe lo que tienes hoy en el banco, por ejemplo 2.340,50.');
      // El banco puede estar en negativo («-120»); el efectivo, no.
      const negativo = /^[-−]/.test(texto);
      if (negativo && cuenta === 'efectivo') throw new Error('En efectivo no se puede tener menos de 0 €.');
      const centimos = /^[-−]?\s*0+(?:[.,]0+)?$/.test(texto) ? 0 : importeDe(texto.replace(/^[-−]\s*/, ''));
      const valor = negativo ? -centimos : centimos;
      return guardar(ponerSaldo(datos, valor, hoy, cuenta), { aviso: `${cuenta === 'efectivo' ? 'En efectivo' : 'En el banco'}: ${euros(valor)} hoy`, alDeshacer: (antes) => antes });
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
