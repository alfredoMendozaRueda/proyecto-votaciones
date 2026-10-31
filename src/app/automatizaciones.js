import { icono } from './iconos.js';
import { retirar } from './animaciones.js';
import { haceCuanto } from './fechas.js';
import { botonBorrar, cargando } from './vistas.js';
import { PLANTILLAS, describirCuando, describirHacer, normalizarAutomatizacion } from '../compartido/automatizaciones.js';

// Pestañas «Automatizaciones» y «Actividad» del apartado Avisos. Las
// automatizaciones viven en el servidor de avisos; aquí se crean, se
// encienden y apagan, se editan y se borran.

const escapar = (t = '') => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const NOMBRES_DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const ICONO_TIPO = { correo: 'sobre', cita: 'calendario', horario: 'campana' };
const MINUTOS_CITA = [5, 10, 15, 30, 60, 120, 1440];
const MAS_TARDE = [
  [0, 'No'],
  [60, 'En 1 hora'],
  [180, 'En 3 horas'],
  [1440, 'Mañana'],
  [2880, 'En 2 días'],
];

// Aviso de que hace falta el servidor de avisos vinculado.
export function sinServidor(contenedor, estado, alConfigurar) {
  contenedor.innerHTML = `
    <div class="tarjeta-aviso">
      <span class="tarjeta-aviso__icono">${icono('chispa', 20)}</span>
      <div>
        <strong>Kitsune trabajando aunque esté cerrado</strong>
        <p>Las automatizaciones (y los avisos en el móvil) las hace el servidor de avisos: «cuando llegue una reserva, ponla en mi agenda», «avísame media hora antes de cada cita», «el resumen del día a las 8»…</p>
        <button type="button" class="boton boton--primario">${estado?.configurado ? 'Conectar los avisos' : 'Cómo activarlo'}</button>
      </div>
    </div>`;
  contenedor.querySelector('button').addEventListener('click', alConfigurar);
}

