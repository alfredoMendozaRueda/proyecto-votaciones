// Lectura bíblica: lo que toca leer hoy (se abre en YouVersion, Reina-Valera 1960),
// las casillas del día («He leído», «He orado» y las tuyas), el tiempo con
// cronómetro, preguntas para reflexionar, tus planes (listos o a tu medida, y
// ponerte al día si te atrasas), el mes en un calendario, los avisos al móvil y
// un hueco fijo en tu calendario de Google.
import { icono } from './iconos.js';
import {
  LIBROS,
  GRUPOS,
  PLANTILLAS,
  DIAS_CORTOS,
  DIAS_SEMANA,
  normalizarBiblia,
  crearPlanDePlantilla,
  crearPlanPropio,
  previaPlantilla,
  previaPropia,
  borrarPlan,
  archivarPlan,
  marcarLectura,
  marcarCasilla,
  anadirCasilla,
  quitarCasilla,
  sumarMinutos,
  guardarPreguntas,
  ponerAjustes,
  ponerAgenda,
  lecturasDelDia,
  estadoPlan,
  ponerseAlDia,
  racha,
  resumenMes,
  versiculoDelDia,
  tramos,
  nombreTramo,
  textoLectura,
  enlaceTramo,
  minutosDe,
  fechaISO,
  sumarDias,
  diaSemana,
} from '../compartido/biblia.js';

const escapar = (t = '') => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const mayuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
const fechaCorta = (f) => `${Number(f.slice(8))} ${MESES_CORTOS[Number(f.slice(5, 7)) - 1]}`;
const fechaLarga = (f, hoy) => {
  const dia = `${DIAS_SEMANA[diaSemana(f) - 1]} ${Number(f.slice(8))} de ${MESES[Number(f.slice(5, 7)) - 1]}`;
  const anio = f.slice(0, 4) !== hoy.slice(0, 4) ? ` de ${f.slice(0, 4)}` : '';
  return f === hoy ? `Hoy, ${dia}` : f === sumarDias(hoy, -1) ? `Ayer, ${dia}` : f === sumarDias(hoy, 1) ? `Mañana, ${dia}` : mayuscula(dia) + anio;
};
const nombreMes = (mes) => `${mayuscula(MESES[Number(mes.slice(5)) - 1])} de ${mes.slice(0, 4)}`;
const sumarMes = (mes, n) => {
  const d = new Date(Number(mes.slice(0, 4)), Number(mes.slice(5)) - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const minutos = (n) => (n >= 60 ? `${Math.floor(n / 60)} h${n % 60 ? ` ${n % 60} min` : ''}` : `${n} min`);
const enlace = (url, contenido, clase = '') => `<a class="${clase}" href="${escapar(url)}" target="_blank" rel="noopener">${contenido}</a>`;

// El cronómetro sigue aunque cambies de apartado o cierres el diálogo.
const CLAVE_CRONO = 'kitsune.biblia.cronometro';
const leerCrono = () => {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE_CRONO));
    return c && (c.que === 'lectura' || c.que === 'oracion') && Number.isFinite(c.desde) ? c : null;
  } catch {
    return null;
  }
};
const guardarCrono = (c) => {
  try {
    if (c) localStorage.setItem(CLAVE_CRONO, JSON.stringify(c));
    else localStorage.removeItem(CLAVE_CRONO);
  } catch {
    // Sin almacenamiento: el cronómetro vive mientras la app esté abierta.
  }
};

