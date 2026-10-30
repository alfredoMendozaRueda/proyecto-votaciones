import { icono } from './iconos.js';
import { cuandoLegible, haceCuanto, nombreDelDia } from './fechas.js';

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

const cargando = '<p class="apartado__cargando"><span class="puntos" aria-hidden="true"><i></i><i></i><i></i></span>Cargando…</p>';

// Borrar pide un segundo toque: el primero convierte el icono en "¿Borrar?".
function botonBorrar(etiqueta, accion) {
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

// Agrupa por día: "Hoy", "Mañana", "Jueves 6 de noviembre".
function agruparPorDia(elementos, fecha) {
  const grupos = new Map();
  for (const el of elementos) {
    const clave = inicioDelDia(fecha(el));
    if (!grupos.has(clave)) grupos.set(clave, []);
    grupos.get(clave).push(el);
  }
  return [...grupos].map(([dia, lista]) => ({ titulo: nombreDelDia(dia), lista }));
}

function mensajeError(contenedor, texto) {
  const p = contenedor.querySelector('.apartado__mensaje');
  if (!p) return;
  p.textContent = texto;
  p.hidden = !texto;
}

// ---------- Agenda ----------

export function crearAgenda({ contenedor, api, abrirAjustes, preguntar }) {
  let dias = 14;

  async function mostrar() {
    contenedor.innerHTML = `
      <div class="apartado desplazable">
        <div class="apartado__cabecera">
          <h2>Agenda</h2>
          <button type="button" class="icono-boton" id="agenda-actualizar" aria-label="Actualizar" title="Actualizar">${icono('actualizar')}</button>
          <button type="button" class="boton boton--primario" id="agenda-nuevo" hidden>${icono('nueva', 15)} Nuevo</button>
        </div>
        <form class="formulario" id="agenda-formulario" hidden>
          <input class="campo" name="titulo" placeholder="Qué (por ejemplo, Dentista)" maxlength="200" required aria-label="Título del evento">
          <div class="formulario__fila">
            <input class="campo" type="date" name="fecha" required aria-label="Fecha">
            <label class="casilla"><input type="checkbox" name="todoElDia"> Todo el día</label>
          </div>
          <div class="formulario__fila" data-horas>
            <label class="formulario__hora">De <input class="campo" type="time" name="inicio" required aria-label="Hora de inicio"></label>
            <label class="formulario__hora">a <input class="campo" type="time" name="fin" required aria-label="Hora de fin"></label>
          </div>
          <input class="campo" name="lugar" placeholder="Dónde (opcional)" maxlength="200" aria-label="Lugar">
          <p class="apartado__mensaje" role="alert" hidden></p>
          <div class="formulario__botones">
            <button type="submit" class="boton boton--primario">Guardar en el calendario</button>
            <button type="button" class="boton" data-cancelar>Cancelar</button>
          </div>
        </form>
        <div id="agenda-lista">${cargando}</div>
      </div>`;
    contenedor.querySelector('#agenda-actualizar').addEventListener('click', pintarLista);
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
    await pintarLista();
  }

  function abrirFormulario(formulario) {
    formulario.reset();
    const ahora = new Date();
    ahora.setHours(ahora.getHours() + 1, 0, 0, 0);
    formulario.fecha.value = fechaCampo(ahora);
    formulario.inicio.value = horaCampo(ahora);
    formulario.fin.value = `${dos(Math.min(ahora.getHours() + 1, 23))}:00`;
    formulario.querySelector('[data-horas]').hidden = false;
    mensajeError(formulario, '');
    formulario.hidden = false;
    formulario.titulo.focus();
  }

  async function guardarEvento(formulario) {
    const todoElDia = formulario.todoElDia.checked;
    const inicio = deCampos(formulario.fecha.value, todoElDia ? '00:00' : formulario.inicio.value);
    const fin = todoElDia ? inicio + DIA : deCampos(formulario.fecha.value, formulario.fin.value);
    if (!Number.isFinite(inicio) || !Number.isFinite(fin) || fin <= inicio) {
      mensajeError(formulario, 'La hora de fin tiene que ser posterior a la de inicio.');
      return;
    }
    const boton = formulario.querySelector('[type=submit]');
    boton.disabled = true;
    try {
      await api.calendario.crear({ titulo: formulario.titulo.value.trim(), inicio, fin, todoElDia, lugar: formulario.lugar.value.trim() });
      formulario.hidden = true;
      await pintarLista();
    } catch (e) {
      mensajeError(formulario, e.message);
    } finally {
      boton.disabled = false;
    }
  }

  async function pintarLista() {
    const lista = contenedor.querySelector('#agenda-lista');
    if (!lista) return;
    const estado = await api.calendario.estado().catch(() => ({ conectado: false }));
    contenedor.querySelector('#agenda-nuevo').hidden = !(estado.calendario && !estado.necesitaReconectar);
    if (!estado.conectado || !estado.calendario || estado.necesitaReconectar) {
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
        pintarLista();
      });
      return;
    }
    lista.innerHTML = cargando;
    const desde = inicioDelDia(Date.now());
    let eventos;
    try {
      eventos = await api.calendario.eventos(desde, desde + dias * DIA);
    } catch (e) {
      lista.innerHTML = `<p class="apartado__vacio">${escapar(e.message)}</p>`;
      return;
    }
    // Lo que ya terminó hoy no hace falta verlo.
    eventos = eventos.filter((e) => e.fin > Date.now() || e.todoElDia);
    lista.innerHTML = '';
    if (!eventos.length) {
      lista.innerHTML = `<p class="apartado__vacio">No tienes nada en los próximos ${dias} días.</p>`;
    }
    for (const grupo of agruparPorDia(eventos, (e) => Math.max(e.inicio, desde))) {
      const seccion = document.createElement('section');
      seccion.className = 'apartado__grupo';
      seccion.innerHTML = `<h3>${escapar(grupo.titulo)}</h3><ul class="filas"></ul>`;
      for (const e of grupo.lista) {
        const li = document.createElement('li');
        li.className = 'fila';
        const hora = e.todoElDia ? 'Todo el día' : new Date(e.inicio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        li.innerHTML = `<span class="fila__hora">${hora}</span><div class="fila__cuerpo"><span class="fila__titulo"></span><span class="fila__detalle"></span></div>`;
        li.querySelector('.fila__titulo').textContent = e.titulo;
        li.querySelector('.fila__detalle').textContent = e.lugar;
        li.append(
          botonBorrar(`Borrar «${e.titulo}» del calendario`, async () => {
            await api.calendario.borrar(e.id);
            li.remove();
          }),
        );
        seccion.querySelector('ul').append(li);
      }
      lista.append(seccion);
    }
    const pie = document.createElement('div');
    pie.className = 'apartado__pie';
    pie.innerHTML = `<button type="button" class="boton" data-mas>Ver más días</button>
      <button type="button" class="boton" data-preguntar>${icono('chispa', 15)} Pregúntale a Kitsune por tu semana</button>`;
    pie.querySelector('[data-mas]').addEventListener('click', () => {
      dias += 14;
      pintarLista();
    });
    pie.querySelector('[data-preguntar]').addEventListener('click', () => preguntar('¿Qué tengo esta semana en el calendario?'));
    lista.append(pie);
  }

  return { mostrar };
}

// ---------- Recordatorios ----------

export function crearRecordatorios({ contenedor, api, web, alCambiar }) {
  async function mostrar() {
    contenedor.innerHTML = `
      <div class="apartado desplazable">
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
          web ? ' En el móvil suenan con la app abierta o en segundo plano; si estaba cerrada, te avisa al abrirla.' : ''
        }</p>
      </div>`;
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
          li.remove();
          alCambiar?.();
          if (!lista.children.length) lista.innerHTML = '<li class="apartado__vacio">No tienes recordatorios pendientes.</li>';
        }),
      );
      lista.append(li);
    }
  }

  return { mostrar };
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
