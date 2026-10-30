import DOMPurify from 'dompurify';
import { icono } from './iconos.js';

const FILTROS = [
  ['recibidos', 'Recibidos'],
  ['no-leidos', 'No leídos'],
  ['destacados', 'Destacados'],
];

const escapar = (t = '') => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function fechaCorta(ms) {
  const fecha = new Date(ms);
  const hoy = new Date();
  if (fecha.toDateString() === hoy.toDateString()) {
    return fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  }
  if (fecha.getFullYear() === hoy.getFullYear()) {
    return fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
  }
  return fecha.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

const fechaLarga = (ms) =>
  new Date(ms).toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

// El HTML del correo se sanea y se muestra en un iframe sin scripts ni acceso
// a la app. Las imágenes remotas (y los fondos con url()) se bloquean hasta
// que el usuario las pide: así no avisan al remitente de que lo has abierto.
function prepararHtml(html, permitirImagenes) {
  const limpio = DOMPurify.sanitize(html, {
    FORBID_TAGS: ['form', 'input', 'button', 'textarea', 'select', 'meta', 'base', 'link', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['srcset'],
    ADD_ATTR: ['target'],
  });
  const doc = new DOMParser().parseFromString(`<body>${limpio}</body>`, 'text/html');
  let bloqueadas = 0;
  if (!permitirImagenes) {
    doc.querySelectorAll('img').forEach((img) => {
      if (/^https?:/i.test(img.getAttribute('src') || '')) {
        img.removeAttribute('src');
        img.setAttribute('alt', img.getAttribute('alt') || 'Imagen bloqueada');
        bloqueadas++;
      }
    });
    doc.querySelectorAll('[style]').forEach((el) => {
      const estilo = el.getAttribute('style');
      if (/url\(/i.test(estilo)) {
        el.setAttribute('style', estilo.replace(/url\([^)]*\)/gi, 'none'));
        bloqueadas++;
      }
    });
    doc.querySelectorAll('style').forEach((s) => {
      s.textContent = s.textContent.replace(/url\([^)]*\)/gi, 'none');
    });
  }
  doc.querySelectorAll('a[href]').forEach((a) => {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  });
  const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>
    body{margin:0;padding:14px 16px;font:14px/1.55 'Segoe UI',system-ui,sans-serif;color:#1d1416;background:#f7efe8;overflow-wrap:anywhere}
    img{max-width:100%;height:auto} table{max-width:100%} a{color:#b3122e}
  </style></head><body>${doc.body.innerHTML}</body></html>`;
  return { srcdoc, bloqueadas };
}

export function crearCorreo({ contenedor, api, abrirAjustes, alNoLeidos }) {
  const estado = { filtro: 'recibidos', consulta: '', mensajes: [], siguiente: null, actual: null, imagenes: false };
  let ultimaCarga = 0;

  function sinCuenta() {
    contenedor.innerHTML = `
      <div class="tarjeta-aviso">
        <h2>Conecta tu Gmail</h2>
        <p>Podrás leer, responder y organizar tu correo aquí mismo, y pedirme que lo revise por ti.</p>
        <button type="button" class="boton boton--primario" id="correo-ir-ajustes">${icono('sobre', 16)} Conectar la cuenta</button>
      </div>`;
    contenedor.querySelector('#correo-ir-ajustes').addEventListener('click', () => abrirAjustes('correo'));
  }

  // ---------- Bandeja ----------

  function bandeja() {
    contenedor.innerHTML = `
      <div class="correo__barra">
        <label class="buscador">${icono('buscar', 16)}<input type="search" id="correo-buscar" placeholder="Buscar en el correo" aria-label="Buscar en el correo"></label>
        <button type="button" class="icono-boton" id="correo-actualizar" aria-label="Actualizar" title="Actualizar">${icono('actualizar')}</button>
        <button type="button" class="boton boton--primario" id="correo-redactar">${icono('redactar', 15)} Redactar</button>
      </div>
      <div class="filtros" role="group" aria-label="Filtrar correos">
        ${FILTROS.map(([valor, nombre]) => `<button type="button" data-filtro="${valor}" aria-pressed="${valor === estado.filtro}">${nombre}</button>`).join('')}
      </div>
      <ul class="lista-correos desplazable" id="correo-lista" aria-label="Correos"></ul>`;

    const buscar = contenedor.querySelector('#correo-buscar');
    buscar.value = estado.consulta;
    let pausa;
    buscar.addEventListener('input', () => {
      clearTimeout(pausa);
      pausa = setTimeout(() => {
        estado.consulta = buscar.value.trim();
        cargar();
      }, 350);
    });
    contenedor.querySelector('#correo-actualizar').addEventListener('click', () => cargar());
    contenedor.querySelector('#correo-redactar').addEventListener('click', () => redactar());
    contenedor.querySelectorAll('[data-filtro]').forEach((b) =>
      b.addEventListener('click', () => {
        estado.filtro = b.dataset.filtro;
        contenedor.querySelectorAll('[data-filtro]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
        cargar();
      }),
    );
    pintarLista();
  }

  function pintarLista() {
    const lista = contenedor.querySelector('#correo-lista');
    if (!lista) return;
    if (!estado.mensajes.length) {
      lista.innerHTML = `<li class="lista-vacia">${estado.consulta ? 'No hay correos que coincidan.' : 'No hay correos aquí.'}</li>`;
      return;
    }
    lista.innerHTML = estado.mensajes
      .map(
        (m) => `
        <li class="fila${m.noLeido ? ' no-leida' : ''}" data-id="${m.id}">
          <button type="button" class="estrella" data-accion="destacar" aria-pressed="${m.destacado}" aria-label="${m.destacado ? 'Quitar de destacados' : 'Destacar'}">${icono('estrella', 16)}</button>
          <button type="button" class="fila__abrir" data-accion="abrir">
            <span class="fila__de">${escapar(m.de.nombre)}</span>
            <span class="fila__fecha">${fechaCorta(m.fecha)}</span>
            <span class="fila__asunto">${escapar(m.asunto)}</span>
            <span class="fila__extracto">${escapar(m.extracto)}</span>
          </button>
          <div class="fila__acciones">
            <button type="button" class="icono-boton" data-accion="archivar" aria-label="Archivar" title="Archivar">${icono('archivar', 16)}</button>
            <button type="button" class="icono-boton" data-accion="papelera" aria-label="Mover a la papelera" title="Mover a la papelera">${icono('papelera', 16)}</button>
            <button type="button" class="icono-boton" data-accion="leido" aria-label="${m.noLeido ? 'Marcar como leído' : 'Marcar como no leído'}" title="${m.noLeido ? 'Marcar como leído' : 'Marcar como no leído'}">${icono(m.noLeido ? 'sobreAbierto' : 'sobre', 16)}</button>
          </div>
        </li>`,
      )
      .join('');
    lista.querySelectorAll('[data-accion]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        accionFila(b.closest('.fila').dataset.id, b.dataset.accion);
      }),
    );
  }

  function contarNoLeidos() {
    if (estado.filtro === 'recibidos' && !estado.consulta) alNoLeidos(estado.mensajes.filter((m) => m.noLeido).length);
  }

  async function cargar() {
    const lista = contenedor.querySelector('#correo-lista');
    if (lista) lista.innerHTML = '<li class="esqueleto"></li>'.repeat(5);
    try {
      const { mensajes, siguiente } = await api.correo.listar({ filtro: estado.filtro, consulta: estado.consulta });
      estado.mensajes = mensajes;
      estado.siguiente = siguiente;
      ultimaCarga = Date.now();
      pintarLista();
      contarNoLeidos();
    } catch (e) {
      if (lista) lista.innerHTML = `<li class="lista-vacia">${escapar(e.message)}</li>`;
    }
  }

  async function accionFila(id, accion) {
    const m = estado.mensajes.find((x) => x.id === id);
    if (!m) return;
    if (accion === 'abrir') return leer(id);
    const cambios = {
      destacar: { destacado: !m.destacado },
      leido: { leido: m.noLeido },
      archivar: { archivar: true },
      papelera: { papelera: true },
    }[accion];
    try {
      await api.correo.modificar(id, cambios);
      if (accion === 'archivar' || accion === 'papelera') estado.mensajes = estado.mensajes.filter((x) => x.id !== id);
      if (accion === 'destacar') m.destacado = !m.destacado;
      if (accion === 'leido') m.noLeido = !m.noLeido;
      pintarLista();
      contarNoLeidos();
    } catch (e) {
      avisar(e.message);
    }
  }

  function avisar(mensaje) {
    const aviso = document.createElement('p');
    aviso.className = 'aviso-flotante';
    aviso.setAttribute('role', 'status');
    aviso.textContent = mensaje;
    contenedor.append(aviso);
    setTimeout(() => aviso.remove(), 3500);
  }

  // ---------- Lectura ----------

  async function leer(id) {
    contenedor.innerHTML = '<div class="lectura"><div class="esqueleto" style="height:120px;margin:14px"></div></div>';
    let correo;
    try {
      correo = await api.correo.leer(id);
    } catch (e) {
      contenedor.innerHTML = `<div class="tarjeta-aviso"><h2>No se pudo abrir</h2><p>${escapar(e.message)}</p></div>`;
      return;
    }
    estado.actual = correo;
    estado.imagenes = false;
    if (correo.noLeido) {
      api.correo.modificar(id, { leido: true }).catch(() => {});
      const enLista = estado.mensajes.find((x) => x.id === id);
      if (enLista) enLista.noLeido = false;
      contarNoLeidos();
    }
    pintarLectura();
  }

  function pintarLectura() {
    const c = estado.actual;
    const inicial = (c.de.nombre || c.de.email || '?').trim().charAt(0).toUpperCase();
    contenedor.innerHTML = `
      <article class="lectura">
        <div class="lectura__barra">
          <button type="button" class="icono-boton" id="lectura-volver" aria-label="Volver a la bandeja" title="Volver">${icono('volver')}</button>
          <span class="espacio"></span>
          <button type="button" class="icono-boton" data-accion="archivar" aria-label="Archivar" title="Archivar">${icono('archivar')}</button>
          <button type="button" class="icono-boton" data-accion="papelera" aria-label="Mover a la papelera" title="Mover a la papelera">${icono('papelera')}</button>
          <button type="button" class="icono-boton" data-accion="no-leido" aria-label="Marcar como no leído" title="Marcar como no leído">${icono('sobre')}</button>
          <button type="button" class="icono-boton" data-accion="destacar" aria-pressed="${c.destacado}" aria-label="Destacar" title="Destacar">${icono('estrella')}</button>
        </div>
        <div class="lectura__contenido desplazable">
          <h2 class="lectura__asunto">${escapar(c.asunto)}</h2>
          <div class="remitente">
            <span class="avatar" aria-hidden="true">${escapar(inicial)}</span>
            <div class="remitente__datos">
              <strong>${escapar(c.de.nombre)}</strong>
              <span>${escapar(c.de.email)} · ${fechaLarga(c.fecha)}</span>
            </div>
          </div>
          <div class="aviso-imagenes" id="aviso-imagenes" hidden>${icono('imagen', 15)}<span>Imágenes ocultas para proteger tu privacidad.</span><button type="button" id="mostrar-imagenes">Mostrar</button></div>
          <div id="lectura-cuerpo" class="lectura__cuerpo"></div>
          ${
            c.adjuntos?.length
              ? `<ul class="adjuntos">${c.adjuntos.map((a) => `<li>${icono('clip', 14)}${escapar(a.nombre)}</li>`).join('')}</ul>`
              : ''
          }
        </div>
        <div class="lectura__pie" id="lectura-pie">
          <button type="button" class="boton boton--primario" id="lectura-responder">${icono('responder', 15)} Responder</button>
          <button type="button" class="boton" id="lectura-borrador">${icono('chispa', 15)} Borrador con Kitsune</button>
        </div>
      </article>`;

    pintarCuerpo();
    contenedor.querySelector('#lectura-volver').addEventListener('click', () => {
      bandeja();
      if (Date.now() - ultimaCarga > 60_000) cargar();
    });
    contenedor.querySelector('#mostrar-imagenes').addEventListener('click', () => {
      estado.imagenes = true;
      pintarCuerpo();
    });
    contenedor.querySelectorAll('.lectura__barra [data-accion]').forEach((b) =>
      b.addEventListener('click', async () => {
        const accion = b.dataset.accion;
        const cambios = {
          archivar: { archivar: true },
          papelera: { papelera: true },
          'no-leido': { leido: false },
          destacar: { destacado: !c.destacado },
        }[accion];
        await api.correo.modificar(c.id, cambios);
        const enLista = estado.mensajes.find((x) => x.id === c.id);
        if (accion === 'destacar') {
          c.destacado = !c.destacado;
          if (enLista) enLista.destacado = c.destacado;
          b.setAttribute('aria-pressed', String(c.destacado));
          return;
        }
        if (accion === 'no-leido' && enLista) enLista.noLeido = true;
        if (accion === 'archivar' || accion === 'papelera') estado.mensajes = estado.mensajes.filter((x) => x.id !== c.id);
        contarNoLeidos();
        bandeja();
      }),
    );
    contenedor.querySelector('#lectura-responder').addEventListener('click', () => responder());
    contenedor.querySelector('#lectura-borrador').addEventListener('click', () => responder({ conKitsune: true }));
  }

  function pintarCuerpo() {
    const c = estado.actual;
    const destino = contenedor.querySelector('#lectura-cuerpo');
    const aviso = contenedor.querySelector('#aviso-imagenes');
    if (c.html) {
      const { srcdoc, bloqueadas } = prepararHtml(c.html, estado.imagenes);
      const marco = document.createElement('iframe');
      marco.className = 'cuerpo-html';
      marco.title = 'Contenido del correo';
      marco.setAttribute('sandbox', 'allow-popups allow-popups-to-escape-sandbox');
      marco.setAttribute('referrerpolicy', 'no-referrer');
      marco.srcdoc = srcdoc;
      destino.replaceChildren(marco);
      aviso.hidden = bloqueadas === 0;
    } else {
      const div = document.createElement('div');
      div.className = 'cuerpo-texto';
      div.textContent = c.texto;
      destino.replaceChildren(div);
      aviso.hidden = true;
    }
  }

  async function responder({ conKitsune = false } = {}) {
    const c = estado.actual;
    const pie = contenedor.querySelector('#lectura-pie');
    pie.outerHTML = `
      <form class="formulario-correo" id="respuesta">
        <textarea class="campo" id="respuesta-texto" aria-label="Respuesta para ${escapar(c.de.nombre)}" placeholder="Escribe tu respuesta…"></textarea>
        <div class="formulario-correo__acciones">
          <button type="submit" class="boton boton--primario">${icono('enviar', 15)} Enviar</button>
          <button type="button" class="boton" id="respuesta-kitsune">${icono('chispa', 15)} Kitsune</button>
          <button type="button" class="boton" id="respuesta-cancelar">Cancelar</button>
          <span class="estado-envio" id="respuesta-estado" role="status"></span>
        </div>
      </form>`;
    const formulario = contenedor.querySelector('#respuesta');
    const texto = contenedor.querySelector('#respuesta-texto');
    const estadoEnvio = contenedor.querySelector('#respuesta-estado');

    async function borrador() {
      estadoEnvio.textContent = 'Kitsune está escribiendo…';
      try {
        texto.value = await api.claude.redactarRespuesta(c.id, texto.value.trim());
        estadoEnvio.textContent = 'Revisa el borrador antes de enviarlo.';
      } catch (e) {
        estadoEnvio.textContent = e.message;
      }
    }

    contenedor.querySelector('#respuesta-kitsune').addEventListener('click', borrador);
    contenedor.querySelector('#respuesta-cancelar').addEventListener('click', pintarLectura);
    formulario.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!texto.value.trim()) {
        estadoEnvio.textContent = 'Escribe algo antes de enviar.';
        return;
      }
      estadoEnvio.textContent = 'Enviando…';
      try {
        await api.correo.enviar({ para: c.de.email, cuerpo: texto.value, responderA: c.id });
        estadoEnvio.textContent = 'Respuesta enviada.';
        setTimeout(pintarLectura, 900);
      } catch (err) {
        estadoEnvio.textContent = err.message;
      }
    });
    texto.focus();
    if (conKitsune) borrador();
  }

  // ---------- Redactar ----------

  function redactar() {
    contenedor.innerHTML = `
      <div class="lectura">
        <div class="lectura__barra">
          <button type="button" class="icono-boton" id="redactar-volver" aria-label="Volver a la bandeja" title="Volver">${icono('volver')}</button>
          <strong style="margin-left:4px">Nuevo correo</strong>
        </div>
        <form class="formulario-correo desplazable" id="redactar" style="flex:1">
          <input class="campo" id="redactar-para" type="text" placeholder="Para" aria-label="Para" autocomplete="email">
          <input class="campo" id="redactar-asunto" type="text" placeholder="Asunto" aria-label="Asunto">
          <textarea class="campo" id="redactar-cuerpo" placeholder="Mensaje" aria-label="Mensaje" style="flex:1;min-height:160px"></textarea>
          <div class="formulario-correo__acciones">
            <button type="submit" class="boton boton--primario">${icono('enviar', 15)} Enviar</button>
            <button type="button" class="boton" id="redactar-cancelar">Descartar</button>
            <span class="estado-envio" id="redactar-estado" role="status"></span>
          </div>
        </form>
      </div>`;
    const volver = () => bandeja();
    contenedor.querySelector('#redactar-volver').addEventListener('click', volver);
    contenedor.querySelector('#redactar-cancelar').addEventListener('click', volver);
    contenedor.querySelector('#redactar').addEventListener('submit', async (e) => {
      e.preventDefault();
      const estadoEnvio = contenedor.querySelector('#redactar-estado');
      estadoEnvio.textContent = 'Enviando…';
      try {
        await api.correo.enviar({
          para: contenedor.querySelector('#redactar-para').value,
          asunto: contenedor.querySelector('#redactar-asunto').value,
          cuerpo: contenedor.querySelector('#redactar-cuerpo').value,
        });
        estadoEnvio.textContent = 'Correo enviado.';
        setTimeout(volver, 900);
      } catch (err) {
        estadoEnvio.textContent = err.message;
      }
    });
    contenedor.querySelector('#redactar-para').focus();
  }

  async function iniciar() {
    const { conectado } = await api.correo.estado();
    if (!conectado) {
      sinCuenta();
      alNoLeidos(0);
      return;
    }
    bandeja();
    await cargar();
  }

  api.correo.alNuevo(() => {
    if (contenedor.querySelector('#correo-lista')) cargar();
    else alNoLeidos(null);
  });

  iniciar();
  return { recargar: iniciar, leer, redactar, bandeja: () => (bandeja(), cargar()) };
}
