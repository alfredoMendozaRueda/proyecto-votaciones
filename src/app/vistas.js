import { icono } from './iconos.js';
import { retirar } from './animaciones.js';
import { cuandoLegible, haceCuanto } from './fechas.js';
import { crearPanelAutomatizaciones, mostrarActividad, sinServidor } from './automatizaciones.js';

// Apartados de Agenda, Recordatorios, Memoria e Historial. Cada uno pinta su
// lista al mostrarse (mostrar) y permite añadir y borrar a mano lo mismo que
// Kitsune hace desde el chat.

const DIA = 86_400_000;
const escapar = (t = '') => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dos = (n) => String(n).padStart(2, '0');
const fechaCampo = (d) => `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
const horaCampo = (d) => `${dos(d.getHours())}:${dos(d.getMinutes())}`;
// "2026-11-14" + "08:35" en la hora local del usuario.
const deCampos = (fecha, hora = '00:00') => {
  const [a, m, d] = fecha.split('-').map(Number);
  const [h, min] = hora.split(':').map(Number);
  return new Date(a, m - 1, d, h, min).getTime();
};
const inicioDelDia = (ms) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
};

export const cargando = '<p class="apartado__cargando"><span class="puntos" aria-hidden="true"><i></i><i></i><i></i></span>Cargando…</p>';

// Borrar pide un segundo toque: el primero convierte el icono en "¿Borrar?".
export function botonBorrar(etiqueta, accion) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.className = 'boton-borrar';
  boton.setAttribute('aria-label', etiqueta);
  boton.title = etiqueta;
  boton.innerHTML = icono('papelera', 16);
  let espera = null;
  const restaurar = () => {
    boton.classList.remove('confirmando');
    boton.innerHTML = icono('papelera', 16);
    boton.setAttribute('aria-label', etiqueta);
  };
  boton.addEventListener('click', async (e) => {
    e.stopPropagation();
    if (!boton.classList.contains('confirmando')) {
      boton.classList.add('confirmando');
      boton.textContent = '¿Borrar?';
      boton.setAttribute('aria-label', `Confirmar: ${etiqueta}`);
      clearTimeout(espera);
      espera = setTimeout(restaurar, 3000);
      return;
    }
    clearTimeout(espera);
    boton.disabled = true;
    try {
      await accion();
    } catch {
      boton.disabled = false;
      restaurar();
    }
  });
  return boton;
}

function mensajeError(contenedor, texto) {
  const p = contenedor.querySelector('.apartado__mensaje');
  if (!p) return;
  p.textContent = texto;
  p.hidden = !texto;
}

// ---------- Agenda ----------

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const NOMBRES_SEMANA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const horaCorta = (ms) => new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const mismoDia = (a, b) => inicioDelDia(a) === inicioDelDia(b);
// El día siguiente a las 00:00 (sin contar los cambios de hora).
const diaSiguiente = (ms) => {
  const d = new Date(ms);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
};

// Primer lunes visible y los 42 días (6 semanas) de la cuadrícula de un mes.
function diasDeLaCuadricula(anio, mes) {
  const primero = new Date(anio, mes, 1);
  const desplazamiento = (primero.getDay() + 6) % 7;
  return Array.from({ length: 42 }, (_, i) => new Date(anio, mes, 1 - desplazamiento + i).getTime());
}

// La agenda es un calendario: el mes en cuadrícula, con puntos en los días que
// tienen algo, y debajo los eventos del día elegido.
export function crearAgenda({ contenedor, api, abrirAjustes, preguntar, alCrear = () => {} }) {
  const hoy = () => inicioDelDia(Date.now());
  let seleccionado = hoy();
  let mesVisible = { anio: new Date().getFullYear(), mes: new Date().getMonth() };
  let eventos = [];
  let cargado = null; // clave del mes cuyos eventos hay en memoria
  // Los recordatorios pendientes también salen en su día, junto a las citas.
  let recordatorios = [];

  async function mostrar() {
    contenedor.innerHTML = `
      <div class="apartado desplazable">
        <div class="apartado__cabecera">
          <h2>Agenda</h2>
          <button type="button" class="boton boton--suave" id="agenda-hoy">Hoy</button>
          <button type="button" class="icono-boton" id="agenda-actualizar" aria-label="Actualizar" title="Actualizar">${icono('actualizar')}</button>
          <button type="button" class="boton boton--primario" id="agenda-nuevo" hidden>${icono('nueva', 15)} Nuevo</button>
        </div>
        <form class="formulario" id="agenda-formulario" hidden>
          <input class="campo" name="titulo" placeholder="Qué (por ejemplo, Dentista)…" maxlength="200" required aria-label="Título del evento" autocomplete="off">
          <div class="formulario__fila">
            <input class="campo" type="date" name="fecha" required aria-label="Fecha">
            <label class="casilla"><input type="checkbox" name="todoElDia"> Todo el día</label>
          </div>
          <div class="formulario__fila" data-horas>
            <label class="formulario__hora">De <input class="campo" type="time" name="inicio" required aria-label="Hora de inicio"></label>
            <label class="formulario__hora">a <input class="campo" type="time" name="fin" required aria-label="Hora de fin"></label>
          </div>
          <input class="campo" name="lugar" placeholder="Dónde (opcional)…" maxlength="200" aria-label="Lugar" autocomplete="off">
          <p class="apartado__mensaje" role="alert" hidden></p>
          <div class="formulario__botones">
            <button type="submit" class="boton boton--primario">Guardar en el calendario</button>
            <button type="button" class="boton" data-cancelar>Cancelar</button>
          </div>
        </form>
        <div id="agenda-lista">${cargando}</div>
      </div>`;
    contenedor.querySelector('#agenda-actualizar').addEventListener('click', () => {
      cargado = null;
      pintar();
    });
    contenedor.querySelector('#agenda-hoy').addEventListener('click', () => irA(hoy()));
    const formulario = contenedor.querySelector('#agenda-formulario');
    contenedor.querySelector('#agenda-nuevo').addEventListener('click', () => abrirFormulario(formulario));
    formulario.querySelector('[data-cancelar]').addEventListener('click', () => (formulario.hidden = true));
    formulario.todoElDia.addEventListener('change', () => {
      formulario.querySelector('[data-horas]').hidden = formulario.todoElDia.checked;
      formulario.inicio.required = formulario.fin.required = !formulario.todoElDia.checked;
    });
    formulario.inicio.addEventListener('change', () => {
      // Al cambiar la hora de inicio, el fin pasa a una hora después.
      const [h, m] = formulario.inicio.value.split(':').map(Number);
      if (Number.isFinite(h)) formulario.fin.value = `${dos(Math.min(h + 1, 23))}:${dos(m)}`;
    });
    formulario.addEventListener('submit', (e) => {
      e.preventDefault();
      guardarEvento(formulario);
    });
    await pintar();
  }

  // El formulario se abre con el día elegido en el calendario.
  function abrirFormulario(formulario) {
    formulario.reset();
    const base = new Date();
    base.setHours(base.getHours() + 1, 0, 0, 0);
    const dia = new Date(seleccionado);
    dia.setHours(mismoDia(seleccionado, Date.now()) ? base.getHours() : 10, 0, 0, 0);
    formulario.fecha.value = fechaCampo(dia);
    formulario.inicio.value = horaCampo(dia);
    formulario.fin.value = `${dos(Math.min(dia.getHours() + 1, 23))}:00`;
    formulario.querySelector('[data-horas]').hidden = false;
    mensajeError(formulario, '');
    formulario.hidden = false;
    formulario.titulo.focus();
  }

  async function guardarEvento(formulario) {
    const todoElDia = formulario.todoElDia.checked;
    const inicio = deCampos(formulario.fecha.value, todoElDia ? '00:00' : formulario.inicio.value);
    const fin = todoElDia ? diaSiguiente(inicio) : deCampos(formulario.fecha.value, formulario.fin.value);
    if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) {
      mensajeError(formulario, 'La hora de fin tiene que ser posterior a la de inicio.');
      return;
    }
    const boton = formulario.querySelector('[type=submit]');
    boton.disabled = true;
    try {
      await api.calendario.crear({ titulo: formulario.titulo.value.trim(), inicio, fin, todoElDia, lugar: formulario.lugar.value.trim() });
      alCrear();
      formulario.hidden = true;
      cargado = null;
      seleccionado = inicioDelDia(inicio);
      mesVisible = { anio: new Date(inicio).getFullYear(), mes: new Date(inicio).getMonth() };
      await pintar();
    } catch (e) {
      mensajeError(formulario, e.message);
    } finally {
      boton.disabled = false;
    }
  }

  const delDia = (dia) => {
    const fin = diaSiguiente(dia);
    return eventos.filter((e) => e.inicio < fin && e.fin > dia);
  };
  const recordatoriosDel = (dia) => recordatorios.filter((r) => r.cuando >= dia && r.cuando < diaSiguiente(dia));

  // Elegir un día (si es de otro mes, el calendario pasa a ese mes).
  function irA(dia, { enfocar = false } = {}) {
    seleccionado = inicioDelDia(dia);
    const d = new Date(seleccionado);
    const otroMes = d.getFullYear() !== mesVisible.anio || d.getMonth() !== mesVisible.mes;
    mesVisible = { anio: d.getFullYear(), mes: d.getMonth() };
    if (otroMes) return pintar({ enfocar });
    pintarCalendario({ enfocar });
  }

  function cambiarMes(paso) {
    const d = new Date(mesVisible.anio, mesVisible.mes + paso, 1);
    mesVisible = { anio: d.getFullYear(), mes: d.getMonth() };
    // Al cambiar de mes se elige el 1 (o hoy, si es el mes actual).
    seleccionado = d.getMonth() === new Date().getMonth() && d.getFullYear() === new Date().getFullYear() ? hoy() : d.getTime();
    pintar({ direccion: paso });
  }

  async function pintar({ enfocar = false, direccion = 0 } = {}) {
    const lista = contenedor.querySelector('#agenda-lista');
    if (!lista) return;
    const estado = await api.calendario.estado().catch(() => ({ conectado: false }));
    contenedor.querySelector('#agenda-nuevo').hidden = !(estado.calendario && !estado.necesitaReconectar);
    if (!estado.conectado || !estado.calendario || estado.necesitaReconectar) {
      contenedor.querySelector('#agenda-hoy').hidden = true;
      const reconectar = estado.necesitaReconectar && estado.calendario;
      lista.innerHTML = `
        <div class="tarjeta-aviso">
          <h2>${reconectar ? 'Vuelve a entrar en Google' : estado.conectado ? 'Conecta también el calendario' : 'Conecta tu calendario'}</h2>
          <p>${
            reconectar
              ? 'La sesión de Google ha caducado. Entra de nuevo para ver tu agenda.'
              : 'Kitsune puede enseñarte tu agenda de Google Calendar, crear eventos y avisarte antes de cada cita.'
          }</p>
          <button type="button" class="boton boton--primario" id="agenda-conectar">${icono('calendario', 15)} ${reconectar ? 'Volver a entrar' : 'Ir a Ajustes'}</button>
        </div>`;
      lista.querySelector('#agenda-conectar').addEventListener('click', async () => {
        if (!reconectar) return abrirAjustes('correo');
        await api.correo.conectar().catch(() => {});
        pintar();
      });
      return;
    }
    const clave = `${mesVisible.anio}-${mesVisible.mes}`;
    if (!lista.querySelector('.calendario')) {
      lista.innerHTML = `
        <section class="calendario" aria-label="Calendario">
          <div class="calendario__cabecera">
            <button type="button" class="icono-boton" data-mes="-1" aria-label="Mes anterior" title="Mes anterior">${icono('volver')}</button>
            <h3 class="calendario__mes" aria-live="polite"></h3>
            <button type="button" class="icono-boton calendario__siguiente" data-mes="1" aria-label="Mes siguiente" title="Mes siguiente">${icono('volver')}</button>
          </div>
          <div class="calendario__semana" aria-hidden="true">${DIAS_SEMANA.map((d) => `<span>${d}</span>`).join('')}</div>
          <div class="calendario__dias" role="group"></div>
        </section>
        <section class="calendario__dia" aria-live="polite"></section>`;
      lista.querySelectorAll('[data-mes]').forEach((b) => b.addEventListener('click', () => cambiarMes(Number(b.dataset.mes))));
      prepararGestos(lista.querySelector('.calendario__dias'));
    }
    if (cargado !== clave) {
      const dias = diasDeLaCuadricula(mesVisible.anio, mesVisible.mes);
      lista.querySelector('.calendario').classList.add('cargando');
      pintarCalendario({ enfocar, direccion });
      try {
        eventos = await api.calendario.eventos(dias[0], diaSiguiente(dias.at(-1)));
        cargado = clave;
      } catch (e) {
        lista.querySelector('.calendario__dia').innerHTML = `<p class="apartado__vacio">${escapar(e.message)}</p>`;
        return;
      } finally {
        lista.querySelector('.calendario')?.classList.remove('cargando');
      }
    }
    recordatorios = (await api.recordatorios?.listar().catch(() => null)) ?? recordatorios;
    pintarCalendario({ enfocar, direccion: cargado === clave ? 0 : direccion });
  }

  function pintarCalendario({ enfocar = false, direccion = 0 } = {}) {
    const lista = contenedor.querySelector('#agenda-lista');
    const rejilla = lista?.querySelector('.calendario__dias');
    if (!rejilla) return;
    const { anio, mes } = mesVisible;
    const titulo = `${new Date(anio, mes, 1).toLocaleDateString('es-ES', { month: 'long' })} ${anio}`;
    lista.querySelector('.calendario__mes').textContent = titulo;
    contenedor.querySelector('#agenda-hoy').hidden = mismoDia(seleccionado, Date.now());
    rejilla.innerHTML = diasDeLaCuadricula(anio, mes)
      .map((dia, i) => {
        const d = new Date(dia);
        const suyos = delDia(dia);
        const fuera = d.getMonth() !== mes;
        const nombre = `${NOMBRES_SEMANA[(d.getDay() + 6) % 7]}, ${d.getDate()} de ${d.toLocaleDateString('es-ES', { month: 'long' })}`;
        const avisos = recordatoriosDel(dia);
        const cuantos =
          (suyos.length ? `, ${suyos.length} ${suyos.length === 1 ? 'evento' : 'eventos'}` : '') +
          (avisos.length ? `, ${avisos.length} ${avisos.length === 1 ? 'recordatorio' : 'recordatorios'}` : '');
        const puntos = [...suyos.map((e) => (e.todoElDia ? 'todo-el-dia' : '')), ...avisos.map(() => 'aviso')]
          .slice(0, 3)
          .map((clase) => `<i class="${clase}"></i>`)
          .join('');
        return `<button type="button" class="calendario__celda${fuera ? ' fuera' : ''}${mismoDia(dia, Date.now()) ? ' hoy' : ''}"
          data-dia="${dia}" style="--i: ${(i % 7) + Math.floor(i / 7)}" aria-label="${nombre}${cuantos}" aria-pressed="${dia === seleccionado}"
          ${mismoDia(dia, Date.now()) ? 'aria-current="date"' : ''} tabindex="${dia === seleccionado ? 0 : -1}">
          <span class="calendario__numero">${d.getDate()}</span><span class="calendario__puntos">${puntos}</span></button>`;
      })
      .join('');
    if (direccion) {
      rejilla.classList.remove('desde-izquierda', 'desde-derecha');
      void rejilla.offsetWidth;
      rejilla.classList.add(direccion > 0 ? 'desde-derecha' : 'desde-izquierda');
    }
    rejilla.querySelectorAll('[data-dia]').forEach((b) => b.addEventListener('click', () => irA(Number(b.dataset.dia))));
    rejilla.onkeydown = (e) => {
      const pasos = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
      if (!pasos) return;
      e.preventDefault();
      const d = new Date(seleccionado);
      irA(new Date(d.getFullYear(), d.getMonth(), d.getDate() + pasos).getTime(), { enfocar: true });
    };
    if (enfocar) rejilla.querySelector('[aria-pressed="true"]')?.focus();
    pintarDia();
  }

  // Los eventos del día elegido, debajo del calendario.
  function pintarDia() {
    const caja = contenedor.querySelector('.calendario__dia');
    if (!caja) return;
    // Citas y recordatorios del día en una sola línea de tiempo.
    const suyos = [...delDia(seleccionado), ...recordatoriosDel(seleccionado).map((r) => ({ ...r, recordatorio: true, inicio: r.cuando, titulo: r.texto }))].sort(
      (a, b) => Number(Boolean(b.todoElDia)) - Number(Boolean(a.todoElDia)) || a.inicio - b.inicio,
    );
    const d = new Date(seleccionado);
    const titulo = mismoDia(seleccionado, Date.now())
      ? 'Hoy'
      : `${NOMBRES_SEMANA[(d.getDay() + 6) % 7]}, ${d.getDate()} de ${d.toLocaleDateString('es-ES', { month: 'long' })}`;
    caja.innerHTML = `<h3>${escapar(titulo)}</h3>${
      cargado === null ? cargando : suyos.length ? '<ul class="filas"></ul>' : '<p class="apartado__vacio">Nada este día.</p>'
    }`;
    const ul = caja.querySelector('ul');
    for (const e of suyos) {
      if (e.recordatorio) {
        const li = document.createElement('li');
        li.className = 'fila fila--evento fila--recordatorio';
        li.innerHTML = `<span class="fila__hora">${horaCorta(e.inicio)}</span><div class="fila__cuerpo"><span class="fila__titulo"></span><span class="fila__detalle">${icono('campana', 12)} recordatorio</span></div>`;
        li.querySelector('.fila__titulo').textContent = e.titulo;
        ul.append(li);
        continue;
      }
      const li = document.createElement('li');
      li.className = `fila fila--evento${e.todoElDia ? ' fila--todo-el-dia' : ''}`;
      const hora = e.todoElDia ? 'Todo el día' : `${horaCorta(e.inicio)}<small>${horaCorta(e.fin)}</small>`;
      li.innerHTML = `<span class="fila__hora">${hora}</span><div class="fila__cuerpo"><span class="fila__titulo"></span><span class="fila__detalle"></span></div>`;
      li.querySelector('.fila__titulo').textContent = e.titulo;
      li.querySelector('.fila__detalle').textContent = e.lugar;
      li.append(
        botonBorrar(`Borrar «${e.titulo}» del calendario`, async () => {
          await api.calendario.borrar(e.id);
          eventos = eventos.filter((x) => x.id !== e.id);
          pintarCalendario();
        }),
      );
      ul.append(li);
    }
    const pie = document.createElement('div');
    pie.className = 'apartado__pie';
    pie.innerHTML = `<button type="button" class="boton" data-preguntar>${icono('chispa', 15)} Pregúntale a Kitsune por tu semana</button>`;
    pie.querySelector('[data-preguntar]').addEventListener('click', () => preguntar('¿Qué tengo esta semana en el calendario?'));
    caja.append(pie);
  }

  // Deslizar el mes a los lados cambia de mes (las flechas hacen lo mismo).
  function prepararGestos(rejilla) {
    let inicio = null;
    rejilla.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse') inicio = { x: e.clientX, y: e.clientY };
    });
    rejilla.addEventListener('pointerup', (e) => {
      if (!inicio) return;
      const dx = e.clientX - inicio.x;
      const dy = e.clientY - inicio.y;
      inicio = null;
      if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5) cambiarMes(dx < 0 ? 1 : -1);
    });
    rejilla.addEventListener('pointercancel', () => (inicio = null));
  }

  return { mostrar };
}

// ---------- Recordatorios ----------

export function crearRecordatorios({ contenedor, api, web, alCambiar, alConfigurarAvisos }) {
  // Pestañas del apartado: recordatorios, automatizaciones y lo que ha hecho el servidor.
  let pestana = 'recordatorios';
  let panel = null;

  async function mostrar() {
    if (pestana !== 'recordatorios') return mostrarPestana(pestana);
    contenedor.innerHTML = `
      <div class="apartado desplazable">
        ${barraPestanas()}
        <div class="apartado__cabecera">
          <h2>Recordatorios</h2>
          <button type="button" class="boton boton--primario" id="rec-nuevo">${icono('nueva', 15)} Nuevo</button>
        </div>
        <form class="formulario" id="rec-formulario" hidden>
          <input class="campo" name="texto" placeholder="Qué te recuerdo (por ejemplo, llamar a Lucía)" maxlength="200" required aria-label="Qué te recuerdo">
          <div class="rapidos" role="group" aria-label="Atajos de hora">
            <button type="button" class="chip" data-rapido="hora">En 1 hora</button>
            <button type="button" class="chip" data-rapido="tarde">Esta tarde</button>
            <button type="button" class="chip" data-rapido="manana">Mañana a las 9</button>
          </div>
          <div class="formulario__fila">
            <input class="campo" type="date" name="fecha" required aria-label="Fecha">
            <input class="campo" type="time" name="hora" required aria-label="Hora">
          </div>
          <p class="apartado__mensaje" role="alert" hidden></p>
          <div class="formulario__botones">
            <button type="submit" class="boton boton--primario">Guardar</button>
            <button type="button" class="boton" data-cancelar>Cancelar</button>
          </div>
        </form>
        <ul class="filas" id="rec-lista">${cargando}</ul>
        <p class="ajuste__ayuda apartado__nota">También puedes pedírselos a Kitsune en el chat: «recuérdame llamar a Lucía mañana a las 10».${
          web ? ' Con los avisos en el móvil activados suenan aunque la app esté cerrada.' : ''
        }</p>
      </div>`;
    conectarPestanas();
    const formulario = contenedor.querySelector('#rec-formulario');
    const poner = (d) => {
      formulario.fecha.value = fechaCampo(d);
      formulario.hora.value = horaCampo(d);
    };
    contenedor.querySelector('#rec-nuevo').addEventListener('click', () => {
      formulario.reset();
      const d = new Date(Date.now() + 3_600_000);
      d.setSeconds(0, 0);
      poner(d);
      mensajeError(formulario, '');
      formulario.hidden = false;
      formulario.texto.focus();
    });
    formulario.querySelectorAll('[data-rapido]').forEach((b) =>
      b.addEventListener('click', () => {
        const d = new Date();
        if (b.dataset.rapido === 'hora') d.setTime(Date.now() + 3_600_000);
        else if (b.dataset.rapido === 'tarde') {
          d.setHours(18, 0, 0, 0);
          if (d < new Date()) d.setDate(d.getDate() + 1);
        } else {
          d.setDate(d.getDate() + 1);
          d.setHours(9, 0, 0, 0);
        }
        poner(d);
      }),
    );
    formulario.querySelector('[data-cancelar]').addEventListener('click', () => (formulario.hidden = true));
    formulario.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api.recordatorios.crear({ texto: formulario.texto.value.trim(), cuando: deCampos(formulario.fecha.value, formulario.hora.value) });
        formulario.hidden = true;
        await pintarLista();
      } catch (error) {
        mensajeError(formulario, error.message);
      }
    });
    await pintarLista();
  }

  function barraPestanas() {
    if (!api.servidor) return '';
    return `<div class="segmentado pestanas-avisos" role="tablist" aria-label="Avisos">
      ${[['recordatorios', 'Recordatorios'], ['automatizaciones', 'Automatizaciones'], ['actividad', 'Actividad']]
        .map(([v, n]) => `<button type="button" role="tab" data-pestana="${v}" aria-selected="${pestana === v}" aria-pressed="${pestana === v}">${n}</button>`)
        .join('')}
    </div>`;
  }

  function conectarPestanas() {
    contenedor.querySelectorAll('[data-pestana]').forEach((b) =>
      b.addEventListener('click', () => {
        if (b.dataset.pestana === pestana) return;
        pestana = b.dataset.pestana;
        mostrar();
      }),
    );
  }

  async function mostrarPestana(nombre) {
    contenedor.innerHTML = `<div class="apartado desplazable">${barraPestanas()}<div id="avisos-panel">${cargando}</div></div>`;
    conectarPestanas();
    const destino = contenedor.querySelector('#avisos-panel');
    const estado = await api.servidor.estado().catch(() => null);
    if (!estado?.vinculado) return sinServidor(destino, estado, alConfigurarAvisos);
    if (nombre === 'actividad') return mostrarActividad(destino, api);
    panel = crearPanelAutomatizaciones({ contenedor: destino, api });
    return panel.mostrar(estado);
  }

  async function pintarLista() {
    const lista = contenedor.querySelector('#rec-lista');
    if (!lista) return;
    const pendientes = await api.recordatorios.listar().catch(() => []);
    alCambiar?.();
    lista.innerHTML = pendientes.length ? '' : '<li class="apartado__vacio">No tienes recordatorios pendientes.</li>';
    for (const r of pendientes) {
      const li = document.createElement('li');
      li.className = 'fila';
      li.innerHTML = `<span class="fila__icono">${icono('campana', 16)}</span><div class="fila__cuerpo"><span class="fila__titulo"></span><span class="fila__detalle"></span></div>`;
      li.querySelector('.fila__titulo').textContent = r.texto;
      li.querySelector('.fila__detalle').textContent = cuandoLegible(r.cuando);
      li.classList.toggle('fila--hoy', inicioDelDia(r.cuando) === inicioDelDia(Date.now()));
      li.append(
        botonBorrar(`Borrar el recordatorio «${r.texto}»`, async () => {
          await api.recordatorios.borrar(r.id);
          await retirar(li);
          alCambiar?.();
          if (!lista.children.length) lista.innerHTML = '<li class="apartado__vacio">No tienes recordatorios pendientes.</li>';
        }),
      );
      lista.append(li);
    }
  }

  return {
    mostrar,
    // Desde el chat o una notificación: abrir directamente una pestaña.
    abrirPestana(nombre) {
      pestana = nombre;
      return mostrar();
    },
    recargarAutomatizaciones: () => pestana === 'automatizaciones' && panel?.recargar(),
  };
}

// ---------- Memoria ----------

export function crearMemoria({ contenedor, api, obtenerAjustes, guardarAjustes }) {
  async function mostrar() {
    const activa = obtenerAjustes().usarMemoria;
    contenedor.innerHTML = `
      <div class="apartado desplazable">
        <div class="apartado__cabecera"><h2>Memoria</h2></div>
        <div class="ajuste ajuste--fila">
          <div>
            <div class="ajuste__etiqueta" id="et-memoria">Usar la memoria</div>
            <p class="ajuste__ayuda">Kitsune tiene en cuenta lo que hay aquí en cada conversación. Si la apagas, ni la usa ni guarda nada nuevo.</p>
          </div>
          <button type="button" class="interruptor" role="switch" aria-labelledby="et-memoria" id="memoria-activa" aria-checked="${activa}"></button>
        </div>
        <form class="formulario formulario--linea" id="memoria-formulario">
          <input class="campo" name="dato" placeholder="Añadir algo que deba saber de ti" maxlength="300" required aria-label="Algo que Kitsune deba saber de ti">
          <button type="submit" class="boton boton--primario">Añadir</button>
        </form>
        <p class="apartado__mensaje" role="alert" hidden></p>
        <ul class="filas" id="memoria-lista">${cargando}</ul>
        <div class="apartado__pie"><button type="button" class="boton" id="memoria-todo" hidden>Olvidar todo</button></div>
        <p class="ajuste__ayuda apartado__nota">En el chat: «recuerda que mi hermana se llama Ana». Se guarda cifrada en este ${
          api.plataforma === 'web' ? 'navegador' : 'equipo'
        }.</p>
      </div>`;
    const interruptor = contenedor.querySelector('#memoria-activa');
    interruptor.addEventListener('click', async () => {
      const nuevo = interruptor.getAttribute('aria-checked') !== 'true';
      interruptor.setAttribute('aria-checked', String(nuevo));
      await guardarAjustes({ usarMemoria: nuevo });
    });
    const formulario = contenedor.querySelector('#memoria-formulario');
    formulario.addEventListener('submit', async (e) => {
      e.preventDefault();
      try {
        await api.memoria.recordar(formulario.dato.value);
        formulario.reset();
        mensajeError(contenedor, '');
        await pintarLista();
      } catch (error) {
        mensajeError(contenedor, error.message);
      }
    });
    const todo = contenedor.querySelector('#memoria-todo');
    todo.addEventListener('click', async () => {
      if (todo.dataset.confirmar !== 'si') {
        todo.dataset.confirmar = 'si';
        todo.textContent = '¿Seguro? Pulsa otra vez para olvidarlo todo';
        return;
      }
      await api.memoria.olvidarTodo();
      todo.dataset.confirmar = '';
      todo.textContent = 'Olvidar todo';
      pintarLista();
    });
    await pintarLista();
  }

  async function pintarLista() {
    const lista = contenedor.querySelector('#memoria-lista');
    if (!lista) return;
    const datos = await api.memoria.listar().catch(() => []);
    contenedor.querySelector('#memoria-todo').hidden = datos.length === 0;
    lista.innerHTML = datos.length ? '' : '<li class="apartado__vacio">Todavía no recuerda nada de ti.</li>';
    for (const d of [...datos].reverse()) {
      const li = document.createElement('li');
      li.className = 'fila';
      li.innerHTML = `<span class="fila__icono">${icono('memoria', 16)}</span><div class="fila__cuerpo"><span class="fila__titulo"></span><span class="fila__detalle"></span></div>`;
      li.querySelector('.fila__titulo').textContent = d.texto;
      li.querySelector('.fila__detalle').textContent = d.creado ? `Desde ${haceCuanto(d.creado)}` : '';
      li.append(
        botonBorrar(`Olvidar «${d.texto}»`, async () => {
          await api.memoria.olvidar(d.id);
          pintarLista();
        }),
      );
      lista.append(li);
    }
  }

  return { mostrar };
}

// ---------- Historial de conversaciones ----------

export function crearHistorial({ contenedor, api, alAbrir, alNueva }) {
  let filtro = '';

  async function mostrar() {
    contenedor.innerHTML = `
      <div class="apartado desplazable">
        <div class="apartado__cabecera">
          <h2>Historial</h2>
          <button type="button" class="boton boton--primario" id="historial-nueva">${icono('nueva', 15)} Nueva</button>
        </div>
        <label class="buscador">${icono('buscar', 16)}<input type="search" id="historial-buscar" placeholder="Buscar en tus conversaciones" aria-label="Buscar en tus conversaciones"></label>
        <p class="apartado__mensaje" role="alert" hidden></p>
        <ul class="filas" id="historial-lista">${cargando}</ul>
        <div class="apartado__pie"><button type="button" class="boton" id="historial-todo" hidden>Borrar todo el historial</button></div>
        <p class="ajuste__ayuda apartado__nota">Se guardan las últimas 50 conversaciones, cifradas en este ${api.plataforma === 'web' ? 'navegador' : 'equipo'}.</p>
      </div>`;
    const buscar = contenedor.querySelector('#historial-buscar');
    buscar.value = filtro;
    buscar.addEventListener('input', () => {
      filtro = buscar.value;
      pintarLista();
    });
    contenedor.querySelector('#historial-nueva').addEventListener('click', alNueva);
    const todo = contenedor.querySelector('#historial-todo');
    todo.addEventListener('click', async () => {
      if (todo.dataset.confirmar !== 'si') {
        todo.dataset.confirmar = 'si';
        todo.textContent = '¿Seguro? Pulsa otra vez para borrarlo todo';
        return;
      }
      await api.conversaciones.borrarTodo();
      todo.dataset.confirmar = '';
      todo.textContent = 'Borrar todo el historial';
      alNueva({ irAlChat: false });
      pintarLista();
    });
    await pintarLista();
  }

  async function pintarLista() {
    const lista = contenedor.querySelector('#historial-lista');
    if (!lista) return;
    const { lista: conversaciones, actual } = await api.conversaciones.listar().catch(() => ({ lista: [], actual: null }));
    contenedor.querySelector('#historial-todo').hidden = conversaciones.length === 0;
    const q = filtro.trim().toLowerCase();
    const visibles = q ? conversaciones.filter((c) => `${c.titulo} ${c.resumen}`.toLowerCase().includes(q)) : conversaciones;
    lista.innerHTML = visibles.length
      ? ''
      : `<li class="apartado__vacio">${q ? 'Ninguna conversación coincide con la búsqueda.' : 'Aún no hay conversaciones guardadas.'}</li>`;
    for (const c of visibles) {
      const li = document.createElement('li');
      li.className = 'fila fila--conversacion';
      li.innerHTML = `
        <button type="button" class="fila__abrir">
          <span class="fila__titulo"></span>
          <span class="fila__resumen"></span>
          <span class="fila__detalle"></span>
        </button>`;
      li.querySelector('.fila__titulo').textContent = c.titulo;
      li.querySelector('.fila__resumen').textContent = c.resumen;
      li.querySelector('.fila__detalle').textContent = `${haceCuanto(c.actualizada)} · ${c.mensajes} mensajes${c.id === actual ? ' · en curso' : ''}`;
      li.classList.toggle('fila--actual', c.id === actual);
      li.querySelector('.fila__abrir').addEventListener('click', async () => {
        try {
          alAbrir(await api.conversaciones.abrir(c.id));
        } catch (e) {
          mensajeError(contenedor, e.message);
        }
      });
      li.append(
        botonBorrar(`Borrar la conversación «${c.titulo}»`, async () => {
          await api.conversaciones.borrar(c.id);
          if (c.id === actual) alNueva({ irAlChat: false });
          pintarLista();
        }),
      );
      lista.append(li);
    }
  }

  return { mostrar };
}
