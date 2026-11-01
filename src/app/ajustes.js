import { icono } from './iconos.js';
import { PALETAS } from '../kitsune/paletas.js';
import { PERMISOS, NOMBRES_NIVEL, nivelesDe, nivel } from '../compartido/permisos.js';
import { VOCES } from '../compartido/voz.js';
import { leerBloqueo, bloqueoDisponible, activarBloqueo, desactivarBloqueo, cambiarTras, comprobarIdentidad, OPCIONES_TRAS, nombreBiometria } from './web/bloqueo.js';
import { COLECCIONES_SINCRO, codigoDe } from '../compartido/sincro.js';

const escapar = (t = '') => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const MODELOS = [
  ['claude-opus-5-5', 'Claude Opus 5.5 · el más capaz'],
  ['claude-sonnet-5-5', 'Claude Sonnet 5.5 · más rápido'],
  ['claude-haiku-5-5', 'Claude Haiku 5.5 · el más económico'],
];

const MODELOS_OPENAI = [
  ['gpt-6-luna', 'GPT-6 Luna · el más barato (recomendado)'],
  ['gpt-6.1-terra', 'GPT-6.1 Terra · más listo, 10 veces más caro'],
  ['gpt-6.1-sol', 'GPT-6.1 Sol · el más capaz, 20 veces más caro'],
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
  openai: {
    nombre: 'OpenAI',
    marcador: 'sk-…',
    ayuda: 'De pago por uso: créala en <strong>platform.openai.com/api-keys</strong> y añade saldo en Billing.',
  },
  claude: {
    nombre: 'Claude',
    marcador: 'sk-ant-…',
    ayuda: 'De pago por uso: créala en <strong>console.anthropic.com</strong> → API Keys.',
  },
};

// Atajos para poner todos los permisos de golpe. Leer y consultar no cambian.
const PREAJUSTES = [
  ['preguntar', 'Preguntar antes de cambiar nada'],
  ['no', 'Solo consultar'],
  ['si', 'Confiar en Kitsune'],
];
const DE_LECTURA = new Set(['permisoCorreoLeer', 'permisoAgendaVer']);

function nivelesPreajuste(nivelBuscado) {
  return Object.fromEntries(
    PERMISOS.filter((p) => !DE_LECTURA.has(p.clave)).map((p) => {
      const niveles = nivelesDe(p);
      // Enviar correo no admite «sí»: se queda en preguntar.
      return [p.clave, niveles.includes(nivelBuscado) ? nivelBuscado : niveles.includes('preguntar') ? 'preguntar' : niveles[0]];
    }),
  );
}

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

