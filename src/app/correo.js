import DOMPurify from 'dompurify';
import { icono } from './iconos.js';
import { deslizar } from './animaciones.js';
import { candidatosFoto, claveFoto } from '../compartido/fotos.js';

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

// Un color estable para cada remitente (el mismo nombre, el mismo tono).
function tonoDe(texto = '') {
  let h = 0;
  for (const c of texto.toLowerCase()) h = (h * 31 + c.codePointAt(0)) % 360;
  return h;
}

const inicialDe = (de) => (de.nombre || de.email || '?').trim().charAt(0).toUpperCase();

const avatar = (de, clase = '') =>
  `<span class="avatar ${clase}" style="--tono: ${tonoDe(de.email || de.nombre)}" data-email="${escapar(de.email || '')}" aria-hidden="true">${escapar(inicialDe(de))}</span>`;

// ---------- Fotos de remitentes ----------
// Se recuerda qué foto tiene cada remitente (o que no tiene) para no pedirla
// cada vez: una semana si la hay, dos días si no.
const CLAVE_FOTOS = 'kitsune.fotos';
const VIDA_CON_FOTO = 7 * 86_400_000;
const VIDA_SIN_FOTO = 2 * 86_400_000;
const MAX_FOTOS = 400;
let cacheFotos = null;
const fotosEnCurso = new Map();

function leerFotos() {
  if (cacheFotos) return cacheFotos;
  try {
    cacheFotos = JSON.parse(localStorage.getItem(CLAVE_FOTOS)) ?? {};
  } catch {
    cacheFotos = {};
  }
  return cacheFotos;
}

function recordarFoto(clave, valor) {
  const fotos = leerFotos();
  fotos[clave] = { ...valor, t: Date.now() };
  const claves = Object.keys(fotos);
  if (claves.length > MAX_FOTOS) claves.sort((a, b) => fotos[a].t - fotos[b].t).slice(0, claves.length - MAX_FOTOS).forEach((c) => delete fotos[c]);
  try {
    localStorage.setItem(CLAVE_FOTOS, JSON.stringify(fotos));
  } catch {
    // Sin almacenamiento: se vuelve a buscar la próxima vez.
  }
}

// Carga de prueba: vale si llega una imagen de verdad (el icono genérico de 16 px no cuenta).
function cargaBien(url) {
  return new Promise((resolver) => {
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    img.onload = () => resolver(img.naturalWidth > 16);
    img.onerror = () => resolver(false);
    setTimeout(() => resolver(false), 8000);
    img.src = url;
  });
}

function fotoDe(email) {
  const clave = claveFoto(email);
  if (!clave) return Promise.resolve(null);
  const guardada = leerFotos()[clave];
  if (guardada && Date.now() - guardada.t < (guardada.url ? VIDA_CON_FOTO : VIDA_SIN_FOTO)) return Promise.resolve(guardada.url ? guardada : null);
  if (fotosEnCurso.has(clave)) return fotosEnCurso.get(clave);
  const busqueda = (async () => {
    for (const candidato of await candidatosFoto(email)) {
      if (await cargaBien(candidato.url)) {
        recordarFoto(clave, candidato);
        return candidato;
      }
    }
    // Sin conexión no se apunta que no hay foto.
    if (navigator.onLine !== false) recordarFoto(clave, { url: '' });
    return null;
  })().finally(() => fotosEnCurso.delete(clave));
  fotosEnCurso.set(clave, busqueda);
  return busqueda;
}

function ponerFotos(raiz) {
  raiz.querySelectorAll('.avatar[data-email]:not([data-con-foto])').forEach((el) => {
    el.dataset.conFoto = '';
    fotoDe(el.dataset.email).then((foto) => {
      if (!foto || !el.isConnected) return;
      const img = document.createElement('img');
      img.className = `avatar__foto avatar__foto--${foto.tipo}`;
      img.alt = '';
      img.referrerPolicy = 'no-referrer';
      img.decoding = 'async';
      img.addEventListener('load', () => el.classList.add('con-foto'), { once: true });
      img.src = foto.url;
      el.append(img);
    });
  });
}

