// Hoy: la pantalla de inicio. Solo enseña lo que pide atención (candidaturas
// por revisar, la próxima cita, los recordatorios, el correo sin leer y lo
// gastado en IA) y cada tarjeta lleva a su sitio. Si algo no está conectado,
// su tarjeta no aparece o invita a conectarlo; nunca bloquea a las demás.
import { icono } from './iconos.js';
import { normalizarDatosEmpleo } from '../compartido/empleo.js';
import { INFO_MODOS, normalizarModo } from '../compartido/modos.js';
import { normalizarGastos, resumenMes, proximosFijos, euros, fechaISO, mesDe, nombreMes, sumarDias } from '../compartido/gastos.js';
import { normalizarBiblia, lecturasDelDia, lecturasDeGrupo, estadoPlan, textoLectura, minutosDe, racha, marcarCasilla } from '../compartido/biblia.js';

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

export function crearHoy({ contenedor, api, ir, preguntar, conversar = () => ir('chat'), abrirAjustes, instalacion = null, alEmpleo = () => {}, alBiblia = () => {} }) {
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
    // Lo importante (pestaña Principal de Gmail) y, aparte, cuánto hay sin leer en total.
    const [imp, todos] = await Promise.all([seguro(api.correo.listar({ filtro: 'importantes' })), seguro(api.correo.listar({ filtro: 'no-leidos' }))]);
    const sinLeer = imp?.mensajes ?? todos?.mensajes ?? [];
    return { conectado: true, sinLeer, otros: Math.max(0, (todos?.mensajes?.length ?? 0) - sinLeer.length), masOtros: Boolean(todos?.siguiente) };
  }

  async function datosGasto() {
    if (!api.consumo?.resumen) return null;
    const [r, ajustes, ia] = await Promise.all([seguro(api.consumo.resumen()), seguro(api.ajustes.obtener()), seguro(api.claude?.estado())]);
    if (!r) return null;
    const dos = ia?.claves?.groq && ia?.claves?.openai && ajustes?.proveedor !== 'claude';
    if (!r.total.usd && !dos && ajustes?.proveedor !== 'openai') return null;
    return { usd: r.total.usd, detalle: dos ? `modo ${INFO_MODOS[normalizarModo(ajustes.modoIA)].nombre}` : ajustes?.proveedor === 'openai' ? 'GPT-6 Luna' : '' };
  }

  // Lectura bíblica: lo que toca hoy y las dos casillas, para marcarlas sin abrir el apartado.
  async function datosBiblia() {
    if (!api.biblia) return null;
    const datos = normalizarBiblia((await seguro(api.biblia.leer())) ?? {});
    const hoy = fechaISO();
    const grupo = lecturasDeGrupo(datos, hoy).map((x) => ({ ...x, estado: estadoPlan(x.plan, hoy), dia: x.plan.lecturas.findIndex((l) => l.fecha === hoy) + 1 }));
    if (!datos.planes.some((p) => !p.archivado && !p.grupo) && !Object.keys(datos.dias).length) return { vacio: true, grupo };
    // Los últimos siete días: si ese día leíste u oraste.
    const semana = Array.from({ length: 7 }, (_, i) => {
      const f = sumarDias(hoy, i - 6);
      const d = datos.dias[f];
      return { hecho: Boolean(d?.leido || d?.orado), hoy: i === 6, nombre: new Date(`${f}T12:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric' }) };
    });
    return { tocan: lecturasDelDia(datos, hoy), dia: datos.dias[hoy], racha: racha(datos, hoy), semana, grupo };
  }

  // ---------- Bloques ----------
  // Cada bloque es un botón (lleva a su apartado) o una caja con sus propios botones.
  const bloque = ({ clase = '', ir: destino = '', accion = '', etiqueta, contenido }) => `
    <button type="button" class="bloque ${clase}" ${destino ? `data-ir="${destino}"` : ''} ${accion ? `data-accion="${accion}"` : ''}>
      <span class="bloque__etiqueta">${escapar(etiqueta)}</span>
      ${contenido}
    </button>`;
  const grande = (t) => `<span class="bloque__grande">${t}</span>`;
  const titulo = (t) => `<span class="bloque__titulo">${escapar(t)}</span>`;
  const detalle = (t) => (t ? `<span class="bloque__detalle">${escapar(t)}</span>` : '');
  const cifra = (euros) => {
    // «1.190,65 €» → la parte entera grande y los céntimos y el símbolo, pequeños.
    const m = String(euros).match(/^(.*?)(,\d+)?\s*€$/);
    return m ? `${escapar(m[1])}<small>${escapar(m[2] ?? '')} €</small>` : escapar(euros);
  };
  const faltan = (ms) => {
    const min = Math.round((ms - Date.now()) / 60_000);
    if (min <= 0) return 'ahora';
    if (min < 60) return `en ${min} min`;
    if (min < 24 * 60 && inicioDelDia(ms) === inicioDelDia()) return `en ${Math.round(min / 60)} h`;
    return cuando(ms);
  };

  // Lo siguiente, en grande y en bermellón: la próxima cita o, si no hay, el próximo recordatorio.
  function bloqueHeroe(a) {
    if (!a) return '';
    const [cita] = a.proximos;
    const aviso = a.recordatorios[0];
    const kanji = '<span class="heroe__kanji" aria-hidden="true">狐</span>';
    if (cita) {
      const otra = a.proximos[1];
      const lugar = [cita.lugar, otra ? `Después: ${otra.todoElDia ? '' : `${hora(otra.inicio)} `}${otra.titulo || '(sin título)'}` : ''].filter(Boolean).join(' · ');
      return `<button type="button" class="bloque bloque--heroe" data-ir="agenda">
        <span class="bloque__etiqueta">Siguiente · ${escapar(cita.todoElDia ? cuando(cita.inicio, { todoElDia: true }) : faltan(cita.inicio))}</span>
        <span class="heroe__cuerpo">${cita.todoElDia ? '' : `<span class="heroe__hora">${hora(cita.inicio)}</span>`}${titulo(cita.titulo || '(sin título)')}${detalle(lugar)}</span>${kanji}</button>`;
    }
    if (aviso) {
      return `<button type="button" class="bloque bloque--heroe" data-ir="recordatorios">
        <span class="bloque__etiqueta">Recordatorio · ${escapar(faltan(aviso.cuando))}</span>
        <span class="heroe__cuerpo"><span class="heroe__hora">${hora(aviso.cuando)}</span>${titulo(aviso.texto)}${detalle(cuando(aviso.cuando))}</span>${kanji}</button>`;
    }
    if (!a.conCalendario) {
      return `<button type="button" class="bloque bloque--heroe" data-accion="conectar-google">
        <span class="bloque__etiqueta">${escapar(saludo())}</span>
        <span class="heroe__cuerpo">${titulo('Conecta tu calendario')}${detalle('y aquí verás siempre lo siguiente que tienes')}</span>${kanji}</button>`;
    }
    return `<button type="button" class="bloque bloque--heroe" data-ir="agenda">
      <span class="bloque__etiqueta">${escapar(saludo())}</span>
      <span class="heroe__cuerpo">${titulo('Día despejado')}${detalle('Nada más en la agenda hoy ni mañana')}</span>${kanji}</button>`;
  }

  // El recordatorio que sigue (si el héroe ya enseña uno, el siguiente).
  function bloqueAviso(a) {
    if (!a) return '';
    const usado = a.proximos.length ? null : a.recordatorios[0];
    const r = a.recordatorios.find((x) => x !== usado);
    if (!r) return bloque({ ir: 'recordatorios', etiqueta: 'Recordatorios', contenido: titulo(usado ? 'Nada más pendiente' : 'Ninguno pendiente') + detalle('Pídeme «recuérdame…»') });
    return bloque({ ir: 'recordatorios', etiqueta: `Recordatorio · ${cuando(r.cuando)}`, contenido: titulo(r.texto) + detalle(a.deHoy.length > 1 ? `${a.deHoy.length} para hoy` : faltan(r.cuando)) });
  }

  function anillo(fraccion) {
    const f = Math.max(0, Math.min(1, fraccion));
    const c = 2 * Math.PI * 15;
    return `<svg class="bloque__anillo" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15"/><circle cx="18" cy="18" r="15" class="lleno" stroke-dasharray="${(c * f).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 18 18)"/></svg>`;
  }

  // Siete barritas: lo gastado cada día de la última semana (hoy, la última, en bermellón).
  function barras(semana = []) {
    const max = Math.max(...semana, 1);
    if (!semana.some(Boolean)) return '';
    return `<span class="bloque__barras" role="img" aria-label="Gasto de los últimos siete días">${semana.map((v, i) => `<i class="${i === 6 ? 'hoy' : ''}" style="height:${Math.max(8, Math.round((v / max) * 100))}%"></i>`).join('')}</span>`;
  }

  function bloqueGastos(g) {
    if (!g) return '';
    if (g.vacio) return bloque({ accion: 'gasto', etiqueta: 'Gastos', contenido: titulo('Apunta tu primer gasto') + detalle('Escribe «12,50 súper»') });
    const r = g.resumen;
    const pie = r.presupuesto ? (r.disponible >= 0 ? `quedan ${euros(r.disponible, { redondo: true })} de ${euros(r.presupuesto, { redondo: true })}` : `te pasas ${euros(-r.disponible, { redondo: true })}`) : '';
    return bloque({
      ir: 'gastos',
      clase: 'bloque--cifra',
      etiqueta: `Gastado en ${nombreMes(r.mes, { corto: true })}`,
      contenido: `${r.presupuesto ? anillo(r.gastado / r.presupuesto) : ''}${barras(g.semana)}${grande(cifra(euros(r.gastado)))}${detalle(pie)}`,
    });
  }

  // Lectura Jóvenes: lo que toca hoy con el grupo, aparte de tu lectura.
  function bloqueJovenes(b) {
    return (b?.grupo ?? [])
      .map(
        ({ plan, lectura, hecha, estado, dia }) => `
      <div class="bloque bloque--ancho bloque--biblia bloque--grupo${hecha ? ' hecha' : ''}">
        <button type="button" class="bloque__ir" data-ir="biblia">
          <span class="bloque__etiqueta"><span class="bloque__insignia">Grupo</span>${escapar(plan.nombre)} · día ${dia} de ${plan.lecturas.length}</span>
          ${titulo(textoLectura(lectura.caps))}
        </button>
        <span class="bloque__progreso" role="img" aria-label="${Math.round(estado.parte * 100)} % del plan"><span style="width:${Math.max(1, Math.round(estado.parte * 100))}%"></span></span>
        <div class="bloque__marcas">
          <button type="button" class="bloque__marca" data-biblia="jovenes" aria-pressed="${hecha}">${hecha ? icono('hecho', 14) : ''}${hecha ? 'Leída con el grupo' : `Leída · ${lectura.caps.length} capítulos, unos ${minutosDe(lectura.caps)} min`}</button>
        </div>
      </div>`,
      )
      .join('');
  }

  function bloqueBiblia(b) {
    if (!b) return '';
    if (b.vacio) return bloqueJovenes(b) + bloque({ ir: 'biblia', clase: 'bloque--ancho', etiqueta: 'Lectura bíblica', contenido: titulo('Empieza un plan de lectura') + detalle('La Biblia en un año, el Nuevo Testamento en 90 días… a tu ritmo') });
    const caps = b.tocan.flatMap((x) => x.lectura.caps);
    const hecha = b.tocan.length && b.tocan.every((x) => x.hecha);
    const etiqueta = b.tocan.length ? `Hoy toca leer${hecha ? ' · leída' : ` · unos ${minutosDe(caps)} min`}` : 'Lectura bíblica';
    const casilla = (id, nombre, si) => `<button type="button" class="bloque__marca" data-biblia="${id}" aria-pressed="${si}">${si ? icono('hecho', 14) : ''}${nombre}</button>`;
    const semana = b.semana.map((d) => `<i class="${d.hecho ? 'si' : ''}${d.hoy ? ' hoy' : ''}" title="${escapar(d.nombre)}"></i>`).join('');
    return `
      <div class="bloque bloque--ancho bloque--biblia${hecha ? ' hecha' : ''}">
        <button type="button" class="bloque__ir" data-ir="biblia">
          <span class="bloque__etiqueta">${escapar(etiqueta)}</span>
          ${titulo(b.tocan.length ? textoLectura(caps) : 'Hoy no toca lectura')}
        </button>
        <div class="bloque__marcas" role="group" aria-label="Lo de hoy">
          ${casilla('leido', 'He leído', Boolean(b.dia?.leido))}
          ${casilla('orado', 'He orado', Boolean(b.dia?.orado))}
        </div>
        <div class="bloque__racha" role="img" aria-label="${b.racha > 1 ? `${b.racha} días seguidos` : 'Tu última semana'}">${semana}</div>
      </div>${bloqueJovenes(b)}`;
  }

  function bloqueCorreo(c) {
    if (!c) return '';
    if (!c.conectado) return bloque({ accion: 'conectar-google', clase: 'bloque--ancho', etiqueta: 'Correo', contenido: titulo('Conecta tu Gmail') + detalle('y te aviso de lo importante') });
    const resto = c.otros ? `${c.masOtros ? 'más de ' : ''}${c.otros} de publicidad y avisos sin leer` : '';
    if (!c.sinLeer.length) return bloque({ ir: 'correo', clase: 'bloque--ancho', etiqueta: 'Correo', contenido: titulo(c.otros ? 'Nada importante' : 'Todo leído') + detalle(resto) });
    const filas = c.sinLeer
      .slice(0, 2)
      .map((m) => {
        const nombre = m.de?.nombre || m.de?.email || '';
        return `<span class="bloque__correo"><span class="bloque__inicial" aria-hidden="true">${escapar(nombre.trim().charAt(0).toUpperCase() || '·')}</span><span><b>${escapar(nombre)}</b><span>${escapar(m.asunto || '(sin asunto)')}</span></span></span>`;
      })
      .join('');
    return bloque({ ir: 'correo', clase: 'bloque--ancho', etiqueta: `Correo · ${c.sinLeer.length} ${c.sinLeer.length === 1 ? 'importante' : 'importantes'} sin leer`, contenido: filas + (resto ? `<span class="bloque__detalle bloque__resto">y ${escapar(resto)}</span>` : '') });
  }

  function bloqueEmpleo(e) {
    if (!e) return '';
    if (e.sinCV) return bloque({ ir: 'empleo', etiqueta: 'Empleo', contenido: titulo('Sube tu CV') + detalle('y te busco ofertas') });
    if (e.listas.length) return bloque({ ir: 'empleo', clase: 'bloque--aviso', etiqueta: 'Empleo', contenido: grande(String(e.listas.length)) + detalle(e.listas.length === 1 ? 'candidatura por revisar' : 'candidaturas por revisar') });
    if (e.enCola) return bloque({ ir: 'empleo', etiqueta: 'Empleo', contenido: titulo(`Preparando ${e.enCola}`) + detalle('te aviso al móvil') });
    if (e.nuevas) return bloque({ ir: 'empleo', etiqueta: 'Empleo', contenido: grande(String(e.nuevas)) + detalle(e.nuevas === 1 ? 'oferta nueva' : 'ofertas nuevas') });
    return bloque({ ir: 'empleo', etiqueta: 'Empleo', contenido: titulo('Nada por revisar') + detalle(e.enviadas ? `${e.enviadas} ${e.enviadas === 1 ? 'enviada' : 'enviadas'}` : '') });
  }

  function bloqueIA(g) {
    if (!g) return '';
    const usd = g.usd.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return bloque({ accion: 'ajustes-ia', clase: 'bloque--cifra', etiqueta: 'IA este mes', contenido: grande(`${escapar(usd)}<small> $</small>`) + detalle(g.detalle) });
  }

  function bloqueInstalar() {
    const tipo = instalacion?.puedeInstalar();
    if (!tipo) return '';
    return bloque({
      accion: tipo === 'aviso' ? 'instalar' : 'instalar-iphone',
      clase: 'bloque--ancho',
      etiqueta: 'Kitsune',
      contenido: titulo('Instálala como app') + detalle(tipo === 'aviso' ? 'con su icono y sin la barra del navegador' : 'Compartir → Añadir a pantalla de inicio'),
    });
  }

  async function marcarBiblia(id) {
    const datos = normalizarBiblia((await seguro(api.biblia.leer())) ?? {});
    const hoy = fechaISO();
    const ahora = id === 'jovenes' ? lecturasDeGrupo(datos, hoy).every((x) => x.hecha) : id === 'leido' ? Boolean(datos.dias[hoy]?.leido) : Boolean(datos.dias[hoy]?.orado);
    await api.biblia.guardar(marcarCasilla(datos, hoy, id, !ahora));
    alBiblia();
    const caja = contenedor.querySelector('#hoy-biblia');
    if (caja) caja.innerHTML = bloqueBiblia(await datosBiblia());
  }

  async function datosGastos() {
    if (!api.gastos) return null;
    const datos = normalizarGastos((await seguro(api.gastos.leer())) ?? {});
    const hoy = fechaISO();
    if (!datos.movimientos.length && !datos.fijos.length) return { vacio: true };
    // Lo gastado cada uno de los últimos siete días (para las barritas).
    const semana = Array.from({ length: 7 }, (_, i) => {
      const f = sumarDias(hoy, i - 6);
      return datos.movimientos.filter((m) => !m.ingreso && m.fecha === f).reduce((t, m) => t + m.centimos, 0);
    });
    return { hoy, resumen: resumenMes(datos, mesDe(hoy), hoy), proximos: proximosFijos(datos, hoy, 3), semana };
  }

  const cargando = (clase = '') => `<div class="bloque bloque--cargando ${clase}" aria-hidden="true"></div>`;

  async function mostrar() {
    const turno = ++pintando;
    // Primero el esqueleto (sale al instante); luego cada bloque según llega.
    if (!contenedor.querySelector('.hoy')) {
      contenedor.innerHTML = `
        <div class="apartado desplazable hoy">
          <div class="bento">
            <div id="hoy-heroe" class="bento__ancho">${cargando('bloque--heroe')}</div>
            <div class="bento__ancho accesos" role="group" aria-label="Accesos rápidos">
              ${[
                ...(api.gastos ? [['gasto', 'cartera', 'Gasto']] : []),
                ['recordatorio', 'campana', 'Aviso'],
                ['pulso', 'sol', 'Pulso'],
                ['preparar', 'maletin', 'Ofertas'],
              ]
                .map(([accion, ico, nombre]) => `<button type="button" class="acceso" data-accion="${accion}"><span class="acceso__icono">${icono(ico, 21)}</span><span class="acceso__nombre">${nombre}</span></button>`)
                .join('')}
            </div>
            <div id="hoy-gastos">${api.gastos ? cargando() : ''}</div>
            <div id="hoy-aviso">${cargando()}</div>
            <div id="hoy-biblia" class="bento__ancho"></div>
            <div id="hoy-correo" class="bento__ancho">${cargando('bloque--ancho')}</div>
            <div id="hoy-empleo">${api.empleo ? cargando() : ''}</div>
            <div id="hoy-gasto"></div>
            <div id="hoy-instalar" class="bento__ancho"></div>
          </div>
          <p class="hoy__ayuda" id="hoy-ayuda-iphone" hidden>En el iPhone: pulsa ${icono('compartir', 14)} <strong>Compartir</strong> en Safari y luego <strong>Añadir a pantalla de inicio</strong>.</p>
        </div>`;
      contenedor.querySelector('.hoy').addEventListener('click', alPulsar);
    }
    const poner = (id, html) => {
      if (turno !== pintando) return;
      const caja = contenedor.querySelector(`#${id}`);
      if (caja) caja.innerHTML = html;
    };
    poner('hoy-instalar', bloqueInstalar());
    await Promise.all([
      datosEmpleo().then((e) => {
        poner('hoy-empleo', bloqueEmpleo(e));
        if (e && !e.sinCV) alEmpleo(e.listas.length);
      }),
      datosAgenda().then((a) => {
        poner('hoy-heroe', bloqueHeroe(a));
        poner('hoy-aviso', bloqueAviso(a));
      }),
      datosCorreo().then((c) => poner('hoy-correo', bloqueCorreo(c))),
      datosGasto().then((g) => poner('hoy-gasto', bloqueIA(g))),
      datosGastos().then((g) => poner('hoy-gastos', bloqueGastos(g))),
      datosBiblia().then((b) => poner('hoy-biblia', bloqueBiblia(b))),
    ]);
  }

  async function alPulsar(e) {
    const boton = e.target.closest('[data-ir], [data-accion], [data-biblia]');
    if (!boton) return;
    if (boton.dataset.biblia) return marcarBiblia(boton.dataset.biblia).catch(() => {});
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
      case 'conversar':
        return conversar();
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

  // Lo de hoy, en datos, para que el Chat lo enseñe a su manera.
  const resumen = async () => {
    const [agenda, biblia, correo, gastos] = await Promise.all([datosAgenda(), datosBiblia(), datosCorreo(), datosGastos()]);
    return { agenda, biblia, correo, gastos };
  };

  return { mostrar, resumen };
}