export function crearBiblia({ contenedor, api, alCambiar = () => {} }) {
  let datos = normalizarBiblia({});
  let hoy = fechaISO();
  let dia = hoy;
  let mes = hoy.slice(0, 7);
  let pestana = 'hoy';
  let abierto = null; // plan desplegado
  let verTodo = false;
  let creando = null; // null | 'lista' | 'propio'
  let borrador = null;
  let crono = leerCrono();
  let tic = null;
  let preguntando = false;
  let deshacer = null;
  let temporizadorAviso = null;

  async function cargar() {
    datos = normalizarBiblia((await api.biblia.leer().catch(() => null)) ?? {});
  }

  async function guardar(nuevos, { aviso = '', alDeshacer = false } = {}) {
    const anteriores = datos;
    datos = normalizarBiblia(nuevos);
    pintar();
    try {
      await api.biblia.guardar(datos);
      alCambiar(datos);
      if (aviso) avisar(aviso, alDeshacer ? () => guardar(anteriores) : null);
    } catch (error) {
      datos = anteriores;
      pintar();
      avisar(`No se ha podido guardar: ${error.message}`);
    }
  }

  // ---------- Esqueleto ----------

  async function mostrar() {
    hoy = fechaISO();
    if (!contenedor.querySelector('.biblia')) {
      contenedor.innerHTML = `
        <div class="apartado desplazable gastos biblia">
          <div class="segmentado biblia__pestanas" role="tablist" aria-label="Lectura bíblica">
            ${[['hoy', 'Hoy'], ['planes', 'Planes'], ['mes', 'Mes']].map(([v, n]) => `<button type="button" role="tab" data-pestana="${v}" aria-pressed="${pestana === v}" aria-selected="${pestana === v}">${n}</button>`).join('')}
          </div>
          <div id="biblia-panel" role="tabpanel"></div>
          <div class="gastos__aviso" id="biblia-aviso" role="status" hidden></div>
        </div>`;
      contenedor.querySelector('.biblia').addEventListener('click', alPulsar);
      contenedor.querySelector('.biblia').addEventListener('change', alCambiarCampo);
      contenedor.querySelector('.biblia').addEventListener('input', alEscribir);
      contenedor.querySelector('.biblia').addEventListener('submit', alEnviar);
    }
    await cargar();
    pintar();
  }

  function pintar() {
    const raiz = contenedor.querySelector('.biblia');
    if (!raiz) return;
    for (const b of raiz.querySelectorAll('[data-pestana]')) {
      b.setAttribute('aria-pressed', String(b.dataset.pestana === pestana));
      b.setAttribute('aria-selected', String(b.dataset.pestana === pestana));
    }
    const panel = raiz.querySelector('#biblia-panel');
    const foco = document.activeElement?.closest?.('#biblia-panel') ? document.activeElement.dataset.foco : null;
    panel.innerHTML = pestana === 'planes' ? panelPlanes() : pestana === 'mes' ? panelMes() : panelHoy();
    if (foco) panel.querySelector(`[data-foco="${foco}"]`)?.focus();
    ponerTic();
  }

  // ---------- Hoy ----------

  function panelHoy() {
    const activos = datos.planes.filter((p) => !p.archivado);
    const tocan = lecturasDelDia(datos, dia);
    const d = datos.dias[dia];
    const v = versiculoDelDia(dia);
    const r = racha(datos, hoy);
    const m = resumenMes(datos, hoy.slice(0, 7), hoy);
    const atrasos = activos.map((p) => ({ plan: p, e: estadoPlan(p, hoy) })).filter((x) => x.e.atrasadas.length && dia === hoy);

    const cabecera = `
      <header class="gastos__mes biblia__dia">
        <button type="button" class="icono-boton" data-mover-dia="-1" aria-label="Día anterior">${icono('volver', 18)}</button>
        <div class="gastos__mes-centro">
          <h2>${escapar(fechaLarga(dia, hoy))}</h2>
          ${dia !== hoy ? '<button type="button" class="gastos__volver" data-volver-hoy>Volver a hoy</button>' : ''}
        </div>
        <button type="button" class="icono-boton gastos__siguiente" data-mover-dia="1" aria-label="Día siguiente" ${dia >= sumarDias(hoy, 30) ? 'disabled' : ''}>${icono('volver', 18)}</button>
      </header>`;

    const lectura = tocan.length
      ? tocan
          .map(({ plan, lectura: l, hecha }) => {
            const ts = tramos(l.caps);
            return `
              <div class="biblia__lectura${hecha ? ' biblia__lectura--hecha' : ''}">
                <p class="biblia__plan-etiqueta">${escapar(plan.nombre)} · unos ${minutosDe(l.caps)} min</p>
                <p class="biblia__pasaje">${escapar(textoLectura(l.caps))}</p>
                <div class="biblia__abrir">
                  ${ts.map((t) => enlace(enlaceTramo(t), `${icono('libro', 14)} ${escapar(nombreTramo(t, { corto: ts.length > 2 }))} ${icono('enlace', 12)}`, 'chip biblia__enlace')).join('')}
                </div>
                <button type="button" class="boton ${hecha ? '' : 'boton--primario'} biblia__leida" data-lectura="${plan.id}" data-fecha="${l.fecha}" aria-pressed="${hecha}">${icono('hecho', 15)} ${hecha ? 'Leída' : 'Marcar como leída'}</button>
              </div>`;
          })
          .join('')
      : activos.length
      ? `<div class="biblia__lectura biblia__lectura--libre"><p class="biblia__pasaje">${dia === hoy ? 'Hoy no toca lectura' : 'Ese día no toca lectura'}</p><p class="ajuste__ayuda">Descansa o lee por tu cuenta: puedes marcar igualmente «He leído».</p></div>`
      : `<div class="biblia__lectura biblia__lectura--libre">
           <p class="biblia__pasaje">Empieza un plan de lectura</p>
           <p class="ajuste__ayuda">La Biblia en un año, el Nuevo Testamento en 90 días, los Evangelios… o los libros que elijas, a tu ritmo. Cada día te digo qué toca y lo abres en YouVersion (Reina-Valera 1960).</p>
           <button type="button" class="boton boton--primario" data-crear="lista">${icono('nueva', 15)} Elegir un plan</button>
         </div>`;

    const casillas = [
      { id: 'leido', nombre: 'He leído', si: Boolean(d?.leido), ico: 'libro' },
      { id: 'orado', nombre: 'He orado', si: Boolean(d?.orado), ico: 'chispa' },
      ...datos.casillas.map((c) => ({ id: c.id, nombre: c.nombre, si: Boolean(d?.extra[c.id]), ico: 'hecho' })),
    ];
    const enMarcha = crono && crono.fecha === dia ? crono : null;
    const fila = (que, nombre, valor) => {
      const activo = enMarcha?.que === que;
      return `
        <div class="biblia__tiempo-fila">
          <span class="biblia__tiempo-nombre">${nombre}</span>
          <span class="biblia__tiempo-valor" ${activo ? 'data-tic' : ''}>${activo ? textoCrono() : valor ? minutos(valor) : '—'}</span>
          <button type="button" class="chip ${activo ? 'chip--acento' : ''}" data-crono="${que}" aria-pressed="${activo}" ${enMarcha && !activo ? 'disabled' : ''}>${activo ? `${icono('parar', 12)} Parar` : '▶ Cronómetro'}</button>
          <button type="button" class="chip" data-sumar="${que}" data-min="5" aria-label="Sumar 5 minutos">+5</button>
          ${valor ? `<button type="button" class="chip" data-sumar="${que}" data-min="-5" aria-label="Quitar 5 minutos">−5</button>` : ''}
        </div>`;
    };
    const preguntas = d?.preguntas;
    const textoPasaje = textoLectura(tocan.flatMap((x) => x.lectura.caps));
    const bloquePreguntas = tocan.length
      ? `<section class="biblia__bloque">
          <p class="gastos__dia"><span>Para reflexionar</span><span></span></p>
          ${
            preguntas?.lista?.length && preguntas.sobre === textoPasaje
              ? `<p class="ajuste__ayuda biblia__sobre">Sobre ${escapar(textoPasaje)}</p><ol class="biblia__preguntas">${preguntas.lista.map((q) => `<li>${escapar(q)}</li>`).join('')}</ol>
                 <button type="button" class="gastos__enlace" data-preguntas>Otras preguntas</button>`
              : `<p class="ajuste__ayuda">Kitsune te propone tres preguntas sobre la lectura: una para entenderla, otra para tu día y otra para orar.</p>
                 <button type="button" class="boton" data-preguntas ${preguntando || !api.ia?.tarea ? 'disabled' : ''}>${icono('chispa', 15)} ${preguntando ? 'Pensando…' : 'Preguntas para reflexionar'}</button>`
          }
          <p class="apartado__mensaje" id="biblia-error-preguntas" role="alert" hidden></p>
        </section>`
      : '';

    return `
      ${cabecera}
      ${atrasos
        .map(
          ({ plan, e }) => `
        <div class="biblia__atraso" role="status">
          <p><strong>${e.atrasadas.length === 1 ? 'Tienes una lectura atrasada' : `Tienes ${e.atrasadas.length} lecturas atrasadas`}</strong> en «${escapar(plan.nombre)}». ¿Cómo te pones al día?</p>
          <div class="biblia__opciones">
            <button type="button" class="chip" data-al-dia="repartir" data-plan="${plan.id}" title="Lo pendiente se reparte en los días que quedan: acabas el mismo día, leyendo algo más cada día">Repartir hasta el final</button>
            <button type="button" class="chip" data-al-dia="mover" data-plan="${plan.id}" title="Sigues por donde lo dejaste: el plan acaba ${e.atrasadas.length} días de lectura más tarde">Seguir donde lo dejé</button>
            <button type="button" class="chip" data-al-dia="saltar" data-plan="${plan.id}" title="Lo atrasado se salta (no cuenta como leído) y sigues con lo de hoy">Saltarlo</button>
          </div>
        </div>`,
        )
        .join('')}
      ${lectura}
      <div class="biblia__casillas" role="group" aria-label="Lo de hoy">
        ${casillas
          .map((c) => `<button type="button" class="biblia__casilla" data-casilla="${c.id}" aria-pressed="${c.si}"><span class="biblia__check">${icono(c.si ? 'hecho' : c.ico, 16)}</span>${escapar(c.nombre)}</button>`)
          .join('')}
        <button type="button" class="biblia__casilla biblia__casilla--nueva" data-nueva-casilla aria-label="Añadir una casilla">${icono('nueva', 16)}</button>
      </div>
      <form class="biblia__nueva-casilla" data-form-casilla hidden>
        <input class="campo" name="nombre" maxlength="40" placeholder="Ayuno, devocional, memorizar…" aria-label="Nombre de la casilla" data-foco="casilla">
        <button type="submit" class="boton">Añadir</button>
        <button type="button" class="boton" data-cerrar-casilla>Cancelar</button>
      </form>
      <section class="biblia__bloque">
        <p class="gastos__dia"><span>Tiempo</span><span>${d?.minLectura || d?.minOracion ? minutos((d?.minLectura ?? 0) + (d?.minOracion ?? 0)) : ''}</span></p>
        ${fila('lectura', 'Lectura', d?.minLectura ?? 0)}
        ${fila('oracion', 'Oración', d?.minOracion ?? 0)}
      </section>
      ${bloquePreguntas}
      <section class="biblia__bloque">
        <p class="gastos__dia"><span>Versículo del día</span><span>RVR1960</span></p>
        ${enlace(v.enlace, `<span class="biblia__cita">${escapar(v.nombre)}</span><span class="biblia__tema">${escapar(v.tema)}</span><span class="biblia__leer">Leer en YouVersion ${icono('enlace', 12)}</span>`, 'biblia__versiculo')}
      </section>
      <p class="biblia__racha">${r ? `<strong>${r === 1 ? '1 día' : `${r} días`}</strong> ${r === 1 ? 'seguido' : 'seguidos'} · ` : ''}${m.diasHechos} de ${m.diasHastaHoy} días este mes</p>`;
  }

  // ---------- Cronómetro ----------

  function textoCrono() {
    if (!crono) return '';
    const s = Math.max(0, Math.floor((Date.now() - crono.desde) / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }
  function ponerTic() {
    clearInterval(tic);
    if (!crono || !contenedor.querySelector('[data-tic]')) return;
    tic = setInterval(() => {
      const el = contenedor.querySelector('[data-tic]');
      if (!el || !crono) return clearInterval(tic);
      el.textContent = textoCrono();
    }, 1000);
  }
  function alternarCrono(que) {
    if (crono?.que === que) {
      const fin = crono;
      crono = null;
      guardarCrono(null);
      // Al menos un minuto si has estado medio minuto o más.
      const min = Math.round((Date.now() - fin.desde) / 60_000);
      const total = min || (Date.now() - fin.desde >= 30_000 ? 1 : 0);
      if (total) return guardar(sumarMinutos(datos, fin.fecha, fin.que, total), { aviso: `${fin.que === 'oracion' ? 'Oración' : 'Lectura'}: +${minutos(total)}`, alDeshacer: true });
      return pintar();
    }
    crono = { que, desde: Date.now(), fecha: dia };
    guardarCrono(crono);
    pintar();
  }

  // ---------- Preguntas para reflexionar ----------

  async function pedirPreguntas() {
    const tocan = lecturasDelDia(datos, dia);
    if (!tocan.length || !api.ia?.tarea || preguntando) return;
    const pasaje = textoLectura(tocan.flatMap((x) => x.lectura.caps));
    preguntando = true;
    pintar();
    try {
      const r = await api.ia.tarea({
        sistema:
          'Acompañas la lectura bíblica diaria de un creyente. Escribes en español de España, con sencillez y respeto, sin sermonear. ' +
          'No copies el texto bíblico: la versión que lee (Reina-Valera 1960) tiene derechos.',
        usuario:
          `Lectura de hoy: ${pasaje} (Reina-Valera 1960).\n\nEscribe exactamente tres preguntas breves para reflexionar sobre esa lectura: ` +
          'la primera para entender el pasaje, la segunda para aplicarlo hoy y la tercera para llevarlo a la oración. ' +
          'Una pregunta por línea, sin numerar, sin títulos y sin nada más.',
        max: 600,
        etiqueta: 'biblia-preguntas',
        sobre: pasaje,
      });
      const lista = String(r?.texto ?? '')
        .split('\n')
        .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').replace(/\*\*/g, '').trim())
        .filter((l) => l.length > 8)
        .slice(0, 3);
      if (!lista.length) throw new Error('La IA no ha devuelto preguntas.');
      preguntando = false;
      await guardar(guardarPreguntas(datos, dia, pasaje, lista));
    } catch (error) {
      preguntando = false;
      pintar();
      const p = contenedor.querySelector('#biblia-error-preguntas');
      if (p) {
        p.hidden = false;
        p.textContent = `No he podido prepararlas: ${error.message}`;
      }
    }
  }

  // ---------- Planes ----------

  function filaPlan(p) {
    const e = estadoPlan(p, hoy);
    const pct = Math.round(e.parte * 100);
    const detalle = e.terminado
      ? `Terminado · ${e.leidos} de ${e.total} capítulos`
      : `${pct} % · ${e.leidos} de ${e.total} capítulos · acaba el ${fechaCorta(e.fin)}${e.fin.slice(0, 4) !== hoy.slice(0, 4) ? ` de ${e.fin.slice(0, 4)}` : ''}`;
    const abiertoAqui = abierto === p.id;
    let lecturas = '';
    if (abiertoAqui) {
      const todas = p.lecturas;
      const i = Math.max(0, todas.findIndex((l) => l.fecha >= hoy));
      const lista = verTodo ? todas : todas.slice(Math.max(0, i - 3), i + 11);
      const saltadas = new Set(p.saltadas);
      lecturas = `
        <ul class="biblia__dias">
          ${lista
            .map((l) => {
              const hecha = Boolean(p.hechas[l.fecha]);
              const estado = hecha ? 'hecha' : saltadas.has(l.fecha) ? 'saltada' : l.fecha < hoy ? 'atrasada' : l.fecha === hoy ? 'hoy' : '';
              return `<li class="biblia__dia-plan${estado ? ` biblia__dia-plan--${estado}` : ''}">
                <button type="button" class="biblia__check-plan" data-lectura="${p.id}" data-fecha="${l.fecha}" aria-pressed="${hecha}" aria-label="${hecha ? 'Leída' : 'Marcar como leída'}">${icono(hecha ? 'hecho' : 'libro', 14)}</button>
                <span class="biblia__dia-fecha">${escapar(fechaCorta(l.fecha))}</span>
                ${enlace(enlaceTramo(tramos(l.caps)[0]), escapar(textoLectura(l.caps, { corto: true })), 'biblia__dia-texto')}
                <span class="biblia__dia-estado">${estado === 'saltada' ? 'saltada' : estado === 'atrasada' ? 'atrasada' : estado === 'hoy' ? 'hoy' : ''}</span>
              </li>`;
            })
            .join('')}
        </ul>
        <div class="formulario__botones">
          ${todas.length > lista.length || verTodo ? `<button type="button" class="boton" data-ver-todo>${verTodo ? 'Ver solo estos días' : `Ver los ${todas.length} días`}</button>` : ''}
          <button type="button" class="boton" data-archivar="${p.id}">${p.archivado ? 'Recuperar' : 'Archivar'}</button>
          <button type="button" class="boton boton--peligro" data-borrar-plan="${p.id}">${icono('papelera', 14)} Borrar</button>
        </div>`;
    }
    return `
      <li class="biblia__plan${abiertoAqui ? ' biblia__plan--abierto' : ''}">
        <button type="button" class="biblia__plan-fila" data-abrir-plan="${p.id}" aria-expanded="${abiertoAqui}">
          <span class="biblia__plan-nombre">${escapar(p.nombre)}${e.atrasadas.length ? ` <span class="biblia__marca">${e.atrasadas.length} atrasadas</span>` : ''}</span>
          <span class="biblia__plan-detalle">${escapar(detalle)}</span>
          <span class="biblia__barra" aria-hidden="true"><span style="width:${pct}%"></span></span>
        </button>
        ${lecturas}
      </li>`;
  }

  function nuevoBorrador(tipo) {
    const fin = sumarDias(hoy, 30);
    return { tipo, plantilla: PLANTILLAS[0].id, libros: [], inicio: hoy, dias: [1, 2, 3, 4, 5, 6, 7], conFin: tipo === 'propio', fin, nombre: '' };
  }

  function previa() {
    const b = borrador;
    const p =
      b.tipo === 'lista'
        ? previaPlantilla({ plantilla: b.plantilla, inicio: b.inicio, dias: b.dias, fin: b.conFin ? b.fin : null })
        : previaPropia({ libros: b.libros, inicio: b.inicio, fin: b.fin, dias: b.dias });
    if (!p) return b.tipo === 'propio' && !b.libros.length ? 'Elige los libros que quieres leer.' : 'Revisa las fechas.';
    return `${p.dias} días de lectura, del ${fechaCorta(p.desde)} al ${fechaCorta(p.hasta)}${p.hasta.slice(0, 4) !== p.desde.slice(0, 4) ? ` de ${p.hasta.slice(0, 4)}` : ''} · unos ${p.minutosMedia} minutos al día · ${p.capitulos} capítulos`;
  }

  function formularioPlan() {
    const b = borrador;
    const dias = `<div class="biblia__semana" role="group" aria-label="Qué días lees">${DIAS_CORTOS.map(
      (d, i) => `<button type="button" class="chip" data-dia-semana="${i + 1}" aria-pressed="${b.dias.includes(i + 1)}" title="${DIAS_SEMANA[i]}">${d}</button>`,
    ).join('')}</div>`;
    const eleccion =
      b.tipo === 'lista'
        ? `<div class="biblia__plantillas" role="radiogroup" aria-label="Plan">
            ${PLANTILLAS.map(
              (p) => `<button type="button" role="radio" class="biblia__plantilla" data-plantilla="${p.id}" aria-checked="${p.id === b.plantilla}">
                <span class="biblia__plantilla-nombre">${escapar(p.nombre)}</span><span class="biblia__plantilla-detalle">${escapar(p.detalle)}</span></button>`,
            ).join('')}
          </div>`
        : `<div class="biblia__grupos" role="group" aria-label="Elegir por grupos">
            ${GRUPOS.map((g) => {
              const todos = g.libros.every((id) => b.libros.includes(id));
              return `<button type="button" class="chip" data-grupo="${g.id}" aria-pressed="${todos}">${escapar(g.nombre)}</button>`;
            }).join('')}
          </div>
          ${[true, false]
            .map(
              (at) => `<p class="gastos__dia"><span>${at ? 'Antiguo Testamento' : 'Nuevo Testamento'}</span><span>${b.libros.filter((id) => LIBROS.find((l) => l.id === id).at === at).length || ''}</span></p>
              <div class="biblia__libros" role="group" aria-label="${at ? 'Antiguo Testamento' : 'Nuevo Testamento'}">${LIBROS.filter((l) => l.at === at)
                .map((l) => `<button type="button" class="chip biblia__libro" data-libro="${l.id}" aria-pressed="${b.libros.includes(l.id)}" title="${escapar(l.nombre)} · ${l.capitulos} ${l.capitulos === 1 ? 'capítulo' : 'capítulos'}">${escapar(l.nombre)}</button>`)
                .join('')}</div>`,
            )
            .join('')}`;
    return `
      <form class="biblia__crear" data-form-plan>
        <div class="segmentado" role="tablist" aria-label="Tipo de plan">
          <button type="button" data-tipo-plan="lista" aria-pressed="${b.tipo === 'lista'}">Plan listo</button>
          <button type="button" data-tipo-plan="propio" aria-pressed="${b.tipo === 'propio'}">Elegir libros</button>
        </div>
        ${eleccion}
        <div class="formulario__fila biblia__fechas">
          <label class="gasto__etiqueta">Empieza <input class="campo" type="date" name="inicio" value="${b.inicio}" data-campo="inicio" required></label>
          ${
            b.tipo === 'lista'
              ? `<label class="gasto__etiqueta biblia__con-fin"><input type="checkbox" data-campo="conFin" ${b.conFin ? 'checked' : ''}> Acabar en una fecha</label>`
              : ''
          }
          ${b.conFin ? `<label class="gasto__etiqueta">Acaba <input class="campo" type="date" name="fin" value="${b.fin}" min="${b.inicio}" data-campo="fin" required></label>` : ''}
        </div>
        <div class="biblia__fila-dias"><span class="gasto__etiqueta">Días de lectura</span>${dias}</div>
        <input class="campo" name="nombre" maxlength="80" value="${escapar(b.nombre)}" placeholder="Nombre (opcional)" aria-label="Nombre del plan" data-campo="nombre" data-foco="nombre">
        <p class="biblia__previa" id="biblia-previa">${escapar(previa())}</p>
        <p class="apartado__mensaje" role="alert" hidden></p>
        <div class="formulario__botones">
          <button type="submit" class="boton boton--primario">Empezar el plan</button>
          <button type="button" class="boton" data-cancelar-plan>Cancelar</button>
        </div>
      </form>`;
  }

  function panelPlanes() {
    const activos = datos.planes.filter((p) => !p.archivado);
    const archivados = datos.planes.filter((p) => p.archivado);
    const a = datos.ajustes;
    const ag = datos.agenda;
    return `
      <div class="gastos__fijos-cabecera">
        <p><span class="gastos__etiqueta">tus planes</span>${activos.length ? `<strong>${activos.length}</strong> en marcha` : 'Ninguno todavía'}</p>
        ${creando ? '' : `<button type="button" class="boton" data-crear="lista">${icono('nueva', 15)} Nuevo</button>`}
      </div>
      ${creando ? formularioPlan() : ''}
      ${activos.length ? `<ul class="biblia__planes">${activos.map(filaPlan).join('')}</ul>` : creando ? '' : '<p class="gastos__vacio">Elige un plan listo o los libros que quieras leer, desde cuándo y qué días. Kitsune lo reparte para que cada día te lleve un rato parecido.</p>'}
      ${archivados.length ? `<p class="gastos__dia"><span>Archivados</span></p><ul class="biblia__planes">${archivados.map(filaPlan).join('')}</ul>` : ''}

      <form class="gastos__ajuste" data-form-avisos>
        <label><span class="gastos__etiqueta">avisos al móvil</span>
          <span class="ajuste__ayuda">Por la mañana, lo que toca leer; por la noche, si te falta leer u orar. Llegan con los avisos de Kitsune activados (Ajustes → Avisos).</span></label>
        <label class="biblia__interruptor"><input type="checkbox" data-aviso="avisos" ${a.avisos ? 'checked' : ''}> Avisarme</label>
        <div class="formulario__fila">
          <label class="gasto__etiqueta">Mañana <input class="campo" type="time" value="${a.avisoManana}" data-aviso="avisoManana" ${a.avisos ? '' : 'disabled'}></label>
          <label class="gasto__etiqueta">Noche <input class="campo" type="time" value="${a.avisoNoche}" data-aviso="avisoNoche" ${a.avisos ? '' : 'disabled'}></label>
        </div>
      </form>

      <form class="gastos__ajuste" data-form-agenda>
        <label><span class="gastos__etiqueta">un hueco en tu calendario</span>
          <span class="ajuste__ayuda">${
            ag
              ? `«Lectura y oración» está en tu calendario de Google: ${escapar(ag.dias.length === 7 ? 'cada día' : ag.dias.map((d) => DIAS_SEMANA[d - 1]).join(', '))} a las ${escapar(ag.hora)}, ${ag.minutos} minutos.`
              : 'Reserva cada semana un rato fijo para leer y orar, como una cita más.'
          }</span></label>
        ${
          ag
            ? '<div class="formulario__botones"><button type="button" class="boton" data-quitar-agenda>Quitarlo del calendario</button></div>'
            : `<div class="formulario__fila">
                <label class="gasto__etiqueta">A las <input class="campo" type="time" name="hora" value="07:30" required></label>
                <label class="gasto__etiqueta">Minutos <input class="campo" type="number" name="minutos" min="5" max="240" value="20" inputmode="numeric"></label>
              </div>
              <div class="biblia__semana" role="group" aria-label="Qué días">${DIAS_CORTOS.map((d, i) => `<label class="chip chip--marcable"><input type="checkbox" name="dia" value="${i + 1}" checked> ${d}</label>`).join('')}</div>
              <div class="formulario__botones"><button type="submit" class="boton">${icono('calendario', 15)} Añadir a mi calendario</button></div>`
        }
        <p class="apartado__mensaje" role="alert" hidden></p>
      </form>

      ${
        datos.casillas.length
          ? `<div class="gastos__ajuste"><span class="gastos__etiqueta">tus casillas</span>
              <ul class="biblia__mis-casillas">${datos.casillas.map((c) => `<li><span>${escapar(c.nombre)}</span><button type="button" class="gastos__enlace" data-quitar-casilla="${c.id}">Quitar</button></li>`).join('')}</ul></div>`
          : ''
      }
      <p class="ajuste__ayuda apartado__nota">La lectura se abre en YouVersion con la Reina-Valera 1960. Su texto tiene derechos (Sociedades Bíblicas Unidas), así que Kitsune no lo guarda: solo tu plan y lo que marcas.</p>`;
  }

  // ---------- Mes ----------

  function panelMes() {
    const r = resumenMes(datos, mes, hoy);
    const primero = diaSemana(`${mes}-01`);
    const huecos = Array.from({ length: primero - 1 }, () => '<span class="biblia__celda biblia__celda--vacia" aria-hidden="true"></span>');
    const celdas = r.dias.map((x) => {
      const clases = ['biblia__celda', x.hecho ? 'biblia__celda--hecha' : '', x.fecha === hoy ? 'biblia__celda--hoy' : '', x.futuro ? 'biblia__celda--futura' : '', x.tocaba && !x.leido && !x.futuro ? 'biblia__celda--falta' : ''].filter(Boolean).join(' ');
      const etiqueta = `${fechaLarga(x.fecha, hoy)}: ${[x.leido ? 'leído' : '', x.orado ? 'orado' : '', x.extra ? `${x.extra} más` : ''].filter(Boolean).join(', ') || (x.futuro ? 'aún no' : 'nada marcado')}`;
      return `<button type="button" class="${clases}" data-ir-dia="${x.fecha}" aria-label="${escapar(etiqueta)}" title="${escapar(etiqueta)}">
        <span class="biblia__num">${Number(x.fecha.slice(8))}</span>
        <span class="biblia__puntos">${x.leido ? '<i class="biblia__punto biblia__punto--leido"></i>' : ''}${x.orado ? '<i class="biblia__punto biblia__punto--orado"></i>' : ''}${x.extra ? '<i class="biblia__punto"></i>' : ''}</span>
      </button>`;
    });
    const actual = mes === hoy.slice(0, 7);
    const pasado = mes < hoy.slice(0, 7);
    const base = actual ? r.diasHastaHoy : pasado ? r.dias.length : 0;
    return `
      <header class="gastos__mes">
        <button type="button" class="icono-boton" data-mover-mes="-1" aria-label="Mes anterior">${icono('volver', 18)}</button>
        <div class="gastos__mes-centro"><h2>${escapar(nombreMes(mes))}</h2>${actual ? '' : '<button type="button" class="gastos__volver" data-mes-actual>Volver a este mes</button>'}</div>
        <button type="button" class="icono-boton gastos__siguiente" data-mover-mes="1" aria-label="Mes siguiente">${icono('volver', 18)}</button>
      </header>
      <section class="gastos__cifra biblia__cifra">
        <p class="gastos__etiqueta">${actual ? 'este mes' : pasado ? 'ese mes' : 'aún no ha empezado'}</p>
        <p class="gastos__total">${r.diasHechos}<span class="biblia__de"> de ${base} días</span></p>
        <p class="gastos__detalle">${[actual && racha(datos, hoy) ? (racha(datos, hoy) === 1 ? '1 día seguido' : `${racha(datos, hoy)} días seguidos`) : '', `leíste ${r.diasLeidos} ${r.diasLeidos === 1 ? 'día' : 'días'}`, `oraste ${r.diasOrados}`].filter(Boolean).join(' · ')}</p>
      </section>
      <div class="biblia__calendario" role="grid" aria-label="${escapar(nombreMes(mes))}">
        ${DIAS_CORTOS.map((d) => `<span class="biblia__cab" aria-hidden="true">${d}</span>`).join('')}
        ${[...huecos, ...celdas].join('')}
      </div>
      <p class="balance__leyenda biblia__leyenda"><i class="biblia__punto biblia__punto--leido"></i>leído <i class="biblia__punto biblia__punto--orado"></i>orado <i class="biblia__punto"></i>tus casillas <i class="biblia__ley-falta"></i>tocaba leer</p>
      <section class="biblia__bloque">
        <p class="gastos__dia"><span>Resumen</span><span></span></p>
        <ul class="biblia__resumen">
          <li><span>Capítulos leídos</span><strong>${r.capitulos}</strong></li>
          <li><span>Tiempo de lectura</span><strong>${r.minLectura ? minutos(r.minLectura) : '—'}</strong></li>
          <li><span>Tiempo de oración</span><strong>${r.minOracion ? minutos(r.minOracion) : '—'}</strong></li>
          ${r.extras.map((c) => `<li><span>${escapar(c.nombre)}</span><strong>${c.dias} ${c.dias === 1 ? 'día' : 'días'}</strong></li>`).join('')}
        </ul>
        ${r.libros.length ? `<p class="ajuste__ayuda">Libros: ${escapar(r.libros.join(', '))}.</p>` : ''}
        ${datos.planes
          .filter((p) => !p.archivado)
          .map((p) => {
            const e = estadoPlan(p, hoy);
            return `<p class="biblia__progreso"><span>${escapar(p.nombre)}</span><span>${Math.round(e.parte * 100)} %</span><span class="biblia__barra" aria-hidden="true"><span style="width:${Math.round(e.parte * 100)}%"></span></span></p>`;
          })
          .join('')}
      </section>
      <p class="ajuste__ayuda">Toca un día para marcar lo que hiciste.</p>`;
  }

  // ---------- Pulsaciones ----------

  async function alPulsar(e) {
    const b = e.target.closest('button');
    if (!b || b.disabled) return;
    const d = b.dataset;
    if (d.pestana) {
      pestana = d.pestana;
      return pintar();
    }
    if (d.moverDia) {
      dia = sumarDias(dia, Number(d.moverDia));
      return pintar();
    }
    if ('volverHoy' in d) {
      dia = hoy;
      return pintar();
    }
    if (d.moverMes) {
      mes = sumarMes(mes, Number(d.moverMes));
      return pintar();
    }
    if ('mesActual' in d) {
      mes = hoy.slice(0, 7);
      return pintar();
    }
    if (d.irDia) {
      dia = d.irDia;
      pestana = 'hoy';
      return pintar();
    }
    if (d.casilla) {
      const ahora = d.casilla === 'leido' ? Boolean(datos.dias[dia]?.leido) : d.casilla === 'orado' ? Boolean(datos.dias[dia]?.orado) : Boolean(datos.dias[dia]?.extra[d.casilla]);
      return guardar(marcarCasilla(datos, dia, d.casilla, !ahora));
    }
    if ('nuevaCasilla' in d) {
      const f = contenedor.querySelector('[data-form-casilla]');
      f.hidden = false;
      return f.querySelector('input').focus();
    }
    if ('cerrarCasilla' in d) {
      contenedor.querySelector('[data-form-casilla]').hidden = true;
      return;
    }
    if (d.lectura) {
      const plan = datos.planes.find((p) => p.id === d.lectura);
      const hecha = Boolean(plan?.hechas[d.fecha]);
      // Desde Hoy cuenta el día que estás mirando (marcar lo de ayer, ayer); desde la lista del plan, hoy.
      const cuando = b.closest('.biblia__lectura') && dia < hoy ? dia : hoy;
      return guardar(marcarLectura(datos, d.lectura, d.fecha, !hecha, cuando), hecha ? {} : { aviso: 'Lectura hecha', alDeshacer: true });
    }
    if (d.crono) return alternarCrono(d.crono);
    if (d.sumar) return guardar(sumarMinutos(datos, dia, d.sumar, Number(d.min)));
    if ('preguntas' in d) return pedirPreguntas();
    if (d.alDia) {
      const nombres = { repartir: 'Repartido hasta el final', mover: 'Sigues donde lo dejaste', saltar: 'Saltadas las atrasadas' };
      return guardar(ponerseAlDia(datos, d.plan, d.alDia, hoy), { aviso: nombres[d.alDia], alDeshacer: true });
    }
    // Planes.
    if (d.crear) {
      pestana = 'planes';
      creando = d.crear;
      borrador = nuevoBorrador(d.crear);
      pintar();
      return contenedor.querySelector('[data-form-plan]')?.scrollIntoView({ block: 'nearest' });
    }
    if (d.tipoPlan) {
      creando = d.tipoPlan;
      borrador = { ...borrador, tipo: d.tipoPlan, conFin: d.tipoPlan === 'propio' ? true : borrador.conFin };
      return pintar();
    }
    if (d.plantilla) {
      borrador.plantilla = d.plantilla;
      return pintar();
    }
    if (d.libro) {
      borrador.libros = borrador.libros.includes(d.libro) ? borrador.libros.filter((x) => x !== d.libro) : [...borrador.libros, d.libro];
      return pintar();
    }
    if (d.grupo) {
      const g = GRUPOS.find((x) => x.id === d.grupo);
      const todos = g.libros.every((id) => borrador.libros.includes(id));
      borrador.libros = todos ? borrador.libros.filter((id) => !g.libros.includes(id)) : [...new Set([...borrador.libros, ...g.libros])];
      return pintar();
    }
    if (d.diaSemana) {
      const n = Number(d.diaSemana);
      const dias = borrador.dias.includes(n) ? borrador.dias.filter((x) => x !== n) : [...borrador.dias, n].sort();
      if (dias.length) borrador.dias = dias;
      return pintar();
    }
    if ('cancelarPlan' in d) {
      creando = null;
      borrador = null;
      return pintar();
    }
    if (d.abrirPlan) {
      abierto = abierto === d.abrirPlan ? null : d.abrirPlan;
      verTodo = false;
      return pintar();
    }
    if ('verTodo' in d) {
      verTodo = !verTodo;
      return pintar();
    }
    if (d.archivar) {
      const p = datos.planes.find((x) => x.id === d.archivar);
      abierto = null;
      return guardar(archivarPlan(datos, d.archivar, !p.archivado), { aviso: p.archivado ? 'Plan recuperado' : 'Plan archivado', alDeshacer: true });
    }
    if (d.borrarPlan) {
      const p = datos.planes.find((x) => x.id === d.borrarPlan);
      abierto = null;
      return guardar(borrarPlan(datos, d.borrarPlan), { aviso: `Borrado: ${p?.nombre ?? 'plan'}`, alDeshacer: true });
    }
    if (d.quitarCasilla) return guardar(quitarCasilla(datos, d.quitarCasilla), { aviso: 'Casilla quitada', alDeshacer: true });
    if ('quitarAgenda' in d) return quitarDeAgenda(b);
  }

  function alCambiarCampo(e) {
    const c = e.target;
    if (c.dataset.campo && borrador) {
      if (c.dataset.campo === 'conFin') borrador.conFin = c.checked;
      else if (c.dataset.campo !== 'nombre' && c.value) borrador[c.dataset.campo] = c.value;
      if (borrador.fin < borrador.inicio) borrador.fin = sumarDias(borrador.inicio, 30);
      if (c.dataset.campo !== 'nombre') pintar();
      return;
    }
    if (c.dataset.aviso) {
      const valor = c.dataset.aviso === 'avisos' ? c.checked : c.value;
      return guardar(ponerAjustes(datos, { [c.dataset.aviso]: valor }), { aviso: c.dataset.aviso === 'avisos' ? (valor ? 'Avisos activados' : 'Sin avisos') : 'Avisos guardados' });
    }
  }
  function alEscribir(e) {
    if (e.target.dataset.campo === 'nombre' && borrador) borrador.nombre = e.target.value;
  }

  function mensaje(form, texto) {
    const p = form.querySelector('.apartado__mensaje');
    if (!p) return;
    p.hidden = !texto;
    p.textContent = texto;
  }

  async function alEnviar(e) {
    e.preventDefault();
    const form = e.target;
    try {
      if ('formCasilla' in form.dataset) {
        const r = anadirCasilla(datos, form.nombre.value);
        await guardar(r.datos, { aviso: `Casilla nueva: ${r.casilla.nombre}` });
        return;
      }
      if ('formPlan' in form.dataset) {
        const b = borrador;
        const r =
          b.tipo === 'lista'
            ? crearPlanDePlantilla(datos, { plantilla: b.plantilla, inicio: b.inicio, dias: b.dias, fin: b.conFin ? b.fin : null, nombre: b.nombre.trim() })
            : crearPlanPropio(datos, { libros: b.libros, inicio: b.inicio, fin: b.fin, dias: b.dias, nombre: b.nombre.trim() });
        creando = null;
        borrador = null;
        abierto = null;
        pestana = r.plan.lecturas[0].fecha <= hoy ? 'hoy' : 'planes';
        dia = hoy;
        await guardar(r.datos, { aviso: `Plan en marcha: ${r.plan.nombre}`, alDeshacer: true });
        return;
      }
      if ('formAgenda' in form.dataset) return anadirAAgenda(form);
    } catch (error) {
      mensaje(form, error.message);
    }
  }

  // ---------- Calendario de Google ----------

  async function anadirAAgenda(form) {
    if (!api.calendario?.crear) return mensaje(form, 'El calendario no está disponible aquí.');
    const estado = await api.calendario.estado?.().catch(() => null);
    if (estado && (!estado.calendario || estado.necesitaReconectar)) return mensaje(form, 'Conecta tu calendario de Google en Ajustes → Google.');
    const hora = form.hora.value || '07:30';
    const minutosEvento = Math.min(240, Math.max(5, Number(form.minutos.value) || 20));
    const dias = [...form.querySelectorAll('input[name="dia"]:checked')].map((x) => Number(x.value));
    if (!dias.length) return mensaje(form, 'Elige al menos un día.');
    // El primer día que toque, desde hoy (si hoy ya ha pasado la hora, desde mañana).
    const [h, m] = hora.split(':').map(Number);
    let fecha = hoy;
    for (let i = 0; i < 8; i++) {
      const f = sumarDias(hoy, i);
      const [a, mm, dd] = f.split('-').map(Number);
      if (dias.includes(diaSemana(f)) && new Date(a, mm - 1, dd, h, m).getTime() > Date.now()) {
        fecha = f;
        break;
      }
    }
    const [a, mm, dd] = fecha.split('-').map(Number);
    const inicio = new Date(a, mm - 1, dd, h, m).getTime();
    const boton = form.querySelector('button[type="submit"]');
    boton.disabled = true;
    mensaje(form, '');
    try {
      const evento = await api.calendario.crear({ titulo: 'Lectura y oración', inicio, fin: inicio + minutosEvento * 60_000, descripcion: 'Tu rato de lectura bíblica y oración (desde Kitsune).', repetir: { dias } });
      await guardar(ponerAgenda(datos, { id: evento.id, hora, minutos: minutosEvento, dias }), { aviso: 'Añadido a tu calendario' });
    } catch (error) {
      boton.disabled = false;
      mensaje(form, `No se ha podido añadir: ${error.message}`);
    }
  }

  async function quitarDeAgenda(boton) {
    const form = boton.closest('form');
    boton.disabled = true;
    try {
      if (datos.agenda?.id) await api.calendario.borrar(datos.agenda.id).catch((error) => {
        // Si ya no estaba en el calendario, se quita igual de aquí.
        if (!/404|410|not found|no existe/i.test(error.message)) throw error;
      });
      await guardar(ponerAgenda(datos, null), { aviso: 'Quitado del calendario' });
    } catch (error) {
      boton.disabled = false;
      mensaje(form, `No se ha podido quitar: ${error.message}`);
    }
  }

  // ---------- Aviso con «Deshacer» ----------

  function avisar(texto, alDeshacer = null) {
    const caja = contenedor.querySelector('#biblia-aviso');
    if (!caja) return;
    clearTimeout(temporizadorAviso);
    deshacer = alDeshacer;
    caja.innerHTML = `<span></span>${alDeshacer ? '<button type="button" class="gastos__deshacer">Deshacer</button>' : ''}`;
    caja.querySelector('span').textContent = texto;
    caja.hidden = false;
    caja.querySelector('button')?.addEventListener('click', async (ev) => {
      ev.stopPropagation();
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
    async recargar() {
      await cargar();
      if (contenedor.querySelector('.biblia')) pintar();
    },
    // Desde Hoy o el buscador.
    abrirPestana(nombre) {
      pestana = nombre;
      if (nombre === 'hoy') dia = fechaISO();
      if (contenedor.querySelector('.biblia')) pintar();
    },
    nuevoPlan() {
      pestana = 'planes';
      creando = 'lista';
      borrador = nuevoBorrador('lista');
      if (contenedor.querySelector('.biblia')) pintar();
    },
  };
}