// Grupo de la bandeja: Hoy, Ayer, el día de la semana (esta semana) o el mes.
function grupoDe(ms) {
  const dia = new Date(ms);
  dia.setHours(0, 0, 0, 0);
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((hoy - dia) / 86_400_000);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 7) return dia.toLocaleDateString('es-ES', { weekday: 'long' });
  const mes = dia.toLocaleDateString('es-ES', { month: 'long', ...(dia.getFullYear() !== hoy.getFullYear() ? { year: 'numeric' } : {}) });
  return mes;
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
  // Los correos suelen venir maquetados a 600-700 px. ajustar() apila las
  // columnas de las tablas que no caben (clase k-apilar) y, si aun así algo
  // se sale, escala el correo entero.
  const srcdoc = `<!doctype html><html><head><meta charset="utf-8"><style>
    html{overflow:hidden}
    body{margin:0;padding:16px 18px;font:15px/1.55 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#231e18;background:#e9e1d0;overflow-wrap:break-word;-webkit-text-size-adjust:100%}
    *{box-sizing:border-box}
    img,video{max-width:100%!important;height:auto!important}
    pre{white-space:pre-wrap}
    a{color:#8f2e1c}
    table.k-apilar,table.k-apilar>*,table.k-apilar>*>tr,table.k-apilar>tr,table.k-apilar>*>tr>td,table.k-apilar>*>tr>th,table.k-apilar>tr>td,table.k-apilar>tr>th{display:block;width:100%!important;min-width:0!important;max-width:100%!important;height:auto!important}
  </style></head><body>${doc.body.innerHTML}</body></html>`;
  return { srcdoc, bloqueadas };
}

