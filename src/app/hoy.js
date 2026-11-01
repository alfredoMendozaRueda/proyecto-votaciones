// Hoy: la pantalla de inicio. Solo enseña lo que pide atención (candidaturas
// por revisar, la próxima cita, los recordatorios, el correo sin leer y lo
// gastado en IA) y cada tarjeta lleva a su sitio. Si algo no está conectado,
// su tarjeta no aparece o invita a conectarlo; nunca bloquea a las demás.
import { icono } from './iconos.js';
import { normalizarDatosEmpleo } from '../compartido/empleo.js';
import { INFO_MODOS, normalizarModo } from '../compartido/modos.js';
import { normalizarGastos, resumenMes, proximosFijos, euros, fechaISO, mesDe, nombreMes, sumarDias } from '../compartido/gastos.js';

const escapar = (t = '') => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const hora = (ms) => new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const finDelDia = (ms = Date.now()) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
};
const inicioDelDia = (ms = Date.now()) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

function saludo(ahora = new Date()) {
  const h = ahora.getHours();
  return h < 6 ? 'Buenas noches' : h < 13 ? 'Buenos días' : h < 21 ? 'Buenas tardes' : 'Buenas noches';
}

// Cuándo es algo, dicho como lo diría una persona: «a las 10:00», «mañana a las 9:00», «el jueves».
function cuando(ms, { todoElDia = false } = {}) {
  const hoy = inicioDelDia();
  const dia = inicioDelDia(ms);
  const dias = Math.round((dia - hoy) / 86_400_000);
  const nombre = dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : new Date(ms).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' });
  return todoElDia ? nombre : `${nombre} a las ${hora(ms)}`;
}

