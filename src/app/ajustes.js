import { icono } from './iconos.js';
import { PALETAS } from '../kitsune/paletas.js';

const escapar = (t = '') => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MODELOS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 · el más capaz'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 · más rápido'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 · el más económico'],
];

const MODELOS_GROQ = [
  ['openai/gpt-oss-120b', 'GPT-OSS 120B · el más capaz (recomendado)'],
  ['openai/gpt-oss-20b', 'GPT-OSS 20B · el más rápido'],
  ['qwen/qwen3.8-27b', 'Qwen 3.8 27B'],
];

// Lo que cambia según la IA elegida.
const IA = {
  groq: {
    nombre: 'Groq',
    marcador: 'gsk_…',
    ayuda: 'Créala gratis, sin tarjeta, en <strong>console.groq.com</strong> → API Keys → Create API Key.',
  },
  claude: {
    nombre: 'Claude',
    marcador: 'sk-ant-…',
    ayuda: 'De pago por uso: créala en <strong>console.anthropic.com</strong> → API Keys.',
  },
};

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
    const ia = IA[ajustes.proveedor] ?? IA.claude;

    // Pasos para quien prefiera su propio proyecto de Google Cloud.
    const pasosPropios = `
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
            }`;

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
          <div class="ajuste">
            <span class="ajuste__etiqueta">Estilo</span>
            ${segmentado('estilo', [['realista', 'Realista'], ['anime', 'Anime'], ['kawaii', 'Kawaii'], ['tinta', 'Tinta']])}
            <p class="ajuste__ayuda">Realista, con pelo; anime y kawaii, como dibujo animado; tinta, como un sumi-e. Los dibujados gastan menos batería.</p>
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

        <section class="grupo" id="seccion-claude" aria-label="Inteligencia artificial">
          <h3>Inteligencia artificial</h3>
          <div class="ajuste">
            <span class="ajuste__etiqueta">Qué IA usa Kitsune</span>
            ${segmentado('proveedor', [['groq', 'Groq · gratis'], ['claude', 'Claude · de pago']])}
            <p class="ajuste__ayuda">${
              ajustes.proveedor === 'groq'
                ? 'Gratis, con un límite de mensajes por minuto y por día que da de sobra para el uso personal. No busca en internet.'
                : 'Más lista y con búsqueda en internet; pagas lo que usas con tu cuenta de Anthropic.'
            }</p>
          </div>
          <div class="estado-cuenta ${estadoClaude.configurado ? 'ok' : ''}"><span class="punto"></span>${
            estadoClaude.configurado ? `Clave de ${ia.nombre} guardada y cifrada ${dondeSeGuarda}` : `Sin clave de ${ia.nombre}: añádela para poder chatear`
          }</div>
          <div class="ajuste">
            <label class="ajuste__etiqueta" for="clave-claude">${estadoClaude.configurado ? 'Cambiar la clave' : `Clave de ${ia.nombre}`}</label>
            <div style="display:flex;gap:6px">
              <input class="campo" id="clave-claude" type="password" placeholder="${ia.marcador}" autocomplete="off" spellcheck="false">
              <button type="button" class="boton boton--primario" id="guardar-clave">Guardar</button>
            </div>
            <p class="ajuste__ayuda">${ia.ayuda}${estadoClaude.configurado ? ' <button type="button" class="boton" id="quitar-clave" style="margin-left:6px;padding:2px 10px">Quitar clave</button>' : ''}</p>
            <p class="mensaje-ajuste" id="mensaje-claude" role="status"></p>
          </div>
          ${interruptor(
            'busquedaWeb',
            'Buscar en internet',
            ajustes.proveedor === 'claude'
              ? 'Para noticias, precios u horarios. Cada búsqueda suma un pequeño coste en tu cuenta de Claude.'
              : 'Para noticias, precios u horarios. Gratis: cuenta para el límite diario de Groq.',
          )}
          ${
            ajustes.proveedor === 'claude'
              ? `<div class="ajuste">
            <label class="ajuste__etiqueta" for="ajuste-modelo">Modelo</label>
            ${selector('modelo', 'ajuste-modelo', MODELOS)}
          </div>`
              : `<div class="ajuste">
            <label class="ajuste__etiqueta" for="ajuste-modelo-groq">Modelo</label>
            ${selector('modeloGroq', 'ajuste-modelo-groq', MODELOS_GROQ)}
          </div>`
          }
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
              ? `<p class="ajuste__ayuda">${
                  estadoCorreo.integrado
                    ? 'Para que Kitsune vea tu agenda y cree eventos, vuelve a conectar la cuenta y acepta también el permiso del calendario.'
                    : 'Para que Kitsune vea tu agenda y cree eventos, activa la API de Google Calendar en tu proyecto de Google Cloud y vuelve a conectar la cuenta.'
                }</p>
            <div><button type="button" class="boton boton--primario" id="conectar-correo">${icono('calendario', 15)} Conectar también el calendario</button></div>`
              : ''
          }
          ${
            estadoCorreo.conectado
              ? '<div><button type="button" class="boton" id="desconectar-correo">Desconectar la cuenta</button></div>'
              : estadoCorreo.integrado
                ? `
            <p class="ajuste__ayuda">Conecta tu cuenta de Google para que Kitsune lea tu correo y tu agenda. Solo hace falta una vez.</p>
            <div><button type="button" class="boton boton--primario" id="conectar-correo">${icono('sobre', 15)} Conectar con Google</button></div>
            <p class="ajuste__ayuda">Si Google avisa de que «no ha verificado esta aplicación», pulsa <strong>Configuración avanzada</strong> → <strong>Ir a Kitsune</strong> y acepta los permisos.</p>
            <details class="avanzado">
              <summary>Usar mi propio proyecto de Google</summary>
              ${pasosPropios}
            </details>`
                : `
            ${pasosPropios}
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
    if (seccion) contenedor.querySelector(`#seccion-${seccion}`)?.scrollIntoView({ block: 'start' });
  }

  function conectar() {
    contenedor.querySelector('#ajustes-volver').addEventListener('click', alCerrar);

    contenedor.querySelectorAll('[data-clave]').forEach((b) =>
      b.addEventListener('click', async () => {
        const { clave, valor } = b.dataset;
        if (await guardar({ [clave]: valor })) {
          contenedor.querySelectorAll(`[data-clave="${clave}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
          // Al cambiar de IA cambian la clave, el modelo y lo que ofrece el chat.
          if (clave === 'proveedor') {
            await pintar('claude');
            alCambiar(ajustes, { claveClaude: true });
          }
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
        await api.claude.guardarClave(campo.value.trim(), ajustes.proveedor);
        campo.value = '';
        await pintar('claude');
        mostrarMensaje('mensaje-claude', 'Clave válida y guardada.', true);
        alCambiar(ajustes, { claveClaude: true });
      } catch (e) {
        mostrarMensaje('mensaje-claude', e.message, false);
      }
    });
    contenedor.querySelector('#quitar-clave')?.addEventListener('click', async () => {
      await api.claude.guardarClave('', ajustes.proveedor);
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