export function crearCorreo({ contenedor, api, abrirAjustes, alNoLeidos, alLeer = () => {}, conFotos = () => true }) {
  const fotos = (raiz) => conFotos() && ponerFotos(raiz);
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

  // En la versión web Google cierra la sesión cada hora; volver a entrar
  // necesita un toque del usuario (abre una ventana de Google).
  function reconectar() {
    contenedor.innerHTML = `
      <div class="tarjeta-aviso">
        <h2>Vuelve a entrar en Gmail</h2>
        <p>Por seguridad, Google cierra la sesión de las apps web cada hora. Toca para seguir con tu correo.</p>
        <button type="button" class="boton boton--primario" id="correo-reconectar">${icono('sobre', 16)} Reconectar</button>
        <p class="mensaje-ajuste" id="correo-reconectar-error" role="status"></p>
      </div>`;
    contenedor.querySelector('#correo-reconectar').addEventListener('click', async () => {
      try {
        await api.correo.conectar();
        bandeja();
        await cargar();
      } catch (e) {
        contenedor.querySelector('#correo-reconectar-error').textContent = e.message;
      }
    });
  }

  // ---------- Bandeja ----------

  function bandeja() {
    contenedor.innerHTML = `
      <div class="correo__barra">
        <label class="buscador">${icono('buscar', 16)}<input type="search" id="correo-buscar" placeholder="Buscar en el correo" aria-label="Buscar en el correo"></label>
        <button type="button" class="icono-boton" id="correo-actualizar" aria-label="Actualizar" title="Actualizar">${icono('actualizar')}</button>
        <button type="button" class="boton boton--primario" id="correo-redactar" aria-label="Redactar">${icono('redactar', 15)}<span class="texto-boton">Redactar</span></button>
      </div>
      <div class="filtros" role="group" aria-label="Filtrar correos">
        ${FILTROS.map(([valor, nombre]) => `<button type="button" data-filtro="${valor}" aria-pressed="${valor === estado.filtro}">${nombre}</button>`).join('')}
      </div>
      <ul class="lista-correos desplazable" id="correo-lista" aria-label="Correos"></ul>`;
    prepararDeslizar(contenedor.querySelector('#correo-lista'));

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
    let grupoAnterior = null;
    lista.innerHTML = estado.mensajes
      .map((m) => {
        const grupo = grupoDe(m.fecha);
        const cabecera = grupo !== grupoAnterior ? `<li class="lista-correos__dia" role="presentation">${grupo}</li>` : '';
        grupoAnterior = grupo;
        return `${cabecera}
        <li class="fila${m.noLeido ? ' no-leida' : ''}" data-id="${m.id}">
          <div class="fila__bajo" aria-hidden="true">
            <button type="button" class="fila__deslizada fila__deslizada--borrar" data-accion="papelera" tabindex="-1">${icono('papelera', 20)}<span>Eliminar</span></button>
            <button type="button" class="fila__deslizada fila__deslizada--archivar" data-accion="archivar" tabindex="-1">${icono('archivar', 20)}<span>Archivar</span></button>
          </div>
          <button type="button" class="fila__abrir" data-accion="abrir" aria-label="${m.noLeido ? 'Sin leer. ' : ''}${escapar(m.de.nombre)}: ${escapar(m.asunto)}">
            ${avatar(m.de, 'avatar--fila')}
            <span class="fila__de">${escapar(m.de.nombre)}</span>
            <span class="fila__fecha">${fechaCorta(m.fecha)}</span>
            <span class="fila__asunto">${escapar(m.asunto) || '(sin asunto)'}</span>
            <span class="fila__extracto">${escapar(m.extracto)}</span>
          </button>
          <button type="button" class="estrella" data-accion="destacar" aria-pressed="${m.destacado}" aria-label="${m.destacado ? 'Quitar de destacados' : 'Destacar'}">${icono('estrella', 16)}</button>
          <div class="fila__acciones">
            <button type="button" class="icono-boton" data-accion="archivar" aria-label="Archivar" title="Archivar">${icono('archivar', 16)}</button>
            <button type="button" class="icono-boton" data-accion="papelera" aria-label="Mover a la papelera" title="Mover a la papelera">${icono('papelera', 16)}</button>
            <button type="button" class="icono-boton" data-accion="leido" aria-label="${m.noLeido ? 'Marcar como leído' : 'Marcar como no leído'}" title="${m.noLeido ? 'Marcar como leído' : 'Marcar como no leído'}">${icono(m.noLeido ? 'sobreAbierto' : 'sobre', 16)}</button>
          </div>
        </li>`;
      })
      .join('');
    fotos(lista);
    lista.querySelectorAll('[data-accion]').forEach((b) =>
      b.addEventListener('click', (e) => {
        e.stopPropagation();
        const fila = b.closest('.fila');
        if (b.closest('.fila__bajo')) quitarFila(fila, b.dataset.accion);
        else accionFila(fila.dataset.id, b.dataset.accion);
      }),
    );
  }

  // ---------- Deslizar (como en WhatsApp) ----------
  // Con el dedo, un correo deslizado a la izquierda descubre dos cajas,
  // Eliminar y Archivar; si se desliza hasta el fondo, se archiva sin más.
  const ANCHO_CAJAS = 152;
  const A_FONDO = 0.6;

  function prepararDeslizar(lista) {
    let gesto = null;
    let abierta = null;
    const mover = (fila, x) => fila.style.setProperty('--desliz', `${Math.round(x)}px`);
    const cerrar = (fila = abierta) => {
      if (!fila) return;
      fila.classList.remove('abierta', 'a-fondo');
      mover(fila, 0);
      if (fila === abierta) abierta = null;
    };

    lista.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'mouse' || !e.isPrimary) return;
      const fila = e.target.closest('.fila');
      if (!fila?.dataset.id || fila.classList.contains('saliendo') || e.target.closest('.fila__bajo')) return;
      if (abierta && abierta !== fila) cerrar();
      gesto = { fila, id: e.pointerId, x0: e.clientX, y0: e.clientY, base: fila === abierta ? -ANCHO_CAJAS : 0, x: 0, activo: false, muestras: [{ x: e.clientX, t: e.timeStamp }] };
    });

    lista.addEventListener('pointermove', (e) => {
      if (!gesto || e.pointerId !== gesto.id) return;
      const dx = e.clientX - gesto.x0;
      const dy = e.clientY - gesto.y0;
      if (!gesto.activo) {
        // Hasta saber hacia dónde va el dedo no se decide: en vertical es desplazar la lista.
        if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) return (gesto = null);
        if (Math.abs(dx) < 10) return;
        if (gesto.base === 0 && dx > 0) return (gesto = null);
        gesto.activo = true;
        gesto.x0 = e.clientX - Math.sign(dx) * 10;
        gesto.fila.setPointerCapture(e.pointerId);
        gesto.fila.classList.add('deslizando');
      }
      const ancho = gesto.fila.offsetWidth;
      gesto.x = Math.max(-ancho, Math.min(0, gesto.base + e.clientX - gesto.x0));
      gesto.muestras = [...gesto.muestras.slice(-4), { x: e.clientX, t: e.timeStamp }];
      mover(gesto.fila, gesto.x);
      gesto.fila.classList.toggle('a-fondo', gesto.x < -ancho * A_FONDO);
    });

    const soltar = (e) => {
      if (!gesto || e.pointerId !== gesto.id) return;
      const { fila, activo, x, muestras } = gesto;
      gesto = null;
      if (!activo) return;
      fila.classList.remove('deslizando');
      // El toque que acaba un deslizamiento no abre el correo.
      fila.dataset.deslizada = '1';
      setTimeout(() => delete fila.dataset.deslizada, 0);
      const [a, b] = [muestras[0], muestras.at(-1)];
      const velocidad = b.t > a.t ? (b.x - a.x) / (b.t - a.t) : 0; // px/ms
      if (x < -fila.offsetWidth * A_FONDO) {
        abierta = null;
        return quitarFila(fila, 'archivar');
      }
      fila.classList.remove('a-fondo');
      if (velocidad < 0.35 && (x < -ANCHO_CAJAS / 2 || velocidad < -0.4)) {
        mover(fila, -ANCHO_CAJAS);
        fila.classList.add('abierta');
        abierta = fila;
      } else {
        cerrar(fila);
      }
    };
    lista.addEventListener('pointerup', soltar);
    lista.addEventListener('pointercancel', soltar);
    // En iPhone, mientras se desliza un correo la lista no se mueve.
    lista.addEventListener('touchmove', (e) => gesto?.activo && e.cancelable && e.preventDefault(), { passive: false });

    // Con un correo abierto, cualquier toque fuera de sus cajas solo lo cierra.
    lista.addEventListener(
      'click',
      (e) => {
        const fila = e.target.closest('.fila');
        if (fila?.dataset.deslizada || (abierta && !e.target.closest('.fila__bajo'))) {
          e.stopPropagation();
          e.preventDefault();
          if (!fila?.dataset.deslizada) cerrar();
        }
      },
      true,
    );
    lista.addEventListener('scroll', () => cerrar(), { passive: true });
  }

  // La fila se va hacia la izquierda, el hueco se cierra y luego se archiva o
  // se borra de verdad; si falla, vuelve a aparecer.
  function quitarFila(fila, accion) {
    if (!fila || fila.classList.contains('saliendo')) return;
    const id = fila.dataset.id;
    fila.classList.remove('abierta', 'deslizando');
    fila.classList.add('saliendo', `sale-${accion}`);
    fila.style.setProperty('--desliz', `${-fila.offsetWidth}px`);
    setTimeout(() => {
      fila.style.height = `${fila.offsetHeight}px`;
      void fila.offsetHeight;
      fila.classList.add('plegando');
      fila.style.height = '0px';
    }, 240);
    setTimeout(async () => {
      await accionFila(id, accion);
      if (estado.mensajes.some((m) => m.id === id)) pintarLista();
    }, 460);
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
      if (e.reconectar) reconectar();
      else if (lista) lista.innerHTML = `<li class="lista-vacia">${escapar(e.message)}</li>`;
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
      if (accion === 'destacar' && m.destacado) contenedor.querySelector(`.fila[data-id="${id}"] .estrella`)?.classList.add('brilla');
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
    alLeer();
    deslizar(contenedor, 1);
    contenedor.innerHTML = '<div class="lectura"><div class="esqueleto" style="height:120px;margin:14px"></div></div>';
    let correo;
    try {
      correo = await api.correo.leer(id);
    } catch (e) {
      if (e.reconectar) reconectar();
      else contenedor.innerHTML = `<div class="tarjeta-aviso"><h2>No se pudo abrir</h2><p>${escapar(e.message)}</p></div>`;
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
            ${avatar(c.de)}
            <div class="remitente__datos">
              <strong>${escapar(c.de.nombre || c.de.email)}</strong>
              <span>${escapar(c.de.email)}</span>
            </div>
            <time class="remitente__fecha" datetime="${new Date(c.fecha).toISOString()}">${fechaLarga(c.fecha)}</time>
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

    fotos(contenedor);
    pintarCuerpo();
    contenedor.querySelector('#lectura-volver').addEventListener('click', () => {
      bandeja();
      deslizar(contenedor, -1);
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
          b.classList.toggle('brilla', c.destacado);
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
      // Sin allow-scripts el correo no puede ejecutar nada; allow-same-origin
      // solo sirve para medir su altura y que la lectura se desplace entera.
      marco.setAttribute('sandbox', 'allow-same-origin allow-popups allow-popups-to-escape-sandbox');
      marco.setAttribute('referrerpolicy', 'no-referrer');
      marco.addEventListener('load', () => ajustar(marco));
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

  // El correo cabe a lo ancho (si es más ancho que la pantalla se escala,
  // como hace Gmail) y el marco crece hasta su contenido. Se repite cuando
  // cargan las imágenes o cambia el ancho.
  function ajustar(marco) {
    const doc = marco.contentDocument;
    if (!doc?.documentElement) return;
    const medir = () => {
      if (!marco.isConnected) return;
      const cuerpo = doc.body;
      cuerpo.style.zoom = '1';
      const disponible = marco.clientWidth;
      // Primero se apilan las columnas de las tablas más anchas que el hueco
      // (de fuera hacia dentro: al apilar una, las de dentro pueden caber ya).
      doc.querySelectorAll('table.k-apilar').forEach((t) => t.classList.remove('k-apilar'));
      const hueco = cuerpo.clientWidth - (parseFloat(getComputedStyle(cuerpo).paddingLeft) || 0) - (parseFloat(getComputedStyle(cuerpo).paddingRight) || 0);
      for (const tabla of doc.querySelectorAll('table')) {
        if (tabla.getBoundingClientRect().right > cuerpo.getBoundingClientRect().left + cuerpo.clientWidth + 1 || tabla.offsetWidth > hueco + 1) {
          tabla.classList.add('k-apilar');
        }
      }
      let natural = Math.max(doc.documentElement.scrollWidth, cuerpo.scrollWidth);
      // Lo que se sale no cuenta el margen derecho del cuerpo: se suma para que no quede pegado.
      if (natural > disponible + 1) natural += parseFloat(getComputedStyle(cuerpo).paddingRight) || 0;
      // Por debajo del 45 % ya no se lee: entonces se deja desplazar.
      const escala = natural > disponible + 1 ? Math.max(0.45, disponible / natural) : 1;
      cuerpo.style.zoom = String(escala);
      doc.documentElement.style.overflowX = escala === 0.45 ? 'auto' : 'hidden';
      marco.style.height = '0px';
      marco.style.height = `${Math.max(120, Math.ceil(doc.documentElement.scrollHeight))}px`;
    };
    medir();
    doc.querySelectorAll('img').forEach((img) => img.complete || img.addEventListener('load', medir, { once: true }));
    let ancho = marco.clientWidth;
    new ResizeObserver(() => {
      if (marco.clientWidth === ancho) return;
      ancho = marco.clientWidth;
      medir();
    }).observe(marco);
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
    const cuenta = await api.correo.estado();
    if (!cuenta.conectado) {
      sinCuenta();
      alNoLeidos(0);
      return;
    }
    if (cuenta.necesitaReconectar) {
      reconectar();
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
