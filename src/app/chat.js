import { icono } from './iconos.js';
import { markdownAHtml } from './markdown.js';
import { cuandoLegible } from './fechas.js';

const PEDIR_PULSO = 'Prepárame el pulso de hoy';
const CLAVE_PULSO = 'kitsune.pulso';

const ETIQUETAS_HERRAMIENTA = {
  buscar_correos: 'Revisando tu correo…',
  leer_correo: 'Leyendo el correo…',
  crear_recordatorio: 'Apuntando el recordatorio…',
  ver_recordatorios: 'Mirando tus recordatorios…',
  borrar_recordatorio: 'Borrando el recordatorio…',
};

const leerPulso = () => {
  try {
    return localStorage.getItem(CLAVE_PULSO);
  } catch {
    return null;
  }
};
const marcarPulso = () => {
  try {
    localStorage.setItem(CLAVE_PULSO, new Date().toDateString());
  } catch {
    // Sin almacenamiento: la tarjeta volverá a salir, nada más.
  }
};

// Vista de chat. alEstado(nombre, datos) avisa al zorro: 'escuchar', 'pensar',
// 'hablar' (con el trozo de texto que llega), 'reposo' o 'fin' (con la respuesta, para la voz).
export function crearChat({ contenedor, api, alEstado, abrirAjustes, obtenerAjustes }) {
  // El dictado del navegador no funciona dentro de Electron (necesita los servicios de Google).
  const Reconocimiento = api.plataforma === 'electron' ? null : window.SpeechRecognition || window.webkitSpeechRecognition;
  const sugerencias = ['¿Tengo correos sin leer?', PEDIR_PULSO, api.demo ? 'Ayúdame a responder a Lucía' : 'Recuérdame mirar el correo en una hora'];

  contenedor.innerHTML = `
    <div class="chat__mensajes desplazable" id="chat-mensajes" role="log" aria-live="polite" aria-relevant="additions"></div>
    <form class="compositor" id="chat-formulario">
      <button type="button" class="icono-boton" id="chat-nueva" aria-label="Nueva conversación" title="Nueva conversación">${icono('nueva')}</button>
      <textarea id="chat-entrada" rows="1" placeholder="Escribe a Kitsune…" aria-label="Mensaje para Kitsune"></textarea>
      ${Reconocimiento ? `<button type="button" class="icono-boton boton-micro" id="chat-micro" aria-label="Dictar" aria-pressed="false" title="Dictar">${icono('microfono')}</button>` : ''}
      <button type="submit" class="boton-enviar" id="chat-enviar" aria-label="Enviar">${icono('enviar', 17)}</button>
    </form>`;

  const mensajes = contenedor.querySelector('#chat-mensajes');
  const formulario = contenedor.querySelector('#chat-formulario');
  const entrada = contenedor.querySelector('#chat-entrada');
  const botonEnviar = contenedor.querySelector('#chat-enviar');
  const botonMicro = contenedor.querySelector('#chat-micro');
  let restaurado = false;

  let ocupado = false;
  let burbuja = null;
  let texto = '';
  let respuestaCompleta = '';
  let estado = null;
  let pintadoPendiente = false;

  const alFinal = () => mensajes.scrollHeight - mensajes.scrollTop - mensajes.clientHeight < 60;
  const bajar = (forzar = false) => {
    if (forzar || alFinal()) mensajes.scrollTop = mensajes.scrollHeight;
  };

  function vacio() {
    const pulso = obtenerAjustes().pulsoDiario && leerPulso() !== new Date().toDateString();
    mensajes.innerHTML = `
      <div class="chat__vacio">
        ${
          pulso
            ? `<div class="pulso">
          <span class="pulso__latido" aria-hidden="true">${icono('pulso', 18)}</span>
          <div class="pulso__texto"><p class="pulso__titulo">Tu pulso de hoy</p><p>Lo urgente del correo y tus recordatorios, en un vistazo.</p></div>
          <button type="button" class="boton boton--primario" id="chat-pulso">Prepárame el día</button>
        </div>`
            : ''
        }
        <p class="chat__saludo">Hola, soy Kitsune.</p>
        <p>Pregúntame lo que quieras, pídeme que revise tu correo o que te recuerde algo.</p>
        <div class="sugerencias">${sugerencias.map((s) => `<button type="button">${s}</button>`).join('')}</div>
      </div>`;
    mensajes.querySelector('#chat-pulso')?.addEventListener('click', () => preguntar(PEDIR_PULSO));
    mensajes.querySelectorAll('.sugerencias button').forEach((b) => b.addEventListener('click', () => preguntar(b.textContent)));
  }

  // Nota en el chat al apuntar un recordatorio (con deshacer) o cuando llega su hora.
  function notaRecordatorio(r, aviso = false) {
    const div = añadir(`nota-recordatorio${aviso ? ' nota-recordatorio--aviso' : ''}`, `
      <span class="nota-recordatorio__icono">${icono('campana', 16)}</span>
      <div class="nota-recordatorio__cuerpo"><span class="nota-recordatorio__cuando"></span><span class="nota-recordatorio__texto"></span></div>
      ${aviso ? '' : '<button type="button" class="boton">Deshacer</button>'}`);
    div.querySelector('.nota-recordatorio__cuando').textContent = aviso ? 'Es la hora' : `Recordatorio · ${cuandoLegible(r.cuando)}`;
    div.querySelector('.nota-recordatorio__texto').textContent = r.texto;
    const deshacer = div.querySelector('button');
    deshacer?.addEventListener('click', async () => {
      deshacer.disabled = true;
      try {
        await api.recordatorios.borrar(r.id);
        div.classList.add('nota-recordatorio--borrada');
        deshacer.textContent = 'Borrado';
      } catch {
        deshacer.disabled = false;
      }
    });
  }

  // Al volver a abrir la app, la conversación sigue donde estaba.
  async function restaurar() {
    restaurado = true;
    const anteriores = (await api.claude.mensajes?.().catch(() => [])) ?? [];
    if (!anteriores.length || mensajes.querySelector('.burbuja')) return false;
    for (const m of anteriores) {
      if (m.rol === 'usuario') añadir('burbuja--usuario', m.texto, true);
      else añadir('burbuja--kitsune', markdownAHtml(m.texto));
    }
    return true;
  }

  function sinClave() {
    mensajes.innerHTML = `
      <div class="tarjeta-aviso">
        <h2>Conecta a Claude</h2>
        <p>Para hablar conmigo necesito tu clave de la API de Claude. Se guarda cifrada ${api.plataforma === 'web' ? 'en este navegador' : 'en este equipo'}.</p>
        <button type="button" class="boton boton--primario" id="chat-ir-ajustes">${icono('llave', 16)} Añadir la clave</button>
      </div>`;
    mensajes.querySelector('#chat-ir-ajustes').addEventListener('click', () => abrirAjustes('claude'));
  }

  function ponerEstado(etiqueta) {
    if (!estado) {
      estado = document.createElement('p');
      estado.className = 'chat__estado';
      mensajes.append(estado);
    }
    estado.innerHTML = `<span class="puntos" aria-hidden="true"><i></i><i></i><i></i></span>${etiqueta}`;
    bajar();
  }

  function quitarEstado() {
    estado?.remove();
    estado = null;
  }

  function añadir(clase, contenido, comoTexto = false) {
    mensajes.querySelector('.chat__vacio')?.remove();
    const div = document.createElement('div');
    div.className = `burbuja ${clase}`;
    if (comoTexto) div.textContent = contenido;
    else div.innerHTML = contenido;
    if (estado) mensajes.insertBefore(div, estado);
    else mensajes.append(div);
    bajar(true);
    return div;
  }

  function error(mensaje) {
    const div = añadir('burbuja--error', `${icono('alerta', 16)}<span></span>`);
    div.querySelector('span').textContent = mensaje;
    if (/Ajustes/.test(mensaje)) {
      const boton = document.createElement('button');
      boton.type = 'button';
      boton.className = 'boton';
      boton.textContent = 'Abrir ajustes';
      boton.addEventListener('click', () => abrirAjustes('claude'));
      div.append(boton);
    }
  }

  function pintar() {
    pintadoPendiente = false;
    if (burbuja) burbuja.innerHTML = markdownAHtml(texto);
    bajar();
  }

  function cerrarBloque() {
    if (burbuja) pintar();
    respuestaCompleta += texto ? `${texto}\n\n` : '';
    burbuja = null;
    texto = '';
  }

  function ocupar(si) {
    ocupado = si;
    botonEnviar.innerHTML = si ? icono('parar', 15) : icono('enviar', 17);
    botonEnviar.setAttribute('aria-label', si ? 'Detener la respuesta' : 'Enviar');
    actualizarBoton();
  }

  function actualizarBoton() {
    botonEnviar.disabled = !ocupado && !entrada.value.trim();
  }

  function ajustarAltura() {
    entrada.style.height = 'auto';
    entrada.style.height = `${Math.min(entrada.scrollHeight, 120)}px`;
  }

  api.claude.alEvento((e) => {
    switch (e.tipo) {
      case 'pensando':
        if (!burbuja) ponerEstado('Pensando…');
        alEstado('pensar');
        break;
      case 'herramienta':
        ponerEstado(ETIQUETAS_HERRAMIENTA[e.nombre] ?? 'Un momento…');
        alEstado('pensar');
        break;
      case 'recordatorio':
        notaRecordatorio(e.recordatorio);
        break;
      case 'texto':
        quitarEstado();
        if (!burbuja) burbuja = añadir('burbuja--kitsune', '');
        texto += e.delta;
        if (!pintadoPendiente) {
          pintadoPendiente = true;
          requestAnimationFrame(pintar);
        }
        alEstado('hablar', e.delta);
        break;
      case 'nuevo-bloque':
        cerrarBloque();
        break;
      case 'descartar':
        burbuja?.remove();
        burbuja = null;
        texto = '';
        break;
      case 'rechazo':
        burbuja?.remove();
        burbuja = null;
        texto = '';
        quitarEstado();
        error('Claude no puede ayudar con esta petición. Prueba a plantearla de otra forma.');
        alEstado('reposo');
        break;
      case 'cancelado':
        cerrarBloque();
        quitarEstado();
        alEstado('reposo');
        break;
      case 'error':
        cerrarBloque();
        quitarEstado();
        error(e.mensaje);
        alEstado('reposo');
        break;
      case 'fin': {
        cerrarBloque();
        quitarEstado();
        if (e.recortado) error('La respuesta era tan larga que se cortó. Pídeme que continúe.');
        alEstado('fin', respuestaCompleta.trim());
        break;
      }
    }
  });

  async function preguntar(contenido) {
    const limpio = contenido.trim();
    if (!limpio || ocupado) return;
    if (limpio === PEDIR_PULSO) marcarPulso();
    añadir('burbuja--usuario', limpio, true);
    entrada.value = '';
    ajustarAltura();
    respuestaCompleta = '';
    ocupar(true);
    try {
      await api.claude.enviar(limpio);
    } catch (e) {
      quitarEstado();
      error(e.message);
      alEstado('reposo');
    } finally {
      ocupar(false);
    }
  }

  formulario.addEventListener('submit', (e) => {
    e.preventDefault();
    if (ocupado) api.claude.cancelar();
    else preguntar(entrada.value);
  });
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      e.preventDefault();
      formulario.requestSubmit();
    }
  });
  entrada.addEventListener('input', () => {
    ajustarAltura();
    actualizarBoton();
    if (!ocupado) alEstado(entrada.value.trim() ? 'escuchar' : 'reposo');
  });
  entrada.addEventListener('blur', () => {
    if (!ocupado && !entrada.value.trim()) alEstado('reposo');
  });
  contenedor.querySelector('#chat-nueva').addEventListener('click', async () => {
    await api.claude.reiniciar();
    cerrarBloque();
    quitarEstado();
    vacio();
    entrada.focus();
  });

  // ---------- Dictado ----------

  let dictado = null;
  function dictar() {
    if (dictado) {
      dictado.stop();
      return;
    }
    const previo = entrada.value.trim();
    let final = false;
    dictado = new Reconocimiento();
    dictado.lang = 'es-ES';
    dictado.interimResults = true;
    dictado.onresult = (e) => {
      const oido = [...e.results].map((r) => r[0].transcript).join('');
      final = e.results[e.results.length - 1].isFinal;
      entrada.value = previo ? `${previo} ${oido}` : oido;
      ajustarAltura();
      actualizarBoton();
    };
    dictado.onerror = (e) => {
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') error('No tengo permiso para usar el micrófono. Actívalo en los ajustes del navegador.');
      else if (e.error === 'network') error('El dictado necesita conexión a internet.');
    };
    dictado.onend = () => {
      dictado = null;
      botonMicro.classList.remove('escuchando');
      botonMicro.setAttribute('aria-pressed', 'false');
      botonMicro.setAttribute('aria-label', 'Dictar');
      // Como un asistente de voz: al terminar de hablar, se envía.
      if (final && entrada.value.trim()) preguntar(entrada.value);
      else alEstado(entrada.value.trim() ? 'escuchar' : 'reposo');
    };
    try {
      dictado.start();
    } catch {
      dictado = null;
      return;
    }
    botonMicro.classList.add('escuchando');
    botonMicro.setAttribute('aria-pressed', 'true');
    botonMicro.setAttribute('aria-label', 'Dejar de dictar');
    alEstado('escuchar');
  }
  botonMicro?.addEventListener('click', () => {
    if (!ocupado && !entrada.disabled) dictar();
  });

  async function comprobarClave() {
    const { configurado } = await api.claude.estado();
    if (!configurado) sinClave();
    else if (!mensajes.querySelector('.burbuja') && !(!restaurado && (await restaurar()))) vacio();
    entrada.disabled = !configurado;
    if (botonMicro) botonMicro.disabled = !configurado;
    actualizarBoton();
  }

  comprobarClave();
  return {
    enfocar: () => entrada.focus(),
    preguntar,
    comprobarClave,
    // Texto compartido desde otra app: se deja escrito para que el usuario lo envíe.
    rellenar(texto) {
      entrada.value = texto;
      ajustarAltura();
      actualizarBoton();
      alEstado('escuchar');
    },
    avisoRecordatorio: (r) => {
      mensajes.querySelector('.chat__vacio')?.remove();
      notaRecordatorio(r, true);
    },
  };
}