export function crearHoy({ contenedor, api, ir, preguntar, abrirAjustes, instalacion = null, alEmpleo = () => {} }) {
  let pintando = 0;

  // Cada tarjeta se calcula por su cuenta: si una falla, las demás salen igual.
  const seguro = (promesa) => Promise.resolve(promesa).catch(() => null);

  async function datosEmpleo() {
    if (!api.empleo) return null;
    const datos = normalizarDatosEmpleo((await seguro(api.empleo.leer())) ?? {});
    if (!datos.cv) return { sinCV: true };
    const porRevisar = datos.postulaciones.filter((p) => !p.revisada);
    // Las que el servidor ya tiene hechas y la app aún no ha recogido (se recogen al abrir Empleo).
    const servidor = api.servidor?.empleo?.preparadas ? await seguro(api.servidor.empleo.preparadas()) : null;
    const enServidor = (servidor?.preparadas ?? []).filter((x) => !datos.postulaciones.some((p) => p.oferta.url && p.oferta.url === x.oferta?.url));
    const alerta = api.servidor?.empleo?.alerta ? await seguro(api.servidor.empleo.alerta()) : null;
    return {
      listas: [...porRevisar.map((p) => p.oferta), ...enServidor.map((x) => x.oferta)].filter(Boolean),
      enCola: alerta?.enCola ?? 0,
      nuevas: alerta?.ultimas?.fecha > datos.alertaVista ? alerta.ultimas.ofertas.length : 0,
      enviadas: datos.postulaciones.filter((p) => p.estado === 'enviada').length,
    };
  }

  async function datosAgenda() {
    const estado = await seguro(api.calendario?.estado());
    const conCalendario = Boolean(estado?.conectado && estado.calendario && !estado.necesitaReconectar);
    const ahora = Date.now();
    const [eventos, recordatorios] = await Promise.all([
      conCalendario ? seguro(api.calendario.eventos(inicioDelDia(), finDelDia(ahora + 86_400_000))) : null,
      seguro(api.recordatorios?.listar()),
    ]);
    const proximos = (eventos ?? []).filter((e) => (e.todoElDia ? e.fin > ahora : e.inicio >= ahora - 15 * 60_000));
    const deHoy = (recordatorios ?? []).filter((r) => r.cuando < finDelDia());
    return { conCalendario, proximos, recordatorios: recordatorios ?? [], deHoy };
  }

  async function datosCorreo() {
    const estado = await seguro(api.correo?.estado());
    if (!estado?.conectado) return { conectado: false };
    const r = await seguro(api.correo.listar({ filtro: 'no-leidos' }));
    return { conectado: true, sinLeer: r?.mensajes ?? [] };
  }

  async function datosGasto() {
    if (!api.consumo?.resumen) return null;
    const [r, ajustes, ia] = await Promise.all([seguro(api.consumo.resumen()), seguro(api.ajustes.obtener()), seguro(api.claude?.estado())]);
    if (!r) return null;
    const dos = ia?.claves?.groq && ia?.claves?.openai && ajustes?.proveedor !== 'claude';
    if (!r.total.usd && !dos && ajustes?.proveedor !== 'openai') return null;
    return { usd: r.total.usd, detalle: dos ? `modo ${INFO_MODOS[normalizarModo(ajustes.modoIA)].nombre}` : ajustes?.proveedor === 'openai' ? 'GPT-6 Luna' : '' };
  }

  async function datosGastos() {
    if (!api.gastos) return null;
    const datos = normalizarGastos((await seguro(api.gastos.leer())) ?? {});
    const hoy = fechaISO();
    if (!datos.movimientos.length && !datos.fijos.length) return { vacio: true };
    return { hoy, resumen: resumenMes(datos, mesDe(hoy), hoy), proximos: proximosFijos(datos, hoy, 3) };
  }

  function tarjetaGastos(g) {
    if (!g) return '';
    if (g.vacio) return tarjeta({ accion: 'gasto', icono: 'cartera', etiqueta: 'gastos', valor: 'Lleva tus gastos', detalle: 'Escribe «12,50 súper» y mira en qué se va el mes' });
    const r = g.resumen;
    const [p] = g.proximos;
    const cuando = p ? (p.fecha === g.hoy ? 'hoy' : p.fecha === sumarDias(g.hoy, 1) ? 'mañana' : `el ${Number(p.fecha.slice(8))}`) : '';
    const detalle = [
      r.presupuesto ? (r.disponible >= 0 ? `quedan ${euros(r.disponible, { redondo: true })} de ${euros(r.presupuesto, { redondo: true })}` : `te pasas ${euros(-r.disponible, { redondo: true })}`) : '',
      p ? `${cuando}: ${p.concepto} ${euros(p.centimos, { redondo: true })}` : '',
    ].filter(Boolean);
    return tarjeta({ ir: 'gastos', icono: 'cartera', etiqueta: `gastos de ${nombreMes(r.mes, { corto: true })}`, valor: euros(r.gastado), detalle: detalle.join(' · ') });
  }

  const tarjeta = ({ ir: destino, icono: ico, etiqueta, valor, detalle = '', destacada = false, accion = '' }) => `
    <button type="button" class="hoy-tarjeta${destacada ? ' hoy-tarjeta--destacada' : ''}" ${destino ? `data-ir="${destino}"` : ''} ${accion ? `data-accion="${accion}"` : ''}>
      <span class="hoy-tarjeta__etiqueta">${icono(ico, 14)}${escapar(etiqueta)}</span>
      <span class="hoy-tarjeta__valor">${escapar(valor)}</span>
      ${detalle ? `<span class="hoy-tarjeta__detalle">${escapar(detalle)}</span>` : ''}
    </button>`;

  function tarjetaEmpleo(e) {
    if (!e) return '';
    if (e.sinCV) return tarjeta({ ir: 'empleo', icono: 'maletin', etiqueta: 'empleo', valor: 'Sube tu CV', detalle: 'y te busco ofertas que encajen contigo' });
    if (e.listas.length) {
      const nombres = e.listas.slice(0, 2).map((o) => `${o.puesto}${o.empresa ? ` · ${o.empresa}` : ''}${o.encaje != null ? ` (${o.encaje})` : ''}`);
      return tarjeta({
        ir: 'empleo',
        icono: 'maletin',
        etiqueta: 'empleo',
        valor: e.listas.length === 1 ? '1 candidatura lista para revisar' : `${e.listas.length} candidaturas listas para revisar`,
        detalle: nombres.join(' · '),
        destacada: true,
      });
    }
    if (e.enCola) return tarjeta({ ir: 'empleo', icono: 'maletin', etiqueta: 'empleo', valor: `Preparando ${e.enCola === 1 ? '1 candidatura' : `${e.enCola} candidaturas`}`, detalle: 'en el servidor; te aviso al móvil' });
    if (e.nuevas) return tarjeta({ ir: 'empleo', icono: 'maletin', etiqueta: 'empleo', valor: e.nuevas === 1 ? '1 oferta nueva para ti' : `${e.nuevas} ofertas nuevas para ti`, detalle: 'de la alerta de esta mañana' });
    return tarjeta({ ir: 'empleo', icono: 'maletin', etiqueta: 'empleo', valor: 'Nada por revisar', detalle: e.enviadas ? `${e.enviadas} ${e.enviadas === 1 ? 'candidatura enviada' : 'candidaturas enviadas'}` : 'Busca y prepara candidaturas cuando quieras' });
  }

  function tarjetasAgenda(a) {
    if (!a) return '';
    const [primero, ...resto] = a.proximos;
    const cita = a.conCalendario
      ? primero
        ? tarjeta({
            ir: 'agenda',
            icono: 'calendario',
            etiqueta: 'próximo',
            valor: `${primero.todoElDia ? '' : `${hora(primero.inicio)} `}${primero.titulo || '(sin título)'}`,
            detalle: [primero.todoElDia ? cuando(primero.inicio, { todoElDia: true }) : inicioDelDia(primero.inicio) !== inicioDelDia() ? cuando(primero.inicio) : '', resto.length ? `y ${resto.length} más` : primero.lugar].filter(Boolean).join(' · '),
          })
        : tarjeta({ ir: 'agenda', icono: 'calendario', etiqueta: 'agenda', valor: 'Nada más hoy', detalle: 'ni mañana' })
      : tarjeta({ accion: 'conectar-google', icono: 'calendario', etiqueta: 'agenda', valor: 'Conecta tu calendario', detalle: 'para ver aquí tus citas' });
    const siguiente = a.recordatorios[0];
    const aviso = siguiente
      ? tarjeta({
          ir: 'recordatorios',
          icono: 'campana',
          etiqueta: a.deHoy.length > 1 ? `${a.deHoy.length} recordatorios hoy` : 'recordatorio',
          valor: siguiente.texto,
          detalle: cuando(siguiente.cuando),
        })
      : tarjeta({ ir: 'recordatorios', icono: 'campana', etiqueta: 'recordatorios', valor: 'Ninguno pendiente', detalle: 'Pídeme «recuérdame…» en el chat' });
    return `<div class="hoy-dos">${cita}${aviso}</div>`;
  }

  function tarjetaCorreo(c) {
    if (!c) return '';
    if (!c.conectado) return tarjeta({ accion: 'conectar-google', icono: 'sobre', etiqueta: 'correo', valor: 'Conecta tu Gmail', detalle: 'y te aviso de lo importante' });
    if (!c.sinLeer.length) return tarjeta({ ir: 'correo', icono: 'sobre', etiqueta: 'correo', valor: 'Todo leído' });
    const [m] = c.sinLeer;
    return tarjeta({
      ir: 'correo',
      icono: 'sobre',
      etiqueta: 'correo',
      valor: c.sinLeer.length === 1 ? '1 correo sin leer' : `${c.sinLeer.length} correos sin leer`,
      detalle: `${m.de?.nombre || m.de?.email || ''}: «${m.asunto || '(sin asunto)'}»`,
    });
  }

  function tarjetaGasto(g) {
    if (!g) return '';
    const usd = g.usd.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return tarjeta({ accion: 'ajustes-ia', icono: 'pulso', etiqueta: 'ia este mes', valor: `${usd} $`, detalle: g.detalle });
  }

  function tarjetaInstalar() {
    const tipo = instalacion?.puedeInstalar();
    if (!tipo) return '';
    return tipo === 'aviso'
      ? tarjeta({ accion: 'instalar', icono: 'instalar', etiqueta: 'kitsune', valor: 'Instálala como app', detalle: 'con su icono y sin la barra del navegador' })
      : tarjeta({ accion: 'instalar-iphone', icono: 'instalar', etiqueta: 'kitsune', valor: 'Instálala como app', detalle: 'Compartir → Añadir a pantalla de inicio' });
  }

  async function mostrar() {
    const turno = ++pintando;
    const ahora = new Date();
    const fecha = ahora.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    // Primero el esqueleto (sale al instante); luego cada tarjeta según llega.
    if (!contenedor.querySelector('.hoy')) {
      contenedor.innerHTML = `
        <div class="apartado desplazable hoy">
          <header class="hoy__saludo">
            <h2 id="hoy-saludo"></h2>
            <p id="hoy-fecha"></p>
          </header>
          <div id="hoy-empleo"><div class="hoy-tarjeta hoy-tarjeta--cargando" aria-hidden="true"></div></div>
          <div id="hoy-agenda"><div class="hoy-dos"><div class="hoy-tarjeta hoy-tarjeta--cargando" aria-hidden="true"></div><div class="hoy-tarjeta hoy-tarjeta--cargando" aria-hidden="true"></div></div></div>
          <div id="hoy-correo"><div class="hoy-tarjeta hoy-tarjeta--cargando" aria-hidden="true"></div></div>
          <div id="hoy-gastos"></div>
          <div id="hoy-gasto"></div>
          <div id="hoy-instalar"></div>
          <div class="hoy__acciones" role="group" aria-label="Accesos rápidos">
            <button type="button" class="chip chip--acento" data-accion="preparar">${icono('chispa', 14)} Buscar y preparar</button>
            <button type="button" class="chip" data-accion="recordatorio">${icono('nueva', 14)} Recordatorio</button>
            ${api.gastos ? `<button type="button" class="chip" data-accion="gasto">${icono('cartera', 14)} Apuntar gasto</button>` : ''}
            <button type="button" class="chip" data-accion="pulso">${icono('sol', 14)} Pulso del día</button>
            <button type="button" class="chip" data-accion="hablar">${icono('chat', 14)} Preguntar</button>
          </div>
          <p class="hoy__ayuda" id="hoy-ayuda-iphone" hidden>En el iPhone: pulsa ${icono('compartir', 14)} <strong>Compartir</strong> en Safari y luego <strong>Añadir a pantalla de inicio</strong>.</p>
        </div>`;
      contenedor.querySelector('.hoy').addEventListener('click', alPulsar);
    }
    contenedor.querySelector('#hoy-saludo').textContent = saludo(ahora);
    contenedor.querySelector('#hoy-fecha').textContent = fecha.charAt(0).toUpperCase() + fecha.slice(1);
    const poner = (id, html) => {
      if (turno !== pintando) return;
      const caja = contenedor.querySelector(`#${id}`);
      if (caja) caja.innerHTML = html;
    };
    poner('hoy-instalar', tarjetaInstalar());
    await Promise.all([
      datosEmpleo().then((e) => {
        poner('hoy-empleo', tarjetaEmpleo(e));
        if (e && !e.sinCV) alEmpleo(e.listas.length);
      }),
      datosAgenda().then((a) => poner('hoy-agenda', tarjetasAgenda(a))),
      datosCorreo().then((c) => poner('hoy-correo', tarjetaCorreo(c))),
      datosGasto().then((g) => poner('hoy-gasto', tarjetaGasto(g))),
      datosGastos().then((g) => poner('hoy-gastos', tarjetaGastos(g))),
    ]);
  }

  async function alPulsar(e) {
    const boton = e.target.closest('[data-ir], [data-accion]');
    if (!boton) return;
    if (boton.dataset.ir) return ir(boton.dataset.ir);
    switch (boton.dataset.accion) {
      case 'preparar':
        return ir('empleo', { buscarYPreparar: true });
      case 'recordatorio':
        return ir('recordatorios', { nuevo: true });
      case 'gasto':
        return ir('gastos', { nuevo: true });
      case 'pulso':
        return preguntar('Prepárame el pulso de hoy');
      case 'hablar':
        return ir('chat');
      case 'conectar-google':
        return abrirAjustes('correo');
      case 'ajustes-ia':
        return abrirAjustes('claude');
      case 'instalar':
        if (await instalacion?.instalar()) contenedor.querySelector('#hoy-instalar').innerHTML = '';
        return;
      case 'instalar-iphone':
        contenedor.querySelector('#hoy-ayuda-iphone').hidden = false;
        return;
    }
  }

  return { mostrar };
}