export function crearAjustes({ contenedor, api, alCambiar, alCerrar, probarVoz = async () => {}, vocesVoiceStudio = null }) {
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
    const [estadoClaude, estadoCorreo, estadoAvisos] = await Promise.all([
      api.claude.estado(),
      api.correo.estado(),
      api.servidor?.estado().catch((e) => ({ configurado: true, vinculado: false, error: e.message })) ?? null,
    ]);
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
            ${segmentado('estilo', [['ilustracion', 'Ilustración'], ['realista', 'Realista'], ['anime', 'Anime'], ['kawaii', 'Kawaii'], ['tinta', 'Tinta']])}
            <p class="ajuste__ayuda">Ilustración, una cría de peluche con ojos grandes; realista, con pelo de zorro; anime y kawaii, como dibujo animado; tinta, como un sumi-e. Los dibujados gastan menos batería.</p>
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
          ${interruptor('voz', 'Leer las respuestas en voz alta')}
          <div class="ajuste">
            <div class="ajuste__etiqueta">Tipo de voz</div>
            ${segmentado('vozTipo', [['natural', 'Natural'], ...(vocesVoiceStudio ? [['voicestudio', 'VoiceStudio']] : []), ['dispositivo', escritorio ? 'De Windows' : 'Del dispositivo']])}
            <p class="ajuste__ayuda">La natural la genera tu servidor de avisos (hay que vincularlo en «Avisos en el móvil»): gratis hasta unas 3.500 letras al día y después una voz más sencilla. Sin servidor se usa la del dispositivo.${
              vocesVoiceStudio
                ? ' <strong>VoiceStudio</strong>: la app de voz local de <a href="https://voicestudio.sh" data-enlace-externo>voicestudio.sh</a>; instálala y ábrela en este ordenador, clona o diseña tu voz allí y elígela aquí. El texto no sale del ordenador.'
                : ''
            }</p>
          </div>
          ${
            vocesVoiceStudio
              ? `<div class="ajuste ajuste--fila">
            <label class="ajuste__etiqueta" for="ajuste-vs-voz">Voz de VoiceStudio</label>
            <div class="vs-voz"><select class="campo" id="ajuste-vs-voz" data-selector="voicestudioVoz"><option value="${escapar(ajustes.voicestudioVoz)}">${escapar(ajustes.voicestudioVoz === 'default' ? 'Voz por defecto del motor' : ajustes.voicestudioVoz)}</option></select>
            <button type="button" class="boton" id="vs-cargar">Cargar voces</button></div>
          </div>
          <p class="mensaje-ajuste" id="mensaje-vs" role="status"></p>`
              : ''
          }
          <div class="ajuste ajuste--fila">
            <label class="ajuste__etiqueta" for="ajuste-voz-nombre">Voz natural</label>
            <div style="width:210px">${selector('vozNombre', 'ajuste-voz-nombre', VOCES.map((v) => [v.id, `${v.nombre} · ${v.detalle}`]))}</div>
          </div>
          <div class="botonera"><button type="button" class="boton" id="voz-probar">${icono('altavoz', 15)} Escuchar la voz</button></div>
          <p class="mensaje-ajuste" id="mensaje-voz" role="status"></p>
          ${
            api.plataforma === 'web' && !api.demo
              ? `<div id="ajuste-bloqueo" hidden>
            <div class="ajuste ajuste--fila">
              <div>
                <div class="ajuste__etiqueta" id="et-bloqueo">Bloquear con ${nombreBiometria() === 'Face ID' ? 'Face ID' : 'huella o cara'}</div>
                <p class="ajuste__ayuda">Al abrir Kitsune, o al volver tras un rato, te pide ${nombreBiometria()} (o el código del dispositivo).</p>
              </div>
              <button type="button" class="interruptor" role="switch" aria-labelledby="et-bloqueo" id="bloqueo-interruptor" aria-checked="${Boolean(leerBloqueo())}"></button>
            </div>
            <div class="ajuste ajuste--fila" id="bloqueo-tras-fila" ${leerBloqueo() ? '' : 'hidden'}>
              <label class="ajuste__etiqueta" for="bloqueo-tras">Pedirlo al volver</label>
              <div style="width:170px"><select class="campo" id="bloqueo-tras">${OPCIONES_TRAS.map(([v, n]) => `<option value="${v}" ${leerBloqueo()?.tras === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
            </div>
            <p class="mensaje-ajuste" id="mensaje-bloqueo" role="status"></p>
          </div>`
              : ''
          }
          ${interruptor('pulsoDiario', 'Pulso del día', 'La primera vez que abres Kitsune cada día te ofrece un resumen de correo y recordatorios.')}
        </section>

        ${estadoAvisos ? seccionAvisos(estadoAvisos) : ''}

        ${api.sincro && estadoAvisos ? '<section class="grupo sincro" id="seccion-sincro" aria-label="Sincronizar con tus dispositivos"></section>' : ''}

        <section class="grupo" id="seccion-permisos" aria-label="Permisos">
          <h3>Permisos</h3>
          <p class="ajuste__ayuda">Qué puede hacer Kitsune por su cuenta. <strong>Sí</strong>: lo hace y te lo cuenta. <strong>Preguntar</strong>: te enseña en el chat lo que va a hacer y espera a que lo aceptes. <strong>No</strong>: no lo hace aunque se lo pidas.</p>
          <div class="preajustes" role="group" aria-label="Poner todos a la vez">
            ${PREAJUSTES.map(([n, nombre]) => `<button type="button" class="boton" data-preajuste="${n}">${nombre}</button>`).join('')}
          </div>
          ${[...new Set(PERMISOS.map((p) => p.grupo))]
            .map(
              (grupo) => `
          <div class="permisos" role="group" aria-label="${grupo}">
            <span class="permisos__grupo">${grupo}</span>
            ${PERMISOS.filter((p) => p.grupo === grupo)
              .map(
                (p) => `
            <div class="permiso">
              <span class="permiso__nombre">${p.nombre}</span>
              <div class="segmentado segmentado--permiso" role="group" aria-label="${p.nombre}">
                ${nivelesDe(p)
                  .map((n) => `<button type="button" data-clave="${p.clave}" data-valor="${n}" data-nivel="${n}" aria-pressed="${nivel(ajustes, p.clave) === n}">${NOMBRES_NIVEL[n]}</button>`)
                  .join('')}
              </div>
            </div>`,
              )
              .join('')}
          </div>`,
            )
            .join('')}
          <div class="permisos" role="group" aria-label="Internet">
            <span class="permisos__grupo">Internet</span>
            ${interruptor(
              'busquedaWeb',
              'Buscar en internet',
              ajustes.proveedor === 'groq'
                ? 'Para noticias, precios u horarios. Gratis: cuenta para el límite diario de Groq.'
                : `Para noticias, precios u horarios. Cada búsqueda suma un pequeño coste en tu cuenta de ${ajustes.proveedor === 'openai' ? 'OpenAI' : 'Claude'}.`,
            )}
          </div>
          <p class="ajuste__ayuda">Enviar un correo siempre te lo enseña antes, entero. Lo que Kitsune lee en correos o páginas nunca le da órdenes.</p>
          <p class="mensaje-ajuste" id="mensaje-permisos" role="status"></p>
        </section>

        <section class="grupo" id="seccion-claude" aria-label="Inteligencia artificial">
          <h3>Inteligencia artificial</h3>
          <div class="ajuste">
            <span class="ajuste__etiqueta">Qué IA usa Kitsune</span>
            ${segmentado('proveedor', [['groq', 'Groq · gratis'], ['openai', 'OpenAI'], ['claude', 'Claude']])}
            <p class="ajuste__ayuda">${
              ajustes.proveedor === 'groq'
                ? 'Gratis, con un límite de mensajes por minuto y por día que da de sobra para el uso personal.'
                : ajustes.proveedor === 'openai'
                ? 'GPT-6 Luna: rápido, sin límites por minuto y muy barato (céntimos al mes con un uso normal). Pagas lo que usas con tu saldo de OpenAI.'
                : 'La más lista y con búsqueda en internet; pagas lo que usas con tu cuenta de Anthropic.'
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
          ${
            ajustes.proveedor === 'claude'
              ? `<div class="ajuste">
            <label class="ajuste__etiqueta" for="ajuste-modelo">Modelo</label>
            ${selector('modelo', 'ajuste-modelo', MODELOS)}
          </div>`
              : ajustes.proveedor === 'openai'
              ? `<div class="ajuste">
            <label class="ajuste__etiqueta" for="ajuste-modelo-openai">Modelo</label>
            ${selector('modeloOpenAI', 'ajuste-modelo-openai', MODELOS_OPENAI)}
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
          ${interruptor('fotosRemitentes', 'Fotos y logos de quien te escribe', 'Los logos se piden a Google y las fotos a Gravatar. Si no hay, se ve la inicial.')}
          ${interruptor('avisarCitas', 'Avisar antes de las citas', 'Un cuarto de hora antes de cada evento de tu calendario.')}
        </section>
      </div>`;

    conectar();
    if (estadoAvisos) conectarAvisos(estadoAvisos);
    if (api.sincro && estadoAvisos) pintarSincro(estadoAvisos.vinculado);
    if (seccion) contenedor.querySelector(`#seccion-${seccion}`)?.scrollIntoView({ block: 'start' });
  }

  // ---------- Sincronizar con tus otros dispositivos ----------

  let sincroAqui = false;
  let esperandoSincro = false;
  const conBiometria = api.plataforma === 'web' && !api.demo;
  const haceCuanto = (ms) => {
    if (!ms) return 'todavía no';
    const min = Math.round((Date.now() - ms) / 60_000);
    return min < 1 ? 'hace un momento' : min < 60 ? `hace ${min} min` : min < 1440 ? `hace ${Math.round(min / 60)} h` : `hace ${Math.round(min / 1440)} d`;
  };

  // En el iPhone, todo lo que da acceso a tus datos sincronizados pasa por Face ID:
  // si el bloqueo no está activado, se activa (Kitsune lleva tus claves).
  async function comprobarConCara() {
    if (!conBiometria || !(await bloqueoDisponible())) return;
    if (!leerBloqueo()) {
      await activarBloqueo(1);
      const bloque = contenedor.querySelector('#ajuste-bloqueo');
      bloque?.querySelector('#bloqueo-interruptor')?.setAttribute('aria-checked', 'true');
      const fila = bloque?.querySelector('#bloqueo-tras-fila');
      if (fila) fila.hidden = false;
      return;
    }
    if (!(await comprobarIdentidad())) throw new Error('No se ha podido comprobar que eres tú.');
  }
  const errorCara = (error) => (error?.name === 'NotAllowedError' ? new Error(`Cancelado: hace falta ${nombreBiometria()}.`) : error);

  async function pintarSincro(vinculado) {
    const caja = contenedor.querySelector('#seccion-sincro');
    if (!caja) return;
    const cabecera = `<h3>Sincronizar con tus dispositivos</h3>
          <p class="ajuste__ayuda">Tu memoria, conversaciones, recordatorios, Empleo, ajustes y claves de la IA, iguales en el iPhone y en Windows. Viajan cifrados con una llave que solo tienen tus dispositivos: el servidor no puede leerlos.</p>`;
    if (!vinculado) {
      caja.innerHTML = `${cabecera}<p class="ajuste__ayuda">Primero conecta los avisos (aquí arriba) en los dos dispositivos.</p>`;
      return;
    }
    caja.innerHTML = `${cabecera}<div class="esqueleto" style="height:64px"></div>`;
    let r;
    try {
      r = await api.sincro.resumen();
    } catch (error) {
      caja.innerHTML = `${cabecera}<p class="mensaje-ajuste" role="status">${escapar(error.message)}</p>`;
      return;
    }
    sincroAqui = r.aqui;
    const conCara = conBiometria && (await bloqueoDisponible());
    const notaCara = conCara ? `<p class="ajuste__ayuda sincro__cara">${icono('llave', 14)} En este iPhone va con ${nombreBiometria()}: se activa el bloqueo de Kitsune y cada dispositivo nuevo se aprueba con tu cara.</p>` : '';

    if (!r.aqui && esperandoSincro && r.esperando) {
      caja.innerHTML = `${cabecera}
          <div class="sincro__espera">
            <p class="ajuste__ayuda">Abre Kitsune en tu otro dispositivo, ve a Ajustes → Sincronizar y aprueba la petición si ves este mismo código:</p>
            <p class="sincro__codigo" aria-label="Código ${escapar(r.esperando.codigo)}">${escapar(r.esperando.codigo)}</p>
            <p class="ajuste__ayuda sincro__latido"><span class="empleo-progreso__punto"></span> Esperando la aprobación…</p>
            <div class="botonera"><button type="button" class="boton" id="sincro-cancelar">Cancelar</button></div>
          </div>
          <p class="mensaje-ajuste" id="mensaje-sincro" role="status"></p>`;
      caja.querySelector('#sincro-cancelar').addEventListener('click', async () => {
        esperandoSincro = false;
        await api.sincro.cancelarEspera().catch(() => {});
        pintarSincro(true);
      });
      return;
    }

    if (!r.aqui) {
      caja.innerHTML = `${cabecera}
          ${
            r.servidor
              ? `<p class="ajuste__ayuda">Ya sincronizas en otro dispositivo. Une este y tendrás aquí lo mismo; lo que tengas solo aquí se suma.</p>
          <div class="botonera"><button type="button" class="boton boton--primario" id="sincro-unir">${icono('enlace', 15)} Unir este dispositivo</button></div>
          <details class="avanzado"><summary>¿Ya no tienes el otro dispositivo?</summary>
            <p class="ajuste__ayuda">Borra la copia cifrada del servidor y empieza la sincronización desde aquí. Tus dispositivos conservan sus datos.</p>
            <button type="button" class="boton" id="sincro-cero">Empezar de cero desde aquí</button></details>`
              : `<div class="botonera"><button type="button" class="boton boton--primario" id="sincro-activar">${icono('actualizar', 15)} Activar la sincronización${conCara ? ` con ${nombreBiometria()}` : ''}</button></div>`
          }
          ${notaCara}
          <p class="mensaje-ajuste" id="mensaje-sincro" role="status"></p>`;
      const ocupar = (b, texto) => {
        b.disabled = true;
        b.textContent = texto;
      };
      caja.querySelector('#sincro-activar')?.addEventListener('click', async (e) => {
        const boton = e.currentTarget;
        try {
          await comprobarConCara();
          ocupar(boton, 'Subiendo tus datos cifrados…');
          await api.sincro.activar();
          pintarSincro(true);
        } catch (error) {
          pintarSincro(true).then(() => mostrarMensaje('mensaje-sincro', errorCara(error).message, false));
        }
      });
      caja.querySelector('#sincro-unir')?.addEventListener('click', async () => {
        try {
          await comprobarConCara();
          await api.sincro.solicitar();
          esperandoSincro = true;
          await pintarSincro(true);
          await api.sincro.esperar();
          esperandoSincro = false;
          await pintarSincro(true);
          mostrarMensaje('mensaje-sincro', 'Listo: este dispositivo ya está sincronizado.', true);
        } catch (error) {
          if (!esperandoSincro && /Cancelado/.test(error.message)) return;
          esperandoSincro = false;
          pintarSincro(true).then(() => mostrarMensaje('mensaje-sincro', errorCara(error).message, false));
        }
      });
      const cero = caja.querySelector('#sincro-cero');
      cero?.addEventListener('click', async () => {
        if (cero.dataset.confirmar !== 'si') {
          cero.dataset.confirmar = 'si';
          cero.textContent = '¿Seguro? Pulsa otra vez: se borra la copia del servidor';
          return;
        }
        try {
          await comprobarConCara();
          await api.sincro.borrarServidor();
          await api.sincro.activar();
          pintarSincro(true);
        } catch (error) {
          pintarSincro(true).then(() => mostrarMensaje('mensaje-sincro', errorCara(error).message, false));
        }
      });
      return;
    }

    const solicitudes = await Promise.all(r.solicitudes.map(async (x) => ({ ...x, codigo: await codigoDe(x.publica) })));
    caja.innerHTML = `${cabecera}
          ${
            solicitudes.length
              ? solicitudes
                  .map(
                    (x) => `<div class="sincro__peticion" data-solicitud="${escapar(x.id)}">
              <div><strong>${escapar(x.nombre)}</strong> quiere sincronizar contigo.
              <p class="ajuste__ayuda">Apruébalo solo si en su pantalla ves este código:</p>
              <p class="sincro__codigo sincro__codigo--peq">${escapar(x.codigo)}</p></div>
              <div class="botonera"><button type="button" class="boton boton--primario" data-aprobar="${escapar(x.id)}">${conCara ? `Aprobar con ${nombreBiometria()}` : 'Aprobar'}</button>
              <button type="button" class="boton" data-rechazar="${escapar(x.id)}">Rechazar</button></div>
            </div>`,
                  )
                  .join('')
              : ''
          }
          <div class="ajuste ajuste--fila">
            <div><div class="ajuste__etiqueta">${r.error ? 'No se ha podido sincronizar' : 'Sincronizado'}</div>
              <p class="ajuste__ayuda">${r.error ? escapar(r.error) : `Última vez: ${haceCuanto(r.ultima)}${r.pendientes ? ` · ${r.pendientes} cambios por subir` : ''}.`} Para añadir otro dispositivo, pulsa «Unir este dispositivo» en él.</p></div>
            <button type="button" class="boton" id="sincro-ahora">${icono('actualizar', 15)} Ahora</button>
          </div>
          <div class="ajuste"><div class="ajuste__etiqueta">Qué se comparte desde aquí</div>
            <ul class="chips sincro__colecciones">${COLECCIONES_SINCRO.map(
              ([c, n]) => `<li><label class="chip chip--marcable"><input type="checkbox" value="${c}" ${r.colecciones.includes(c) ? 'checked' : ''}> ${escapar(n)}</label></li>`,
            ).join('')}</ul>
            <p class="ajuste__ayuda">La pantalla, el atajo y el motor de voz son de cada dispositivo y no se tocan.</p></div>
          ${notaCara}
          <details class="avanzado"><summary>Dejar de sincronizar</summary>
            <p class="ajuste__ayuda">Este dispositivo se queda con sus datos y deja de mandar y recibir cambios.</p>
            <div class="botonera"><button type="button" class="boton" id="sincro-dejar">Dejar de sincronizar aquí</button>
            <button type="button" class="boton" id="sincro-borrar">Borrar la copia del servidor</button></div></details>
          <p class="mensaje-ajuste" id="mensaje-sincro" role="status"></p>`;
    caja.querySelector('#sincro-ahora').addEventListener('click', async (e) => {
      e.currentTarget.disabled = true;
      try {
        await api.sincro.sincronizar();
        await pintarSincro(true);
        mostrarMensaje('mensaje-sincro', 'Al día.', true);
      } catch (error) {
        pintarSincro(true).then(() => mostrarMensaje('mensaje-sincro', error.message, false));
      }
    });
    caja.querySelectorAll('[data-aprobar]').forEach((b) =>
      b.addEventListener('click', async () => {
        const x = solicitudes.find((s) => s.id === b.dataset.aprobar);
        try {
          await comprobarConCara();
          await api.sincro.aprobar(x.id, x.publica);
          await pintarSincro(true);
          mostrarMensaje('mensaje-sincro', `${x.nombre} ya tiene la llave: en un momento verá tus datos.`, true);
        } catch (error) {
          mostrarMensaje('mensaje-sincro', errorCara(error).message, false);
        }
      }),
    );
    caja.querySelectorAll('[data-rechazar]').forEach((b) =>
      b.addEventListener('click', async () => {
        await api.sincro.rechazar(b.dataset.rechazar).catch(() => {});
        pintarSincro(true);
      }),
    );
    caja.querySelectorAll('.sincro__colecciones input').forEach((c) =>
      c.addEventListener('change', async () => {
        const lista = [...caja.querySelectorAll('.sincro__colecciones input:checked')].map((x) => x.value);
        try {
          await api.sincro.elegirColecciones(lista);
          mostrarMensaje('mensaje-sincro', 'Guardado.', true);
        } catch (error) {
          mostrarMensaje('mensaje-sincro', error.message, false);
        }
      }),
    );
    const confirmar = (b, texto, accion) =>
      b.addEventListener('click', async () => {
        if (b.dataset.confirmar !== 'si') {
          b.dataset.confirmar = 'si';
          b.textContent = texto;
          return;
        }
        try {
          await accion();
          await pintarSincro(true);
        } catch (error) {
          mostrarMensaje('mensaje-sincro', error.message, false);
        }
      });
    confirmar(caja.querySelector('#sincro-dejar'), '¿Seguro? Pulsa otra vez', () => api.sincro.desactivar());
    confirmar(caja.querySelector('#sincro-borrar'), '¿Seguro? Todos tus dispositivos dejarán de sincronizar', () => api.sincro.borrarServidor());
  }

  // ---------- Avisos en el móvil (servidor de avisos) ----------

  const horas = Array.from({ length: 24 }, (_, h) => `${String(h).padStart(2, '0')}:00`);
  const opciones = (lista, actual) => lista.map(([v, n]) => `<option value="${v}" ${String(actual) === String(v) ? 'selected' : ''}>${n}</option>`).join('');

  function seccionAvisos(e) {
    // El ordenador (Electron) no recibe push ni se vincula con Google: usa un código.
    const escritorio = !e.puedeVincularConGoogle;
    const cabecera = `<h3>Avisos en el móvil</h3>
          <p class="ajuste__ayuda">Para que Kitsune te avise aunque esté cerrado (correos, citas, recordatorios) y haga automatizaciones, usa tu propio servidor de avisos, gratuito, en Cloudflare.</p>`;
    const campoUrl = `<details class="avanzado"${e.configurado ? '' : ' open'}>
            <summary>Dirección del servidor</summary>
            <div class="ajuste"><label class="ajuste__etiqueta" for="srv-url">Dirección</label>
              <input class="campo" id="srv-url" type="url" inputmode="url" placeholder="https://kitsune.tu-cuenta.workers.dev" value="${escapar(ajustes.servidorUrl)}" spellcheck="false">
              <p class="ajuste__ayuda">${e.integrado ? 'Déjala vacía para usar la que trae la app.' : 'La da el despliegue del servidor (ver servidor/LEEME.md en el repositorio).'}</p></div>
          </details>`;
    if (!e.configurado) {
      return `<section class="grupo" id="seccion-avisos" aria-label="Avisos en el móvil">${cabecera}
          <div class="estado-cuenta"><span class="punto"></span>Servidor de avisos sin montar</div>
          ${campoUrl}
          <p class="mensaje-ajuste" id="mensaje-avisos" role="status"></p></section>`;
    }
    if (!e.vinculado) {
      return `<section class="grupo" id="seccion-avisos" aria-label="Avisos en el móvil">${cabecera}
          <div class="estado-cuenta"><span class="punto"></span>${escritorio ? 'Este ordenador no está vinculado' : 'Sin conectar'}</div>
          ${
            e.puedeVincularConGoogle
              ? `<p class="ajuste__ayuda">Se abrirá Google para que des permiso al servidor (correo y calendario). Después vuelve a Kitsune: se conecta solo.</p>
          <div><button type="button" class="boton boton--primario" id="srv-conectar">${icono('campana', 15)} Conectar los avisos</button></div>`
              : '<p class="ajuste__ayuda">En el móvil, abre Ajustes → Avisos en el móvil → «Vincular otro dispositivo» y escribe aquí el código.</p>'
          }
          <form class="formulario formulario--linea" id="srv-canje">
            <input class="campo" name="codigo" inputmode="numeric" pattern="[0-9]{6}" maxlength="6" placeholder="Código de 6 cifras" aria-label="Código de otro dispositivo" autocomplete="one-time-code">
            <button type="submit" class="boton">${e.puedeVincularConGoogle ? 'Tengo un código' : 'Vincular'}</button>
          </form>
          ${campoUrl}
          <p class="mensaje-ajuste" id="mensaje-avisos" role="status"></p></section>`;
    }
    const a = e.avisos ?? {};
    const yo = e.dispositivos?.find((d) => d.yo);
    let push;
    if (escritorio) push = '<p class="ajuste__ayuda">Este ordenador ya te avisa por sí mismo; los avisos push van a tus móviles vinculados.</p>';
    else if (e.pushAqui) {
      push = `<div class="estado-cuenta ok"><span class="punto"></span>Este ${escapar(yo?.nombre ?? 'dispositivo')} recibe los avisos</div>
          <div class="botonera"><button type="button" class="boton" id="srv-probar">Enviar un aviso de prueba</button><button type="button" class="boton" id="srv-push-no">Desactivar aquí</button></div>`;
    } else if (e.ios && !e.instalada) {
      push = '<p class="ajuste__ayuda aviso-instalar">Para recibir avisos en el iPhone, instala Kitsune: en Safari, <strong>Compartir → Añadir a pantalla de inicio</strong>, y ábrelo desde ese icono.</p>';
    } else {
      push = `<div><button type="button" class="boton boton--primario" id="srv-push">${icono('campana', 15)} Activar avisos en este ${escapar(yo?.nombre ?? 'dispositivo')}</button></div>`;
    }
    return `<section class="grupo" id="seccion-avisos" aria-label="Avisos en el móvil">${cabecera}
          <div class="estado-cuenta ${e.error || e.googleCaducado ? '' : 'ok'}"><span class="punto"></span>${
            e.error ? escapar(e.error) : `<span>Conectado como <strong>${escapar(e.email ?? '')}</strong></span>`
          }</div>
          ${
            e.googleCaducado
              ? `<p class="ajuste__ayuda aviso-instalar">Google ha retirado el permiso del servidor: ${e.puedeVincularConGoogle ? 'vuelve a conectar.' : 'vuelve a conectar desde el móvil.'}</p>${
                  e.puedeVincularConGoogle ? `<div><button type="button" class="boton boton--primario" id="srv-conectar">Volver a conectar</button></div>` : ''
                }`
              : ''
          }
          ${push}
          <p class="mensaje-ajuste" id="mensaje-avisos" role="status"></p>
          <div class="permisos">
            <span class="permisos__grupo">Qué te aviso</span>
            ${interruptorAviso('correo', 'Correos nuevos', a.correo, 'Las automatizaciones avisan aparte, a su manera.')}
            ${interruptorAviso('soloPrincipal', 'Solo lo principal', a.soloPrincipal, 'Sin promociones, redes sociales ni foros.')}
            <div class="ajuste ajuste--fila">
              <label class="ajuste__etiqueta" for="srv-cada">Mirar el correo</label>
              <div style="width:150px"><select class="campo" id="srv-cada">${opciones([[1, 'Cada minuto'], [2, 'Cada 2 min'], [5, 'Cada 5 min'], [15, 'Cada 15 min']], a.correoCadaMin)}</select></div>
            </div>
            <div class="ajuste ajuste--fila">
              <label class="ajuste__etiqueta" for="srv-citas">Antes de cada cita</label>
              <div style="width:150px"><select class="campo" id="srv-citas">${opciones([[0, 'No avisar'], [5, '5 min antes'], [10, '10 min antes'], [15, '15 min antes'], [30, '30 min antes'], [60, '1 hora antes']], a.citas)}</select></div>
            </div>
            ${interruptorAviso('silencio', 'Silencio de noche', a.silencio?.activo, 'Sin avisos de correo en esas horas; los recordatorios y las citas sí suenan.')}
            <div class="formulario__fila" ${a.silencio?.activo ? '' : 'hidden'} id="srv-horas">
              <select class="campo" id="srv-desde" aria-label="Desde">${opciones(horas.map((h) => [h, `Desde las ${h}`]), a.silencio?.desde)}</select>
              <select class="campo" id="srv-hasta" aria-label="Hasta">${opciones(horas.map((h) => [h, `Hasta las ${h}`]), a.silencio?.hasta)}</select>
            </div>
            <span class="permisos__grupo">IA en el servidor</span>
            ${interruptorAviso('openai', 'Usar mi clave de OpenAI en el servidor', e.openai, 'GPT-6 Luna para crear eventos desde los correos y puntuar las alertas de empleo. Si están las dos, se usa esta. Se guarda cifrada en tu servidor.')}
            ${interruptorAviso('groq', 'Usar mi clave de Groq en el servidor', e.groq, 'Lo mismo, gratis, con los modelos de Groq. Se guarda cifrada en tu servidor.')}
            <span class="permisos__grupo">Dispositivos</span>
            <ul class="dispositivos">
              ${(e.dispositivos ?? [])
                .map(
                  (d) => `<li><span>${escapar(d.nombre)}${d.yo ? ' <em>(este)</em>' : ''}</span><span class="dispositivos__estado">${d.push ? 'Avisos activos' : 'Sin avisos push'}</span>${
                    d.yo ? '' : `<button type="button" class="boton-borrar" data-quitar="${escapar(d.id)}" aria-label="Quitar ${escapar(d.nombre)}">${icono('papelera', 15)}</button>`
                  }</li>`,
                )
                .join('')}
            </ul>
            <div class="botonera"><button type="button" class="boton" id="srv-codigo">Vincular otro dispositivo</button></div>
            <p class="codigo-vinculo" id="srv-codigo-ver" hidden></p>
          </div>
          ${campoUrl}
          <div class="botonera"><button type="button" class="boton boton--peligro" id="srv-desvincular">${escritorio ? 'Desvincular este ordenador' : 'Desconectar y borrar los datos del servidor'}</button></div>
        </section>`;
  }

  const interruptorAviso = (clave, etiqueta, valor, ayuda) => `
    <div class="ajuste ajuste--fila">
      <div><div class="ajuste__etiqueta" id="et-srv-${clave}">${etiqueta}</div>${ayuda ? `<p class="ajuste__ayuda">${ayuda}</p>` : ''}</div>
      <button type="button" class="interruptor" role="switch" aria-labelledby="et-srv-${clave}" data-aviso="${clave}" aria-checked="${Boolean(valor)}"></button>
    </div>`;

  function conectarAvisos(e) {
    const $ = (sel) => contenedor.querySelector(sel);
    const mensaje = (texto, ok = true) => mostrarMensaje('mensaje-avisos', texto, ok);
    const repintar = async (texto) => {
      await pintar('avisos');
      if (texto) mostrarMensaje('mensaje-avisos', texto, true);
    };
    const accion = (boton, funcion) =>
      boton?.addEventListener('click', async () => {
        boton.disabled = true;
        try {
          await funcion();
        } catch (error) {
          mensaje(error.message, false);
        } finally {
          boton.disabled = false;
        }
      });

    $('#srv-url')?.addEventListener('change', async (ev) => {
      const valor = ev.target.value.trim().replace(/\/+$/, '');
      if (valor && !/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(valor)) return mensaje('La dirección debe empezar por https:// y no llevar ruta.', false);
      if (await guardar({ servidorUrl: valor })) await repintar('Dirección guardada.');
    });

    // Sin esperas antes de abrir Google: Safari solo deja abrir la ventana dentro del toque.
    $('#srv-conectar')?.addEventListener('click', () => {
      const espera = api.servidor.conectar();
      mensaje('Da permiso en la ventana de Google y vuelve aquí…');
      espera.then(() => repintar('Conectado. Ahora activa los avisos en este dispositivo.')).catch((error) => mensaje(error.message, false));
    });
    $('#srv-canje')?.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      try {
        await api.servidor.canjear(ev.target.codigo.value);
        await repintar('Vinculado.');
      } catch (error) {
        mensaje(error.message, false);
      }
    });
    // El permiso de notificaciones se pide en el propio toque.
    $('#srv-push')?.addEventListener('click', () => {
      api.servidor
        .activarPush()
        .then(() => api.servidor.probar())
        .then(() => repintar('Listo: te acaba de llegar un aviso de prueba.'))
        .catch((error) => mensaje(error.message, false));
    });
    accion($('#srv-push-no'), async () => {
      await api.servidor.desactivarPush();
      await repintar('Avisos desactivados en este dispositivo.');
    });
    accion($('#srv-probar'), async () => {
      await api.servidor.probar();
      mensaje('Enviado: debería llegarte en unos segundos.');
    });

    const avisos = structuredClone(e.avisos ?? {});
    const guardarAvisos = async () => {
      try {
        Object.assign(avisos, await api.servidor.avisos(avisos));
      } catch (error) {
        mensaje(error.message, false);
      }
    };
    contenedor.querySelectorAll('[data-aviso]').forEach((b) =>
      b.addEventListener('click', async () => {
        const clave = b.dataset.aviso;
        const nuevo = b.getAttribute('aria-checked') !== 'true';
        b.disabled = true;
        try {
          if (clave === 'groq') await api.servidor.groq(nuevo);
          else if (clave === 'openai') await api.servidor.openai(nuevo);
          else if (clave === 'silencio') {
            avisos.silencio = { ...avisos.silencio, activo: nuevo };
            $('#srv-horas').hidden = !nuevo;
            await guardarAvisos();
          } else {
            avisos[clave] = nuevo;
            await guardarAvisos();
          }
          b.setAttribute('aria-checked', String(nuevo));
        } catch (error) {
          mensaje(error.message, false);
        } finally {
          b.disabled = false;
        }
      }),
    );
    $('#srv-cada')?.addEventListener('change', (ev) => {
      avisos.correoCadaMin = Number(ev.target.value);
      guardarAvisos();
    });
    $('#srv-citas')?.addEventListener('change', (ev) => {
      avisos.citas = Number(ev.target.value);
      guardarAvisos();
    });
    for (const [id, campo] of [['#srv-desde', 'desde'], ['#srv-hasta', 'hasta']]) {
      $(id)?.addEventListener('change', (ev) => {
        avisos.silencio = { ...avisos.silencio, [campo]: ev.target.value };
        guardarAvisos();
      });
    }

    contenedor.querySelectorAll('[data-quitar]').forEach((b) =>
      accion(b, async () => {
        await api.servidor.quitarDispositivo(b.dataset.quitar);
        await repintar('Dispositivo quitado.');
      }),
    );
    accion($('#srv-codigo'), async () => {
      const { codigo } = await api.servidor.crearCodigo();
      const ver = $('#srv-codigo-ver');
      ver.innerHTML = `Escribe <strong>${codigo.slice(0, 3)} ${codigo.slice(3)}</strong> en el otro dispositivo (Ajustes → Avisos en el móvil). Vale 10 minutos.`;
      ver.hidden = false;
    });
    let confirmando = false;
    accion($('#srv-desvincular'), async () => {
      const boton = $('#srv-desvincular');
      if (!confirmando) {
        confirmando = true;
        boton.dataset.texto = boton.textContent;
        boton.textContent = '¿Seguro? Pulsa otra vez';
        setTimeout(() => {
          confirmando = false;
          if (boton.isConnected) boton.textContent = boton.dataset.texto;
        }, 4000);
        return;
      }
      await api.servidor.desvincular();
      await repintar('Desconectado.');
    });
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
    contenedor.querySelectorAll('[data-preajuste]').forEach((b) =>
      b.addEventListener('click', async () => {
        const cambios = nivelesPreajuste(b.dataset.preajuste);
        if (!(await guardar(cambios, { donde: 'mensaje-permisos', texto: `Hecho: ${b.textContent.toLowerCase()}.` }))) return;
        for (const [clave, valor] of Object.entries(cambios)) {
          contenedor.querySelectorAll(`[data-clave="${clave}"]`).forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.valor === valor)));
        }
      }),
    );
    contenedor.querySelector('#voz-probar')?.addEventListener('click', async (e) => {
      const boton = e.currentTarget;
      boton.disabled = true;
      try {
        await probarVoz();
        mostrarMensaje('mensaje-voz', '', true);
      } catch (error) {
        mostrarMensaje('mensaje-voz', error.message, false);
      } finally {
        boton.disabled = false;
      }
    });
    const bloque = contenedor.querySelector('#ajuste-bloqueo');
    if (bloque) {
      bloqueoDisponible().then((ok) => (bloque.hidden = !ok));
      const interruptorBloqueo = bloque.querySelector('#bloqueo-interruptor');
      interruptorBloqueo.addEventListener('click', async () => {
        const activo = interruptorBloqueo.getAttribute('aria-checked') === 'true';
        try {
          if (activo) {
            if (sincroAqui) throw new Error('Mientras sincronizas, Kitsune va protegido con Face ID en este iPhone (lleva tus claves). Deja de sincronizar para quitarlo.');
            // Para quitarlo también hay que ser tú.
            if (!(await comprobarIdentidad())) throw new Error('No se ha podido comprobar que eres tú.');
            desactivarBloqueo();
          } else {
            await activarBloqueo(Number(bloque.querySelector('#bloqueo-tras').value) || 1);
          }
          const ahora = Boolean(leerBloqueo());
          interruptorBloqueo.setAttribute('aria-checked', String(ahora));
          bloque.querySelector('#bloqueo-tras-fila').hidden = !ahora;
          mostrarMensaje('mensaje-bloqueo', ahora ? `Listo: Kitsune te pedirá ${nombreBiometria()}.` : 'Bloqueo quitado.', true);
        } catch (error) {
          mostrarMensaje('mensaje-bloqueo', error.name === 'NotAllowedError' ? 'Cancelado.' : error.message, false);
        }
      });
      bloque.querySelector('#bloqueo-tras').addEventListener('change', (e) => cambiarTras(Number(e.target.value)));
    }
    contenedor.querySelector('#vs-cargar')?.addEventListener('click', async () => {
      const selector = contenedor.querySelector('#ajuste-vs-voz');
      try {
        const voces = await vocesVoiceStudio();
        selector.innerHTML = voces.map((v) => `<option value="${escapar(v.id)}" ${v.id === ajustes.voicestudioVoz ? 'selected' : ''}>${escapar(v.nombre)}${v.idioma ? ` · ${escapar(v.idioma)}` : ''}</option>`).join('');
        mostrarMensaje('mensaje-vs', `${voces.length - 1} voces tuyas en VoiceStudio.`, true);
      } catch (error) {
        mostrarMensaje('mensaje-vs', error.message, false);
      }
    });
    contenedor.querySelector('[data-enlace-externo]')?.addEventListener('click', (e) => {
      e.preventDefault();
      api.ventana.abrirEnlace(e.currentTarget.href);
    });
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
