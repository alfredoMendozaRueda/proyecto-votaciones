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
  web_search: 'Buscando en internet…',
  web_fetch: 'Leyendo la página…',
  ver_agenda: 'Mirando tu agenda…',
  crear_evento: 'Preparando el evento…',
  recordar: 'Apuntándolo en mi memoria…',
  olvidar: 'Olvidándolo…',
};

// Acciones para un texto copiado (Windows) o compartido desde otra app (móvil).
const ACCIONES_TEXTO = [
  ['Resumir', 'Resume este texto en pocas líneas'],
  ['Traducir', 'Traduce este texto al español; si ya está en español, tradúcelo al inglés'],
  ['Mejorar', 'Mejora la redacción de este texto sin cambiar el idioma ni el tono. Devuelve solo el texto mejorado'],
  ['Explicar', 'Explícame este texto de forma sencilla'],
];

const fechaEvento = (e) =>
  e.todoElDia
    ? new Date(e.inicio).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    : `${cuandoLegible(e.inicio)} – ${new Date(e.fin).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;

async function copiar(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    // Sin permiso para el portapapeles (http, iframes): el método antiguo.
    const campo = Object.assign(document.createElement('textarea'), { value: texto });
    campo.style.cssText = 'position:fixed;opacity:0';
    document.body.append(campo);
    campo.select();
    const ok = document.execCommand('copy');
    campo.remove();
    return ok;
  }
}

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

  // Nota pequeña en el chat (recordatorio, memoria, cita), con un botón opcional para deshacer.
  function nota({ simbolo, etiqueta, texto, aviso = false, deshacer = null }) {
    const div = añadir(`nota-recordatorio${aviso ? ' nota-recordatorio--aviso' : ''}`, `
      <span class="nota-recordatorio__icono">${icono(simbolo, 16)}</span>
      <div class="nota-recordatorio__cuerpo"><span class="nota-recordatorio__cuando"></span><span class="nota-recordatorio__texto"></span></div>
      ${deshacer ? `<button type="button" class="boton">${deshacer.etiqueta}</button>` : ''}`);
    div.querySelector('.nota-recordatorio__cuando').textContent = etiqueta;
    div.querySelector('.nota-recordatorio__texto').textContent = texto;
    const boton = div.querySelector('button');
    boton?.addEventListener('click', async () => {
      boton.disabled = true;
      try {
        await deshacer.accion();
        div.classList.add('nota-recordatorio--borrada');
        boton.textContent = deshacer.hecho;
      } catch {
        boton.disabled = false;
      }
    });
    return div;
  }

  function notaRecordatorio(r, aviso = false) {
    nota({
      simbolo: 'campana',
      etiqueta: aviso ? 'Es la hora' : `Recordatorio · ${cuandoLegible(r.cuando)}`,
      texto: r.texto,
      aviso,
      deshacer: aviso ? null : { etiqueta: 'Deshacer', hecho: 'Borrado', accion: () => api.recordatorios.borrar(r.id) },
    });
  }

  // Claude pide permiso antes de crear un evento: el usuario decide aquí.
  function tarjetaConfirmar({ id, accion }) {
    const div = añadir('confirmar', `
      <span class="confirmar__icono">${icono('calendario', 18)}</span>
      <div class="confirmar__cuerpo">
        <span class="confirmar__pregunta">¿Lo añado a tu calendario?</span>
        <strong class="confirmar__titulo"></strong>
        <span class="confirmar__detalle"></span>
      </div>
      <div class="confirmar__botones">
        <button type="button" class="boton boton--primario" data-si>Añadir</button>
        <button type="button" class="boton" data-no>No</button>
      </div>`);
    div.querySelector('.confirmar__titulo').textContent = accion.titulo;
    div.querySelector('.confirmar__detalle').textContent = [fechaEvento(accion), accion.lugar].filter(Boolean).join(' · ');
    const responder = (acepta) => {
      div.querySelectorAll('button').forEach((b) => (b.disabled = true));
      div.querySelector('.confirmar__pregunta').textContent = acepta ? 'Añadiendo al calendario…' : 'No se ha añadido.';
      div.classList.toggle('confirmar--no', !acepta);
      div.dataset.estado = acepta ? 'esperando' : 'no';
      api.claude.confirmar(id, acepta);
      alEstado('pensar');
    };
    div.querySelector('[data-si]').addEventListener('click', () => responder(true));
    div.querySelector('[data-no]').addEventListener('click', () => responder(false));
    alEstado('escuchar');
  }

  // Enlaces a las páginas que citó la búsqueda web, debajo de la respuesta.
  function ponerFuentes(fuentes) {
    const ultima = burbuja ?? [...mensajes.querySelectorAll('.burbuja--kitsune')].at(-1);
    if (!ultima) return;
    let lista = ultima.nextElementSibling?.classList.contains('fuentes') ? ultima.nextElementSibling : null;
    if (!lista) {
      lista = document.createElement('div');
      lista.className = 'fuentes';
      lista.innerHTML = '<span class="fuentes__titulo">Fuentes</span>';
      ultima.after(lista);
    }
    for (const f of fuentes.slice(0, 5)) {
      const enlace = document.createElement('button');
      enlace.type = 'button';
      enlace.className = 'fuentes__enlace';
      enlace.title = f.url;
      enlace.textContent = f.titulo.length > 42 ? `${f.titulo.slice(0, 40)}…` : f.titulo;
      enlace.addEventListener('click', () => api.ventana.abrirEnlace(f.url));
      lista.append(enlace);
    }
  }

  // Botón para copiar una respuesta terminada (útil tras "Mejorar" o "Traducir").
  function ponerCopiar(div, contenido) {
    if (!contenido.trim()) return;
    const boton = document.createElement('button');
    boton.type = 'button';
    boton.className = 'burbuja__copiar';
    boton.setAttribute('aria-label', 'Copiar la respuesta');
    boton.title = 'Copiar';
    boton.innerHTML = icono('copiar', 14);
    boton.addEventListener('click', async () => {
      if (await copiar(contenido)) {
        boton.innerHTML = icono('hecho', 14);
        boton.setAttribute('aria-label', 'Copiada');
        setTimeout(() => {
          boton.innerHTML = icono('copiar', 14);
          boton.setAttribute('aria-label', 'Copiar la respuesta');
        }, 1500);
      }
    });
    div.append(boton);
  }

  // Texto copiado o compartido: Kitsune propone qué hacer con él.
  function ofrecerTexto(textoRecibido, origen = 'copiado') {
    mensajes.querySelector('.texto-ofrecido')?.remove();
    const limpio = textoRecibido.trim().slice(0, 8000);
    const div = añadir('texto-ofrecido', `
      <div class="texto-ofrecido__cabecera"><span>${icono('clip', 15)} Texto ${origen}</span>
        <button type="button" class="icono-boton" data-cerrar aria-label="Descartar el texto">${icono('cerrar', 15)}</button></div>
      <p class="texto-ofrecido__extracto"></p>
      <div class="texto-ofrecido__acciones">${ACCIONES_TEXTO.map(([nombre], i) => `<button type="button" class="boton" data-accion="${i}">${nombre}</button>`).join('')}</div>`);
    const extracto = limpio.length > 180 ? `${limpio.slice(0, 180)}…` : limpio;
    div.querySelector('.texto-ofrecido__extracto').textContent = `«${extracto}»`;
    div.querySelector('[data-cerrar]').addEventListener('click', () => div.remove());
    div.querySelectorAll('[data-accion]').forEach((b) =>
      b.addEventListener('click', () => {
        const [nombre, instruccion] = ACCIONES_TEXTO[Number(b.dataset.accion)];
        div.remove();
        const corto = limpio.length > 60 ? `${limpio.slice(0, 60)}…` : limpio;
        preguntar(`${instruccion}:\n\n<texto>\n${limpio}\n</texto>`, `${nombre}: «${corto}»`);
      }),
    );
    alEstado('escuchar');
  }

  // Al volver a abrir la app, la conversación sigue donde estaba.
  async function restaurar() {
    restaurado = true;
    const anteriores = (await api.claude.mensajes?.().catch(() => [])) ?? [];
    if (!anteriores.length || mensajes.querySelector('.burbuja')) return false;
    pintarMensajes(anteriores);
    return true;
  }

  function pintarMensajes(lista) {
    for (const m of lista) {
      if (m.rol === 'usuario') añadir('burbuja--usuario', m.texto, true);
      else ponerCopiar(añadir('burbuja--kitsune', markdownAHtml(m.texto)), m.texto);
    }
  }

  // Abre una conversación del historial en el chat.
  function cargar(lista) {
    if (ocupado) return;
    cerrarBloque();
    quitarEstado();
    mensajes.innerHTML = '';
    if (lista.length) pintarMensajes(lista);
    else vacio();
    mensajes.scrollTop = mensajes.scrollHeight;
  }

  async function nueva() {
    await api.claude.reiniciar();
    cerrarBloque();
    quitarEstado();
    vacio();
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
    if (burbuja) {
      pintar();
      ponerCopiar(burbuja, texto);
    }
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
      case 'memoria':
        nota({
          simbolo: 'memoria',
          etiqueta: 'Lo recordaré',
          texto: e.dato.texto,
          deshacer: { etiqueta: 'Olvidar', hecho: 'Olvidado', accion: () => api.memoria.olvidar(e.dato.id) },
        });
        break;
      case 'confirmar':
        quitarEstado();
        tarjetaConfirmar(e);
        break;
      case 'evento': {
        const tarjeta = [...mensajes.querySelectorAll('.confirmar[data-estado="esperando"]')].at(-1);
        if (tarjeta) {
          tarjeta.dataset.estado = 'hecho';
          tarjeta.classList.add('confirmar--hecho');
          tarjeta.querySelector('.confirmar__pregunta').textContent = 'Añadido a tu calendario';
        }
        break;
      }
      case 'fuentes':
        ponerFuentes(e.fuentes);
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

  // mostrado: lo que se ve en la burbuja si no es lo mismo que se envía (acciones con texto).
  async function preguntar(contenido, mostrado = null) {
    const limpio = contenido.trim();
    if (!limpio || ocupado) return;
    if (limpio === PEDIR_PULSO) marcarPulso();
    añadir('burbuja--usuario', mostrado ?? limpio, true);
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
    // Para que Claude pueda mirar tu correo y tu agenda, la sesión de Google se renueva con este toque.
    if (!ocupado) api.correo.renovar?.();
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
    await nueva();
    // En táctil, enfocar abriría el teclado sin pedirlo.
    if (!matchMedia('(pointer: coarse)').matches) entrada.focus();
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
    avisoRecordatorio: (r) => notaRecordatorio(r, true),
    avisoCita: (cita) =>
      nota({
        simbolo: 'calendario',
        etiqueta: `Cita · ${cuandoLegible(cita.inicio)}`,
        texto: [cita.titulo, cita.lugar].filter(Boolean).join(' · '),
        aviso: true,
      }),
    ofrecerTexto,
    cargar,
    nueva,
  };
}
