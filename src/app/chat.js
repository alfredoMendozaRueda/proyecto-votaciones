import { icono } from './iconos.js';
import { markdownAHtml } from './markdown.js';

const SUGERENCIAS = ['¿Tengo correos sin leer?', 'Resume lo más urgente de hoy', 'Ayúdame a responder a Lucía'];

// Vista de chat. alEstado(nombre, datos) avisa al zorro: 'escuchar', 'pensar',
// 'hablar', 'reposo' o 'fin' (con el texto de la respuesta, para la voz).
export function crearChat({ contenedor, api, alEstado, abrirAjustes }) {
  contenedor.innerHTML = `
    <div class="chat__mensajes desplazable" id="chat-mensajes" role="log" aria-live="polite" aria-relevant="additions"></div>
    <form class="compositor" id="chat-formulario">
      <button type="button" class="icono-boton" id="chat-nueva" aria-label="Nueva conversación" title="Nueva conversación">${icono('nueva')}</button>
      <textarea id="chat-entrada" rows="1" placeholder="Escribe a Kitsune…" aria-label="Mensaje para Kitsune"></textarea>
      <button type="submit" class="boton-enviar" id="chat-enviar" aria-label="Enviar">${icono('enviar', 17)}</button>
    </form>`;

  const mensajes = contenedor.querySelector('#chat-mensajes');
  const formulario = contenedor.querySelector('#chat-formulario');
  const entrada = contenedor.querySelector('#chat-entrada');
  const botonEnviar = contenedor.querySelector('#chat-enviar');

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
    mensajes.innerHTML = `
      <div class="chat__vacio">
        <p class="chat__saludo">Hola, soy Kitsune.</p>
        <p>Pregúntame lo que quieras o pídeme que revise tu correo.</p>
        <div class="sugerencias">${SUGERENCIAS.map((s) => `<button type="button">${s}</button>`).join('')}</div>
      </div>`;
    mensajes.querySelectorAll('.sugerencias button').forEach((b) => b.addEventListener('click', () => preguntar(b.textContent)));
  }

  function sinClave() {
    mensajes.innerHTML = `
      <div class="tarjeta-aviso">
        <h2>Conecta a Claude</h2>
        <p>Para hablar conmigo necesito tu clave de la API de Claude. Se guarda cifrada en este ordenador.</p>
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
        ponerEstado('Revisando tu correo…');
        alEstado('pensar');
        break;
      case 'texto':
        quitarEstado();
        if (!burbuja) burbuja = añadir('burbuja--kitsune', '');
        texto += e.delta;
        if (!pintadoPendiente) {
          pintadoPendiente = true;
          requestAnimationFrame(pintar);
        }
        alEstado('hablar');
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

  async function comprobarClave() {
    const { configurado } = await api.claude.estado();
    if (!configurado) sinClave();
    else if (!mensajes.querySelector('.burbuja')) vacio();
    entrada.disabled = !configurado;
    actualizarBoton();
  }

  comprobarClave();
  return {
    enfocar: () => entrada.focus(),
    preguntar,
    comprobarClave,
  };
}