export function crearPanelAutomatizaciones({ contenedor, api }) {
  let lista = [];
  let estado = null;

  async function mostrar(estadoServidor) {
    estado = estadoServidor;
    contenedor.innerHTML = `
      <div class="apartado__cabecera apartado__cabecera--sub">
        <h3>Automatizaciones</h3>
        <button type="button" class="boton boton--primario" id="auto-nueva">${icono('nueva', 15)} Nueva</button>
      </div>
      <div class="plantillas" role="list" aria-label="Plantillas">
        ${PLANTILLAS.map((p) => `<button type="button" class="plantilla" role="listitem" data-plantilla="${p.id}"><strong>${escapar(p.titulo)}</strong><span>${escapar(p.detalle)}</span></button>`).join('')}
      </div>
      <form class="formulario editor-auto" id="auto-editor" hidden></form>
      <ul class="filas" id="auto-lista">${cargando}</ul>
      <p class="ajuste__ayuda apartado__nota">También puedes pedírselas a Kitsune en el chat: «avísame cada vez que me escriba Lucía».</p>`;
    contenedor.querySelector('#auto-nueva').addEventListener('click', () => editar(null));
    contenedor.querySelectorAll('[data-plantilla]').forEach((b) =>
      b.addEventListener('click', () => editar({ ...PLANTILLAS.find((p) => p.id === b.dataset.plantilla).automatizacion, nueva: true })),
    );
    await pintar();
  }

  async function pintar() {
    const ul = contenedor.querySelector('#auto-lista');
    if (!ul) return;
    try {
      lista = await api.servidor.automatizaciones.listar();
    } catch (error) {
      ul.innerHTML = `<li class="apartado__vacio">${escapar(error.message)}</li>`;
      return;
    }
    ul.innerHTML = lista.length ? '' : '<li class="apartado__vacio">Aún no tienes automatizaciones. Empieza con una plantilla.</li>';
    for (const a of lista) ul.append(fila(a));
  }

  function fila(a) {
    const li = document.createElement('li');
    li.className = `fila fila--auto${a.activa ? '' : ' fila--apagada'}`;
    li.innerHTML = `
      <span class="fila__icono">${icono(ICONO_TIPO[a.cuando.tipo], 16)}</span>
      <button type="button" class="fila__cuerpo fila__boton"><span class="fila__titulo"></span><span class="fila__detalle"></span></button>
      <button type="button" class="interruptor interruptor--pequeno" role="switch" aria-checked="${a.activa}"></button>`;
    li.querySelector('.fila__titulo').textContent = a.nombre;
    li.querySelector('.fila__detalle').textContent = `${describirCuando(a.cuando)}: ${describirHacer(a.hacer, a.cuando.tipo)}`;
    li.querySelector('.fila__boton').addEventListener('click', () => editar(a));
    const interruptor = li.querySelector('.interruptor');
    interruptor.setAttribute('aria-label', `${a.nombre}: ${a.activa ? 'activa' : 'apagada'}`);
    interruptor.addEventListener('click', async () => {
      interruptor.disabled = true;
      try {
        const nueva = await api.servidor.automatizaciones.actualizar(a.id, { ...a, activa: !a.activa });
        Object.assign(a, nueva);
        interruptor.setAttribute('aria-checked', String(a.activa));
        li.classList.toggle('fila--apagada', !a.activa);
      } finally {
        interruptor.disabled = false;
      }
    });
    li.append(
      botonBorrar(`Borrar la automatización «${a.nombre}»`, async () => {
        await api.servidor.automatizaciones.borrar(a.id);
        await retirar(li);
        lista = lista.filter((x) => x !== a);
        if (!lista.length) await pintar();
      }),
    );
    return li;
  }

  // Editor: el mismo para crear (a = null o una plantilla) y para cambiar una existente.
  function editar(a) {
    const existente = a && !a.nueva ? a : null;
    const base = a ?? { cuando: { tipo: 'correo' }, hacer: { notificar: true } };
    const form = contenedor.querySelector('#auto-editor');
    let tipo = base.cuando.tipo;
    const c = base.cuando;
    const h = base.hacer;
    form.innerHTML = `
      <h4 class="editor-auto__titulo">${existente ? 'Editar automatización' : 'Nueva automatización'}</h4>
      <input class="campo" name="nombre" maxlength="80" placeholder="Nombre (opcional)" aria-label="Nombre" value="${escapar(base.nombre ?? '')}">
      <span class="editor-auto__etiqueta">Cuándo</span>
      <div class="segmentado" role="group" aria-label="Cuándo">
        ${[['correo', 'Llega un correo'], ['cita', 'Antes de una cita'], ['horario', 'A una hora']]
          .map(([v, n]) => `<button type="button" data-tipo="${v}" aria-pressed="${tipo === v}">${n}</button>`)
          .join('')}
      </div>
      <div class="editor-auto__grupo" data-de="correo">
        <input class="campo" name="de" maxlength="200" placeholder="De (nombre o correo; varios separados por comas)" aria-label="De quién" value="${escapar(c.de ?? '')}">
        <input class="campo" name="asunto" maxlength="200" placeholder="Palabras del asunto" aria-label="Palabras del asunto" value="${escapar(c.asunto ?? '')}">
        <input class="campo" name="contiene" maxlength="200" placeholder="Palabras del asunto o del texto" aria-label="Palabras del texto" value="${escapar(c.contiene ?? '')}">
      </div>
      <div class="editor-auto__grupo" data-de="cita">
        <select class="campo" name="minutos" aria-label="Cuánto antes">
          ${MINUTOS_CITA.map((m) => `<option value="${m}" ${(c.minutos ?? 30) === m ? 'selected' : ''}>${m < 60 ? `${m} min antes` : m === 1440 ? 'Un día antes' : `${m / 60} ${m === 60 ? 'hora' : 'horas'} antes`}</option>`).join('')}
        </select>
        <input class="campo" name="titulo" maxlength="200" placeholder="Solo citas cuyo título lleve… (opcional)" aria-label="Título de la cita" value="${escapar(c.titulo ?? '')}">
      </div>
      <div class="editor-auto__grupo" data-de="horario">
        <input class="campo" type="time" name="hora" aria-label="Hora" value="${escapar(c.hora ?? '08:00')}">
        <div class="dias" role="group" aria-label="Días">
          ${DIAS.map((d, i) => `<button type="button" class="dia" data-dia="${i + 1}" aria-label="${NOMBRES_DIAS[i]}" aria-pressed="${(c.dias ?? [1, 2, 3, 4, 5]).includes(i + 1)}">${d}</button>`).join('')}
        </div>
      </div>
      <span class="editor-auto__etiqueta">Qué hago</span>
      <label class="casilla"><input type="checkbox" name="notificar" ${h.notificar !== false ? 'checked' : ''}> Avisarte con una notificación</label>
      <input class="campo" name="texto" maxlength="200" placeholder="Texto del aviso (opcional)" aria-label="Texto del aviso" value="${escapar(h.texto ?? '')}">
      <div data-de="correo" class="editor-auto__grupo">
        <label class="casilla"><input type="checkbox" name="evento" ${h.evento ? 'checked' : ''}> Añadir el evento a tu agenda (con la IA)</label>
        <p class="ajuste__ayuda editor-auto__nota" data-nota-groq ${estado?.groq ? 'hidden' : ''}>Necesita «Usar mi clave de Groq en el servidor» en Ajustes → Avisos en el móvil.</p>
        <label class="casilla casilla--select">Recordártelo
          <select class="campo" name="recordatorio" aria-label="Recordártelo">
            ${MAS_TARDE.map(([m, n]) => `<option value="${m}" ${(h.recordatorio ?? 0) === m ? 'selected' : ''}>${n}</option>`).join('')}
          </select>
        </label>
        <label class="casilla"><input type="checkbox" name="leido" ${h.leido ? 'checked' : ''}> Marcarlo como leído</label>
        <label class="casilla"><input type="checkbox" name="archivar" ${h.archivar ? 'checked' : ''}> Archivarlo</label>
      </div>
      <div data-de="horario" class="editor-auto__grupo">
        <label class="casilla"><input type="checkbox" name="resumen" ${h.resumen ? 'checked' : ''}> Mandarte el resumen del día (citas, correos y recordatorios)</label>
      </div>
      <p class="apartado__mensaje" role="alert" hidden></p>
      <div class="formulario__botones">
        <button type="submit" class="boton boton--primario">${existente ? 'Guardar' : 'Crear'}</button>
        <button type="button" class="boton" data-cancelar>Cancelar</button>
      </div>`;
    const ajustarTipo = () => {
      form.querySelectorAll('[data-de]').forEach((g) => (g.hidden = g.dataset.de !== tipo));
      form.querySelectorAll('[data-tipo]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tipo === tipo)));
    };
    form.querySelectorAll('[data-tipo]').forEach((b) =>
      b.addEventListener('click', () => {
        tipo = b.dataset.tipo;
        ajustarTipo();
      }),
    );
    form.querySelectorAll('.dia').forEach((b) => b.addEventListener('click', () => b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'))));
    form.querySelector('[data-cancelar]').addEventListener('click', () => (form.hidden = true));
    const mensaje = form.querySelector('.apartado__mensaje');
    form.onsubmit = async (e) => {
      e.preventDefault();
      const f = form.elements;
      const cuando =
        tipo === 'correo'
          ? { tipo, de: f.de.value, asunto: f.asunto.value, contiene: f.contiene.value }
          : tipo === 'cita'
            ? { tipo, minutos: Number(f.minutos.value), titulo: f.titulo.value }
            : { tipo, hora: f.hora.value, dias: [...form.querySelectorAll('.dia[aria-pressed="true"]')].map((b) => Number(b.dataset.dia)) };
      const datos = {
        nombre: f.nombre.value,
        activa: existente?.activa ?? true,
        cuando,
        hacer: {
          notificar: f.notificar.checked,
          texto: f.texto.value,
          evento: f.evento.checked,
          recordatorio: Number(f.recordatorio.value),
          leido: f.leido.checked,
          archivar: f.archivar.checked,
          resumen: f.resumen.checked,
        },
      };
      try {
        // Se valida aquí también para avisar sin esperar al servidor.
        normalizarAutomatizacion(datos);
        if (existente) await api.servidor.automatizaciones.actualizar(existente.id, datos);
        else await api.servidor.automatizaciones.crear(datos);
        form.hidden = true;
        await pintar();
      } catch (error) {
        mensaje.textContent = error.message;
        mensaje.hidden = false;
      }
    };
    ajustarTipo();
    form.hidden = false;
    form.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    form.elements.nombre.focus({ preventScroll: true });
  }

  return { mostrar, recargar: pintar };
}

// Lo que ha hecho el servidor: avisos, automatizaciones, errores.
export async function mostrarActividad(contenedor, api) {
  contenedor.innerHTML = `<div class="apartado__cabecera apartado__cabecera--sub"><h3>Actividad</h3></div><ul class="filas" id="actividad">${cargando}</ul>`;
  const ul = contenedor.querySelector('#actividad');
  try {
    const registro = await api.servidor.registro();
    ul.innerHTML = registro.length ? '' : '<li class="apartado__vacio">Aquí verás lo que Kitsune hace por su cuenta.</li>';
    for (const r of registro) {
      const li = document.createElement('li');
      li.className = `fila fila--actividad${r.tipo === 'error' ? ' fila--error' : ''}`;
      li.innerHTML = `<span class="fila__icono">${icono(r.tipo === 'error' ? 'alerta' : r.tipo === 'automatizacion' ? 'chispa' : 'campana', 16)}</span><div class="fila__cuerpo"><span class="fila__titulo"></span><span class="fila__detalle"></span></div>`;
      li.querySelector('.fila__titulo').textContent = r.texto;
      li.querySelector('.fila__detalle').textContent = haceCuanto(r.cuando);
      ul.append(li);
    }
  } catch (error) {
    ul.innerHTML = `<li class="apartado__vacio">${escapar(error.message)}</li>`;
  }
}
