import { icono } from './iconos.js';
import { PALETAS } from '../kitsune/paletas.js';
import { cuandoLegible } from './fechas.js';

const escapar = (t = '') => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MODELOS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 · el más capaz'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 · más rápido'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 · el más económico'],
];

const NOMBRES_TECLA = { Control: 'Ctrl', Super: 'Win', Space: 'Espacio' };

const teclasDe = (atajo) => atajo.split('+').map((t) => `<kbd>${escapar(NOMBRES_TECLA[t] ?? t)}</kbd>`).join('');

// Convierte una pulsación en un atajo de Electron ("Control+Alt+K").
function atajoDesdeEvento(e) {
  const tecla =
    /^[a-z0-9]$/i.test(e.key) ? e.key.toUpperCase() : /^F([1-9]|1[0-2])$/.test(e.key) ? e.key : e.code === 'Space' ? 'Space' : null;
  if (!tecla) return null;
  const partes = [e.ctrlKey && 'Control', e.altKey && 'Alt', e.shiftKey && 'Shift', e.metaKey && 'Super'].filter(Boolean);
  if (!partes.some((p) => p === 'Control' || p === 'Alt' || p === 'Super')) return null;
  return [...partes, tecla].join('+');
}

export function crearAjustes({ contenedor, api, alCambiar, alCerrar }) {
  let ajustes = null;

  const segmentado = (clave, opciones) => `
    <div class="segmentado" role="group">
      ${opciones.map(([valor, nombre]) => `<button type="button" data-clave="${clave}" data-valor="${valor}" aria-pressed="${ajustes[clave] === valor}">${nombre}</button>`).join('')}
    </div>`;

  const interruptor = (clave, etiqueta, ayuda = '') => `
    <div class="ajuste ajuste--fila">
      <div>
        <div class="ajuste__etiqueta" id="et-${clave}">${etiqueta}</div>
        ${ayuda ? `<p class="ajuste__ayuda">${ayuda}</p>` : ''}
      </div>
      <button type="button" class="interruptor" role="switch" aria-labelledby="et-${clave}" data-interruptor="${clave}" aria-checked="${ajustes[clave]}"></button>
    </div>`;

  const selector = (clave, id, opciones) => `
    <select class="campo" id="${id}" data-selector="${clave}">
      ${opciones.map(([valor, nombre]) => `<option value="${valor}" ${String(ajustes[clave]) === String(valor) ? 'selected' : ''}>${nombre}</option>`).join('')}
    </select>`;

  async function guardar(cambios, mensaje = null) {
    try {
      ajustes = await api.ajustes.guardar(cambios);
      alCambiar(ajustes, cambios);
      if (mensaje) mostrarMensaje(mensaje.donde, mensaje.texto, true);
      return true;
    } catch (e) {
      if (mensaje) mostrarMensaje(mensaje.donde, e.message, false);
      return false;
    }
  }

  function mostrarMensaje(id, texto, ok) {
    const el = contenedor.querySelector(`#${id}`);
    if (!el) return;
    el.textContent = texto;
    el.classList.toggle('ok', ok);
  }

  async function pintar(seccion = null) {
    ajustes = await api.ajustes.obtener();
    // La versión web no tiene ventana propia, atajo global ni inicio con Windows.
    const escritorio = api.plataforma !== 'web';
    const tactil = matchMedia('(pointer: coarse)').matches;
    const dondeSeGuarda = escritorio ? 'en este equipo' : 'en este navegador';
    const [estadoClaude, estadoCorreo] = await Promise.all([api.claude.estado(), api.correo.estado()]);

    contenedor.innerHTML = `
      <div class="ajustes desplazable">
        <div class="ajustes__titulo">
          <button type="button" class="icono-boton" id="ajustes-volver" aria-label="Cerrar ajustes" title="Volver">${icono('volver')}</button>
          <h2>Ajustes</h2>
        </div>

        <section class="grupo" id="seccion-kitsune" aria-label="Kitsune">
          <h3>Kitsune</h3>
          <div class="ajuste">
            <span class="ajuste__etiqueta">Pelaje</span>
            <div class="pelajes" role="group" aria-label="Pelaje">
              ${Object.entries(PALETAS)
                .map(
                  ([clave, p]) => `
                <button type="button" data-clave="paleta" data-valor="${clave}" aria-pressed="${ajustes.paleta === clave}">
                  <span class="muestra" aria-hidden="true"><i style="background:${p.flanco}"></i><i style="background:${p.medias}"></i><i style="background:${p.marca}"></i></span>${p.nombre}
                </button>`,
                )
                .join('')}
            </div>
          </div>
          ${
            escritorio
              ? `<div class="ajuste solo-escritorio"><span class="ajuste__etiqueta">Tamaño</span>${segmentado('tamano', [['pequeno', 'Pequeño'], ['mediano', 'Mediano'], ['grande', 'Grande']])}</div>
          <div class="ajuste solo-escritorio"><span class="ajuste__etiqueta">Posición</span>${segmentado('posicion', [['izquierda', 'Abajo a la izquierda'], ['derecha', 'Abajo a la derecha']])}</div>`
              : ''
          }
          <div class="ajuste">
            <span class="ajuste__etiqueta">Calidad gráfica</span>
            ${segmentado('calidadPelo', [['auto', 'Automática'], ['alta', 'Alta'], ['media', 'Media'], ['baja', 'Baja']])}
            <p class="ajuste__ayuda">En automática se ajusta sola para ir fluida. Bájala para ahorrar batería.</p>
          </div>
          ${interruptor('fuegos', 'Fuegos fatuos alrededor')}
          ${tactil ? '' : interruptor('seguirCursor', 'Seguir el cursor con la mirada')}
        </section>

        <section class="grupo" id="seccion-comportamiento" aria-label="Comportamiento">
          <h3>Comportamiento</h3>
          ${
            escritorio
              ? `<div class="ajuste ajuste--fila solo-escritorio">
            <div>
              <div class="ajuste__etiqueta">Atajo para mostrar u ocultar</div>
              <p class="ajuste__ayuda" id="atajo-ayuda">Funciona aunque estés en otra aplicación.</p>
            </div>
            <div class="atajo" id="atajo"><span id="atajo-teclas">${teclasDe(ajustes.atajo)}</span><button type="button" class="boton" id="atajo-cambiar">Cambiar</button></div>
          </div>
          <p class="mensaje-ajuste solo-escritorio" id="mensaje-atajo" role="status"></p>
          <div class="solo-escritorio">${interruptor('iniciarConWindows', 'Abrir al iniciar Windows')}</div>
          <div class="solo-escritorio">${interruptor(
            'ofrecerPortapapeles',
            'Ofrecer acciones con el texto copiado',
            'Copia un texto, llama a Kitsune con el atajo y te propone resumirlo, traducirlo, mejorarlo o explicarlo.',
          )}</div>`
              : ''
          }
          <div class="ajuste ajuste--fila">
            <label class="ajuste__etiqueta" for="ajuste-dormir">Dormirse sin actividad</label>
            <div style="width:150px">${selector('dormirTrasMin', 'ajuste-dormir', [[0, 'Nunca'], [2, 'A los 2 min'], [5, 'A los 5 min'], [10, 'A los 10 min'], [30, 'A los 30 min']])}</div>
          </div>
          ${interruptor('voz', 'Leer las respuestas en voz alta', escritorio ? 'Usa las voces en español de Windows.' : 'Usa las voces en español del dispositivo.')}
          ${interruptor('pulsoDiario', 'Pulso del día', 'La primera vez que abres Kitsune cada día te ofrece un resumen de correo y recordatorios.')}
        </section>

        <section class="grupo" id="seccion-recordatorios" aria-label="Recordatorios">
          <h3>Recordatorios</h3>
          <ul class="recordatorios" id="lista-recordatorios" aria-live="polite"></ul>
          <p class="ajuste__ayuda">Pídeselos a Kitsune en el chat: «recuérdame llamar a Lucía mañana a las 10».${
            escritorio ? '' : ' En el móvil suenan con la app abierta o en segundo plano; si estaba cerrada, te avisa al abrirla.'
          }</p>
        </section>

        <section class="grupo" id="seccion-memoria" aria-label="Memoria">
          <h3>Memoria</h3>
          ${interruptor('usarMemoria', 'Usar la memoria', 'Kitsune recuerda lo que le cuentes («recuerda que mi hermana se llama Ana») y lo tiene en cuenta. Si la apagas, ni la usa ni guarda nada nuevo.')}
          <ul class="recordatorios" id="lista-memoria" aria-live="polite"></ul>
          <div><button type="button" class="boton" id="olvidar-todo" hidden>Olvidar todo</button></div>
        </section>

        <section class="grupo" id="seccion-claude" aria-label="Claude">
          <h3>Claude</h3>
          <div class="estado-cuenta ${estadoClaude.configurado ? 'ok' : ''}"><span class="punto"></span>${
            estadoClaude.configurado ? `Clave guardada y cifrada ${dondeSeGuarda}` : 'Sin clave: añádela para poder chatear'
          }</div>
          <div class="ajuste">
            <label class="ajuste__etiqueta" for="clave-claude">${estadoClaude.configurado ? 'Cambiar la clave de API' : 'Clave de API'}</label>
            <div style="display:flex;gap:6px">
              <input class="campo" id="clave-claude" type="password" placeholder="sk-ant-…" autocomplete="off" spellcheck="false">
              <button type="button" class="boton boton--primario" id="guardar-clave">Guardar</button>
            </div>
            <p class="ajuste__ayuda">Créala en console.anthropic.com, en API Keys.${estadoClaude.configurado ? ' <button type="button" class="boton" id="quitar-clave" style="margin-left:6px;padding:2px 10px">Quitar clave</button>' : ''}</p>
            <p class="mensaje-ajuste" id="mensaje-claude" role="status"></p>
          </div>
          ${interruptor('busquedaWeb', 'Buscar en internet', 'Para el tiempo, noticias, precios u horarios. Cada búsqueda suma un pequeño coste en tu cuenta de Claude.')}
          <div class="ajuste">
            <label class="ajuste__etiqueta" for="ajuste-modelo">Modelo</label>
            ${selector('modelo', 'ajuste-modelo', MODELOS)}
          </div>
          <div class="ajuste">
            <label class="ajuste__etiqueta" for="ajuste-personalidad">Cómo quieres que te hable</label>
            <textarea class="campo" id="ajuste-personalidad" rows="3" maxlength="2000" placeholder="Por ejemplo: tutéame, sé breve y avísame primero de lo urgente.">${escapar(ajustes.personalidad)}</textarea>
          </div>
        </section>

        <section class="grupo" id="seccion-correo" aria-label="Google: correo y calendario">
          <h3>Google: correo y calendario</h3>
          <div class="estado-cuenta ${estadoCorreo.conectado ? 'ok' : ''}"><span class="punto"></span>${
            estadoCorreo.conectado ? `<span>Conectado como <strong>${escapar(estadoCorreo.email)}</strong></span>` : 'Gmail y Calendar sin conectar'
          }</div>
          ${
            estadoCorreo.conectado && !estadoCorreo.calendario
              ? `<p class="ajuste__ayuda">Para que Kitsune vea tu agenda y cree eventos, activa la API de Google Calendar en tu proyecto de Google Cloud y vuelve a conectar la cuenta.</p>
            <div><button type="button" class="boton boton--primario" id="conectar-correo">${icono('calendario', 15)} Conectar también el calendario</button></div>`
              : ''
          }
          ${
            estadoCorreo.conectado
              ? '<div><button type="button" class="boton" id="desconectar-correo">Desconectar la cuenta</button></div>'
              : `
            <ol class="pasos">
              <li>En Google Cloud Console, crea un proyecto y activa la API de Gmail y la de Google Calendar.</li>
              ${
                escritorio
                  ? '<li>Crea un ID de cliente OAuth de tipo <strong>App de escritorio</strong>.</li><li>Pega aquí el ID y el secreto, y pulsa Conectar.</li>'
                  : `<li>Crea un ID de cliente OAuth de tipo <strong>Aplicación web</strong> con este origen autorizado: <code>${escapar(location.origin)}</code></li><li>Pega aquí el ID y pulsa Conectar.</li>`
              }
            </ol>
            <div class="ajuste"><label class="ajuste__etiqueta" for="google-id">ID de cliente</label>
              <input class="campo" id="google-id" type="text" value="${escapar(ajustes.googleClientId)}" placeholder="…apps.googleusercontent.com" spellcheck="false"></div>
            ${
              escritorio
                ? `<div class="ajuste"><label class="ajuste__etiqueta" for="google-secreto">Secreto del cliente</label>
              <input class="campo" id="google-secreto" type="password" placeholder="GOCSPX-…" autocomplete="off" spellcheck="false"></div>`
                : ''
            }
            <div><button type="button" class="boton boton--primario" id="conectar-correo">${icono('sobre', 15)} Conectar con Google</button></div>`
          }
          <p class="mensaje-ajuste" id="mensaje-correo" role="status"></p>
          <div class="ajuste ajuste--fila">
            <label class="ajuste__etiqueta" for="ajuste-frecuencia">Buscar correo nuevo</label>
            <div style="width:150px">${selector('correoCadaMin', 'ajuste-frecuencia', [[1, 'Cada minuto'], [5, 'Cada 5 min'], [15, 'Cada 15 min'], [30, 'Cada 30 min']])}</div>
          </div>
          ${interruptor('avisarCorreo', 'Avisar de los correos nuevos', 'Kitsune da un salto y aparece una notificación.')}
          ${interruptor('avisarCitas', 'Avisar antes de las citas', 'Un cuarto de hora antes de cada evento de tu calendario.')}
        </section>
      </div>`;

    conectar();
    pintarRecordatorios();
    pintarMemoria();
    if (seccion) contenedor.querySelector(`#seccion-${seccion}`)?.scrollIntoView({ block: 'start' });
  }

  async function pintarRecordatorios() {
    const lista = contenedor.querySelector('#lista-recordatorios');
    if (!lista || !api.recordatorios) return;
    const pendientes = await api.recordatorios.listar().catch(() => []);
    lista.innerHTML = pendientes.length
      ? pendientes
          .map(
            (r) => `<li><span class="recordatorios__texto">${escapar(r.texto)}</span><time datetime="${new Date(r.cuando).toISOString()}">${escapar(cuandoLegible(r.cuando))}</time>
              <button type="button" class="icono-boton" data-borrar="${escapar(r.id)}" aria-label="Borrar «${escapar(r.texto)}»" title="Borrar">${icono('papelera', 16)}</button></li>`,
          )
          .join('')
      : '<li class="recordatorios__vacio">No tienes recordatorios pendientes.</li>';
    lista.querySelectorAll('[data-borrar]').forEach((b) =>
      b.addEventListener('click', async () => {
        await api.recordatorios.borrar(b.dataset.borrar).catch(() => {});
        pintarRecordatorios();
      }),
    );
  }

  async function pintarMemoria() {
    const lista = contenedor.querySelector('#lista-memoria');
    if (!lista || !api.memoria) return;
    const datos = await api.memoria.listar().catch(() => []);
    lista.innerHTML = datos.length
      ? datos
          .map(
            (d) => `<li><span class="recordatorios__texto">${escapar(d.texto)}</span>
              <button type="button" class="icono-boton" data-olvidar="${escapar(d.id)}" aria-label="Olvidar «${escapar(d.texto)}»" title="Olvidar">${icono('papelera', 16)}</button></li>`,
          )
          .join('')
      : '<li class="recordatorios__vacio">Todavía no recuerda nada.</li>';
    const todo = contenedor.querySelector('#olvidar-todo');
    todo.hidden = datos.length === 0;
    lista.querySelectorAll('[data-olvidar]').forEach((b) =>
      b.addEventListener('click', async () => {
        await api.memoria.olvidar(b.dataset.olvidar).catch(() => {});
        pintarMemoria();
      }),
    );
  }

  function conectar() {
    // Borrar toda la memoria pide un segundo toque para confirmar.
    const olvidarTodo = contenedor.querySelector('#olvidar-todo');
    olvidarTodo?.addEventListener('click', async () => {
      if (olvidarTodo.dataset.confirmar !== 'si') {
        olvidarTodo.dataset.confirmar = 'si';
        olvidarTodo.textContent = '¿Seguro? Pulsa otra vez para olvidarlo todo';
        return;
      }
      await api.memoria.olvidarTodo();
      olvidarTodo.dataset.confirmar = '';
      olvidarTodo.textContent = 'Olvidar todo';
      pintarMemoria();
    });

    contenedor.querySelector('#ajustes-volver').addEventListener('click', alCerrar);

    contenedor.querySelectorAll('[data-clave]').forEach((b) =>
      b.addEventListener('click', async () => {
        const { clave, valor } = b.dataset;
        if (await guardar({ [clave]: valor })) {
          contenedor.querySelectorAll(`[data-clave="${clave}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        }
      }),
    );
    contenedor.querySelectorAll('[data-interruptor]').forEach((b) =>
      b.addEventListener('click', async () => {
        const clave = b.dataset.interruptor;
        if (await guardar({ [clave]: !ajustes[clave] })) b.setAttribute('aria-checked', String(ajustes[clave]));
      }),
    );
    contenedor.querySelectorAll('[data-selector]').forEach((s) =>
      s.addEventListener('change', () => {
        const clave = s.dataset.selector;
        guardar({ [clave]: typeof ajustes[clave] === 'number' ? Number(s.value) : s.value });
      }),
    );
    const personalidad = contenedor.querySelector('#ajuste-personalidad');
    personalidad.addEventListener('change', () => guardar({ personalidad: personalidad.value.trim() }));

    // Atajo: se captura la siguiente combinación de teclas.
    const zonaAtajo = contenedor.querySelector('#atajo');
    const botonAtajo = contenedor.querySelector('#atajo-cambiar');
    let capturando = null;
    botonAtajo?.addEventListener('click', () => {
      if (capturando) return terminarCaptura();
      zonaAtajo.classList.add('capturando');
      botonAtajo.textContent = 'Cancelar';
      contenedor.querySelector('#atajo-teclas').innerHTML = '<kbd>Pulsa la combinación…</kbd>';
      capturando = async (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.key === 'Escape') return terminarCaptura();
        const atajo = atajoDesdeEvento(e);
        if (!atajo) return;
        terminarCaptura();
        await guardar({ atajo }, { donde: 'mensaje-atajo', texto: 'Atajo guardado.' });
        contenedor.querySelector('#atajo-teclas').innerHTML = teclasDe(ajustes.atajo);
      };
      window.addEventListener('keydown', capturando, true);
    });
    function terminarCaptura() {
      window.removeEventListener('keydown', capturando, true);
      capturando = null;
      zonaAtajo.classList.remove('capturando');
      botonAtajo.textContent = 'Cambiar';
      contenedor.querySelector('#atajo-teclas').innerHTML = teclasDe(ajustes.atajo);
    }

    contenedor.querySelector('#guardar-clave').addEventListener('click', async () => {
      const campo = contenedor.querySelector('#clave-claude');
      if (!campo.value.trim()) return mostrarMensaje('mensaje-claude', 'Pega primero la clave.', false);
      mostrarMensaje('mensaje-claude', 'Comprobando la clave…', true);
      try {
        await api.claude.guardarClave(campo.value.trim());
        campo.value = '';
        await pintar('claude');
        mostrarMensaje('mensaje-claude', 'Clave válida y guardada.', true);
        alCambiar(ajustes, { claveClaude: true });
      } catch (e) {
        mostrarMensaje('mensaje-claude', e.message, false);
      }
    });
    contenedor.querySelector('#quitar-clave')?.addEventListener('click', async () => {
      await api.claude.guardarClave('');
      await pintar('claude');
      alCambiar(ajustes, { claveClaude: false });
    });

    contenedor.querySelector('#google-id')?.addEventListener('change', (e) => guardar({ googleClientId: e.target.value.trim() }));
    contenedor.querySelector('#conectar-correo')?.addEventListener('click', async () => {
      const secreto = contenedor.querySelector('#google-secreto')?.value.trim();
      try {
        const id = contenedor.querySelector('#google-id')?.value.trim() ?? ajustes.googleClientId;
        if (id && id !== ajustes.googleClientId) await guardar({ googleClientId: id });
        if (secreto) await api.correo.guardarSecretoCliente(secreto);
        mostrarMensaje('mensaje-correo', 'Inicia sesión en la ventana del navegador que se ha abierto…', true);
        await api.correo.conectar();
        await pintar('correo');
        mostrarMensaje('mensaje-correo', 'Cuenta conectada.', true);
        alCambiar(ajustes, { correo: true });
      } catch (e) {
        mostrarMensaje('mensaje-correo', e.message, false);
      }
    });
    contenedor.querySelector('#desconectar-correo')?.addEventListener('click', async () => {
      await api.correo.desconectar();
      await pintar('correo');
      alCambiar(ajustes, { correo: false });
    });
  }

  return { abrir: (seccion) => pintar(seccion) };
}
