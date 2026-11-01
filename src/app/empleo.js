// Apartado Empleo: sube tu CV, Kitsune busca ofertas que encajen contigo,
// las puntúa y, para la que elijas, redacta un CV y una carta a medida que
// después repasa un agente revisor. Todo se guarda cifrado en el dispositivo.
import { icono } from './iconos.js';
import { buscarZonas, resolverZona, DISTANCIAS } from '../compartido/zonas.js';
import {
  analizarCV,
  buscarOfertas,
  evaluarEncaje,
  leerOferta,
  adaptarCV,
  prepararEntrevista,
  comprobarATS,
  normalizarDatosEmpleo,
  normalizarOferta,
  normalizarPreferencias,
  MAX_POSTULACIONES,
  MAX_ZONAS,
  normalizarEstiloCV,
} from '../compartido/empleo.js';

const escapar = (t = '') => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const dosCifras = (n) => String(n).padStart(2, '0');
const ESTADOS = [
  ['preparada', 'Preparada'],
  ['enviada', 'Enviada'],
  ['entrevista', 'Entrevista'],
  ['descartada', 'Descartada'],
];
const MODALIDADES = [
  ['', 'Cualquiera'],
  ['remoto', 'Remoto'],
  ['híbrido', 'Híbrido'],
  ['presencial', 'Presencial'],
];
// Umbrales del marco de ai-job-search: fuerte 75, bueno 60.
const NIVELES_ALERTA = [
  [75, 'Encaje fuerte (75+)'],
  [60, 'Encaje bueno (60+)'],
  [45, 'Encaje medio (45+)'],
  [0, 'Todas las nuevas'],
];
// Diseños y colores del CV (los mismos que el PDF, ver empleo-pdf.js).
const PLANTILLAS = [
  ['clasica', 'Clásico'],
  ['moderna', 'Moderno'],
  ['lateral', 'Lateral'],
  ['elegante', 'Elegante'],
];
const COLORES = { granate: '#99261c', azul: '#1c4580', verde: '#1a664f', grafito: '#383b42', violeta: '#61388f', teja: '#bd5924' };
const NOMBRE_COLOR = { granate: 'Granate', azul: 'Azul marino', verde: 'Verde', grafito: 'Grafito', violeta: 'Violeta', teja: 'Teja' };

// La foto: cuadrada, centrada y pequeña (JPEG de 480 px), para guardarla cifrada y sincronizarla.
async function prepararFoto(archivo) {
  if (!archivo || !/^image\//.test(archivo.type)) throw new Error('Elige una imagen (JPG, PNG o HEIC).');
  if (archivo.size > 25 * 1024 * 1024) throw new Error('La imagen es demasiado grande.');
  const url = URL.createObjectURL(archivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const lado = 480;
    const lienzo = document.createElement('canvas');
    lienzo.width = lienzo.height = lado;
    const m = Math.min(img.naturalWidth, img.naturalHeight);
    // Centrada en horizontal y un poco hacia arriba: en un retrato la cara suele estar arriba.
    const sy = Math.max(0, Math.min(img.naturalHeight - m, (img.naturalHeight - m) * 0.3));
    lienzo.getContext('2d').drawImage(img, (img.naturalWidth - m) / 2, sy, m, m, 0, 0, lado, lado);
    return lienzo.toDataURL('image/jpeg', 0.86);
  } finally {
    URL.revokeObjectURL(url);
  }
}

const TITULOS_HTML = {
  es: ['Perfil', 'Experiencia', 'Formación', 'Habilidades', 'Idiomas', 'Certificaciones'],
  en: ['Profile', 'Experience', 'Education', 'Skills', 'Languages', 'Certifications'],
};

const nivelEncaje = (n) => (n == null ? '' : n >= 75 ? 'alto' : n >= 50 ? 'medio' : 'bajo');
const nombreArchivo = (tipo, p) =>
  `${tipo} - ${p.cv.nombre || 'candidatura'} - ${p.oferta.empresa || p.oferta.puesto}`.replace(/[\\/:*?"<>|]+/g, '').slice(0, 90) + '.pdf';

function fechaCorta(ms) {
  return new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
}

// Comparte el PDF (iPhone: Guardar en Archivos, Mail, WhatsApp…) o lo descarga.
async function entregarPdf(bytes, nombre) {
  const archivo = new File([bytes], nombre, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [archivo] })) {
    try {
      await navigator.share({ files: [archivo], title: nombre });
      return;
    } catch (error) {
      if (error.name === 'AbortError') return;
    }
  }
  const url = URL.createObjectURL(archivo);
  const enlace = document.createElement('a');
  enlace.href = url;
  enlace.download = nombre;
  document.body.append(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

export function crearEmpleo({ contenedor, api, abrirAjustes }) {
  let datos = null;
  let ocupado = false;
  let pintado = false;
  const ia = (peticion) => api.ia.tarea(peticion);
  // Los portales de ai-job-search (LinkedIn y freehire) van por el servidor de avisos.
  const portales = api.servidor?.empleo ? (d) => api.servidor.empleo.buscar(d) : null;
  const detallePortal = api.servidor?.empleo ? (url) => api.servidor.empleo.detalle(url) : null;
  // Alerta diaria: la hace el servidor de avisos cada mañana.
  const alertas = api.servidor?.empleo?.alerta ? api.servidor.empleo : null;
  let estadoAlerta = null;
  let alertaCargada = 0;
  const nuevas = new Set();

  async function cargar() {
    if (datos) return;
    datos = normalizarDatosEmpleo((await api.empleo.leer().catch(() => null)) ?? {});
  }

  async function guardar() {
    try {
      await api.empleo.guardar(datos);
    } catch (error) {
      mensaje(`No se ha podido guardar: ${error.message}`);
    }
  }

  async function mostrar() {
    if (pintado) {
      // Al volver al apartado, por si la alerta de esta mañana ha traído ofertas.
      if (datos?.cv && Date.now() - alertaCargada > 5 * 60_000) cargarAlerta();
      return;
    }
    pintado = true;
    contenedor.innerHTML = '<div class="apartado"><div class="esqueleto" style="height:160px;margin:16px"></div></div>';
    await cargar();
    if (datos.cv) panel();
    else inicio();
  }

  function mensaje(texto, { ajustes = false } = {}) {
    const el = contenedor.querySelector('.apartado__mensaje');
    if (!el) return;
    el.hidden = !texto;
    el.innerHTML = texto ? `${escapar(texto)}${ajustes ? ' <button type="button" class="enlace-boton" data-ir-ajustes>Ir a Ajustes</button>' : ''}` : '';
    el.querySelector('[data-ir-ajustes]')?.addEventListener('click', () => abrirAjustes('claude'));
    if (texto) el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  const mostrarError = (error) => mensaje(error.message, { ajustes: /clave|Ajustes/i.test(error.message) });

  function progreso(texto) {
    const el = contenedor.querySelector('#empleo-progreso');
    if (!el) return;
    el.hidden = !texto;
    el.innerHTML = texto ? `<span class="empleo-progreso__punto"></span><span>${escapar(texto)}</span>` : '';
  }

  // Ejecuta una tarea larga sin dejar lanzar otra a la vez.
  async function tarea(funcion) {
    if (ocupado) return;
    ocupado = true;
    contenedor.querySelectorAll('[data-bloquear]').forEach((b) => (b.disabled = true));
    mensaje('');
    try {
      await funcion();
    } catch (error) {
      mostrarError(error);
    } finally {
      ocupado = false;
      progreso('');
      contenedor.querySelectorAll('[data-bloquear]').forEach((b) => (b.disabled = false));
    }
  }

  // ---------- Sin CV: subirlo ----------

  function inicio({ cancelable = false } = {}) {
    contenedor.innerHTML = `
      <div class="apartado desplazable empleo">
        <div class="apartado__cabecera">
          ${cancelable ? `<button type="button" class="icono-boton" id="empleo-volver" aria-label="Volver">${icono('volver')}</button>` : ''}
          <h2>Empleo</h2>
        </div>
        <section class="empleo-portada">
          <p class="empleo-mono">kitsune <span>/</span> búsqueda de empleo</p>
          <h3 class="empleo-titular">Busca trabajo con un agente <span>que adapta tu CV a cada oferta.</span></h3>
          <p class="empleo-etiqueta">(qué hace)</p>
          <ol class="empleo-pasos">
            <li><span>01</span>Lee tu CV y rastrea portales de empleo buscando ofertas que encajen contigo.</li>
            <li><span>02</span>Evalúa el encaje y redacta un CV y una carta a medida de cada oferta.</li>
            <li><span>03</span>Un agente revisor critica y pule cada candidatura, sin inventar nada.</li>
          </ol>
        </section>
        <label class="empleo-subir" for="empleo-archivo">
          <span class="empleo-subir__icono">${icono('subir', 22)}</span>
          <span><strong>Sube tu CV</strong><small>PDF, Word (.docx) o texto</small></span>
          <input type="file" id="empleo-archivo" data-bloquear accept=".pdf,.docx,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain">
        </label>
        <details class="empleo-pegar">
          <summary>O pega el texto de tu CV</summary>
          <textarea class="campo" id="empleo-texto" rows="8" placeholder="Pega aquí el texto de tu CV"></textarea>
          <button type="button" class="boton boton--primario" id="empleo-usar-texto" data-bloquear>Usar este texto</button>
        </details>
        <div class="empleo-progreso" id="empleo-progreso" role="status" hidden></div>
        <p class="apartado__mensaje" role="alert" hidden></p>
        <p class="ajuste__ayuda apartado__nota">Tu CV se lee en este ${api.plataforma === 'web' ? 'dispositivo' : 'equipo'} y se guarda cifrado. Solo el texto va a la IA que tengas elegida en Ajustes.</p>
      </div>`;
    contenedor.querySelector('#empleo-volver')?.addEventListener('click', panel);
    const archivo = contenedor.querySelector('#empleo-archivo');
    archivo.addEventListener('change', () => {
      const elegido = archivo.files?.[0];
      archivo.value = '';
      if (!elegido) return;
      tarea(async () => {
        progreso(`Leyendo ${elegido.name}…`);
        const { leerArchivoCV } = await import('./empleo-archivos.js');
        const texto = await leerArchivoCV(elegido);
        await procesarCV(texto, elegido.name);
      });
    });
    contenedor.querySelector('#empleo-usar-texto').addEventListener('click', () =>
      tarea(() => procesarCV(contenedor.querySelector('#empleo-texto').value, 'Texto pegado')),
    );
  }

  async function procesarCV(texto, archivo) {
    progreso('Kitsune está leyendo tu CV…');
    const perfil = await analizarCV(ia, texto);
    datos.cv = { archivo, texto: String(texto).slice(0, 40000), perfil, fecha: Date.now() };
    // Lo que buscar, de entrada lo que sugiere el propio CV.
    datos.preferencias = normalizarPreferencias({
      ...datos.preferencias,
      puestos: datos.preferencias.puestos || perfil.puestosObjetivo.slice(0, 3).join(', ') || perfil.titular,
      ubicacion: datos.preferencias.ubicacion || perfil.ubicacion,
    });
    await guardar();
    panel();
  }

  // ---------- Panel: perfil, búsqueda, ofertas y candidaturas ----------

  function panel() {
    const { perfil } = datos.cv;
    const pref = datos.preferencias;
    contenedor.innerHTML = `
      <div class="apartado desplazable empleo">
        <div class="apartado__cabecera"><h2>Empleo</h2></div>
        <section class="empleo-perfil">
          ${
            datos.foto
              ? `<img class="avatar empleo-perfil__avatar empleo-perfil__foto" src="${datos.foto}" alt="">`
              : `<span class="avatar empleo-perfil__avatar" aria-hidden="true">${escapar((perfil.nombre || '?').charAt(0).toUpperCase())}</span>`
          }
          <div class="empleo-perfil__datos">
            <strong>${escapar(perfil.nombre || 'Tu perfil')}</strong>
            <span>${escapar(perfil.titular)}</span>
            <span class="empleo-mono">${escapar([perfil.ubicacion, perfil.nivel].filter(Boolean).join(' · '))}</span>
          </div>
          <button type="button" class="boton boton--texto" id="empleo-cambiar" data-bloquear>Cambiar CV</button>
          ${perfil.habilidades.length ? `<ul class="chips empleo-perfil__chips">${perfil.habilidades.slice(0, 10).map((h) => `<li class="chip">${escapar(h)}</li>`).join('')}</ul>` : ''}
        </section>

        <section class="empleo-seccion" id="empleo-candidaturas"></section>

        <form class="empleo-busqueda" id="empleo-busqueda">
          <p class="empleo-etiqueta">(qué buscas)</p>
          <label class="empleo-campo"><span>Puestos</span><input class="campo" name="puestos" maxlength="300" value="${escapar(pref.puestos)}" placeholder="Desarrolladora frontend, React…"></label>
          <div class="empleo-campo"><span id="et-zonas">Dónde <small>(hasta ${MAX_ZONAS})</small></span>
            <div class="zonas" id="zonas">
              <ul class="zonas__elegidas" aria-label="Zonas elegidas"></ul>
              <div class="zonas__buscar">
                <input class="campo" id="zonas-texto" role="combobox" aria-expanded="false" aria-controls="zonas-lista" aria-autocomplete="list" aria-labelledby="et-zonas" autocomplete="off" spellcheck="false">
                <ul class="zonas__lista" id="zonas-lista" role="listbox" aria-labelledby="et-zonas" hidden></ul>
              </div>
            </div>
          </div>
          <label class="empleo-campo" id="zonas-distancia"><span>Alrededor de la ciudad</span>
            <select class="campo" name="distancia">${DISTANCIAS.map(([v, n]) => `<option value="${v}" ${pref.distancia === v ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
          <div class="empleo-campo"><span>Modalidad</span>
            <div class="segmentado" role="group" aria-label="Modalidad">
              ${MODALIDADES.map(([v, n]) => `<button type="button" data-modalidad="${v}" aria-pressed="${pref.modalidad === v}">${n}</button>`).join('')}
            </div>
          </div>
          <label class="empleo-campo"><span>Salario mínimo <small>(opcional)</small></span><input class="campo" name="salario" maxlength="60" value="${escapar(pref.salario)}" placeholder="30.000 € brutos/año"></label>
          <button type="submit" class="boton boton--primario empleo-buscar" data-bloquear>${icono('buscar', 16)} Buscar ofertas</button>
        </form>

        ${alertas ? '<section class="empleo-alerta" id="empleo-alerta" aria-label="Alerta diaria de ofertas" hidden></section>' : ''}

        <details class="empleo-pegar" id="empleo-oferta-propia">
          <summary>¿Tienes una oferta concreta?</summary>
          <form id="empleo-oferta">
            <textarea class="campo" name="oferta" rows="3" placeholder="Pega el enlace o el texto de la oferta"></textarea>
            <button type="submit" class="boton boton--primario" data-bloquear>Adaptar mi CV a esta oferta</button>
          </form>
        </details>

        <div class="empleo-progreso" id="empleo-progreso" role="status" hidden></div>
        <p class="apartado__mensaje" role="alert" hidden></p>

        <section class="empleo-seccion" id="empleo-ofertas"></section>

        <div class="apartado__pie"><button type="button" class="boton" id="empleo-borrar-todo">Borrar mis datos de empleo</button></div>
      </div>`;

    const formulario = contenedor.querySelector('#empleo-busqueda');
    zonasElegidas = [...pref.zonas];
    prepararZonas(formulario);
    formulario.querySelectorAll('[data-modalidad]').forEach((b) =>
      b.addEventListener('click', () => {
        formulario.querySelectorAll('[data-modalidad]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }),
    );
    formulario.addEventListener('submit', (e) => {
      e.preventDefault();
      datos.preferencias = preferenciasDelFormulario();
      tarea(buscar);
    });
    contenedor.querySelector('#empleo-oferta').addEventListener('submit', (e) => {
      e.preventDefault();
      const entrada = e.target.oferta.value.trim();
      if (!entrada) return mensaje('Pega el enlace o el texto de la oferta.');
      const yaHecha = /^https?:\/\/\S+$/.test(entrada) && datos.postulaciones.find((p) => p.oferta.url === entrada);
      if (yaHecha) return detalle(yaHecha);
      tarea(async () => {
        progreso(/^https?:\/\//.test(entrada) ? 'Abriendo la oferta…' : 'Leyendo la oferta…');
        const oferta = await leerOferta(ia, entrada, { detalle: detallePortal });
        await candidatura(oferta, { yaLeida: true });
      });
    });
    contenedor.querySelector('#empleo-cambiar').addEventListener('click', () => inicio({ cancelable: true }));
    const borrarTodo = contenedor.querySelector('#empleo-borrar-todo');
    borrarTodo.addEventListener('click', async () => {
      if (borrarTodo.dataset.confirmar !== 'si') {
        borrarTodo.dataset.confirmar = 'si';
        borrarTodo.textContent = '¿Seguro? Pulsa otra vez para borrar CV, ofertas y candidaturas';
        return;
      }
      datos = normalizarDatosEmpleo({});
      await guardar();
      inicio();
    });
    pintarOfertas();
    pintarCandidaturas();
    if (alertas) {
      if (estadoAlerta) pintarAlerta();
      else cargarAlerta();
    }
  }

  function preferenciasDelFormulario() {
    const formulario = contenedor.querySelector('#empleo-busqueda');
    if (!formulario) return datos.preferencias;
    return normalizarPreferencias({
      puestos: formulario.puestos.value,
      zonas: zonasElegidas,
      distancia: Number(formulario.distancia.value),
      salario: formulario.salario.value,
      modalidad: formulario.querySelector('[data-modalidad][aria-pressed="true"]')?.dataset.modalidad ?? '',
    });
  }

  // ---------- Selector de zonas ----------

  let zonasElegidas = [];
  const ICONO_ZONA = { ciudad: 'Ciudad', provincia: 'Provincia', comunidad: 'Comunidad', pais: 'País', remoto: 'Remoto', libre: 'Texto' };

  function prepararZonas(formulario) {
    const caja = formulario.querySelector('#zonas');
    const elegidas = caja.querySelector('.zonas__elegidas');
    const entrada = caja.querySelector('#zonas-texto');
    const listaEl = caja.querySelector('#zonas-lista');
    const distancia = formulario.querySelector('#zonas-distancia');
    let opciones = [];
    let activa = -1;

    const pintarElegidas = () => {
      elegidas.innerHTML = zonasElegidas
        .map((nombre, i) => {
          const z = resolverZona(nombre);
          return `<li class="zona-chip" data-tipo="${z.tipo}"><span>${escapar(z.nombre)}</span><button type="button" data-quitar="${i}" aria-label="Quitar ${escapar(z.nombre)}">${icono('cerrar', 12)}</button></li>`;
        })
        .join('');
      const lleno = zonasElegidas.length >= MAX_ZONAS;
      entrada.disabled = lleno;
      entrada.placeholder = lleno ? `Máximo ${MAX_ZONAS} zonas` : zonasElegidas.length ? 'Añadir otra zona…' : 'Ciudad, provincia, comunidad, país o «remoto»';
      // La distancia solo tiene sentido alrededor de una ciudad o provincia.
      distancia.hidden = !zonasElegidas.some((n) => ['ciudad', 'provincia', 'libre'].includes(resolverZona(n).tipo));
    };

    const cerrar = () => {
      listaEl.hidden = true;
      entrada.setAttribute('aria-expanded', 'false');
      entrada.removeAttribute('aria-activedescendant');
      activa = -1;
    };

    const marcar = (i) => {
      activa = i;
      listaEl.querySelectorAll('[role="option"]').forEach((o, j) => o.setAttribute('aria-selected', String(j === i)));
      const o = listaEl.querySelector(`#zona-op-${i}`);
      if (o) {
        entrada.setAttribute('aria-activedescendant', o.id);
        o.scrollIntoView({ block: 'nearest' });
      }
    };

    const abrir = () => {
      const texto = entrada.value.trim();
      opciones = buscarZonas(texto, { excluir: zonasElegidas }).map((z) => ({ nombre: z.nombre, detalle: z.detalle, tipo: z.tipo }));
      if (texto && !opciones.some((o) => o.nombre.toLowerCase() === texto.toLowerCase())) {
        opciones.push({ nombre: texto, detalle: 'buscar este lugar tal cual', tipo: 'libre' });
      }
      if (!opciones.length) return cerrar();
      listaEl.innerHTML = opciones
        .map(
          (o, i) => `<li role="option" id="zona-op-${i}" data-i="${i}" aria-selected="false" data-tipo="${o.tipo}">
            <span class="zonas__tipo">${ICONO_ZONA[o.tipo] ?? ''}</span><span class="zonas__nombre">${escapar(o.nombre)}</span><span class="zonas__detalle">${escapar(o.detalle)}</span></li>`,
        )
        .join('');
      listaEl.hidden = false;
      entrada.setAttribute('aria-expanded', 'true');
      marcar(texto ? 0 : -1);
    };

    const elegir = (i) => {
      const o = opciones[i];
      if (!o || zonasElegidas.length >= MAX_ZONAS) return;
      if (!zonasElegidas.includes(o.nombre)) zonasElegidas.push(o.nombre);
      entrada.value = '';
      pintarElegidas();
      cerrar();
      if (!entrada.disabled) entrada.focus();
    };

    entrada.addEventListener('focus', abrir);
    entrada.addEventListener('input', abrir);
    entrada.addEventListener('blur', () => setTimeout(cerrar, 120));
    entrada.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (listaEl.hidden) abrir();
        const n = opciones.length;
        if (n) marcar(e.key === 'ArrowDown' ? (activa + 1) % n : (activa - 1 + n) % n);
      } else if (e.key === 'Enter') {
        // Enter elige la zona marcada; no envía el formulario.
        if (!listaEl.hidden && activa >= 0) {
          e.preventDefault();
          elegir(activa);
        } else if (entrada.value.trim()) {
          e.preventDefault();
          abrir();
          elegir(0);
        }
      } else if (e.key === 'Escape') {
        cerrar();
      } else if (e.key === 'Backspace' && !entrada.value && zonasElegidas.length) {
        zonasElegidas.pop();
        pintarElegidas();
      }
    });
    // Con pointerdown la entrada no pierde el foco antes de elegir.
    listaEl.addEventListener('pointerdown', (e) => {
      const o = e.target.closest('[role="option"]');
      if (!o) return;
      e.preventDefault();
      elegir(Number(o.dataset.i));
    });
    elegidas.addEventListener('click', (e) => {
      const b = e.target.closest('[data-quitar]');
      if (!b) return;
      zonasElegidas.splice(Number(b.dataset.quitar), 1);
      pintarElegidas();
      entrada.focus();
    });
    pintarElegidas();
  }

  // ---------- Alerta diaria de ofertas ----------

  async function cargarAlerta() {
    if (!alertas) return;
    alertaCargada = Date.now();
    try {
      estadoAlerta = await alertas.alerta();
    } catch (error) {
      estadoAlerta = { error: error.message };
    }
    if (incorporarUltimas(estadoAlerta.ultimas)) {
      await guardar();
      pintarOfertas();
    }
    pintarAlerta();
  }

  // Las ofertas que trajo la alerta (y aún no estaban), arriba y marcadas como nuevas.
  function incorporarUltimas(ultimas) {
    if (!ultimas?.ofertas?.length || !datos?.cv || (ultimas.fecha && ultimas.fecha <= datos.alertaVista)) return 0;
    datos.alertaVista = ultimas.fecha || Date.now();
    const llegadas = ultimas.ofertas.map(normalizarOferta).filter((o) => !datos.ofertas.some((x) => mismaOferta(x, o)));
    llegadas.forEach((o) => nuevas.add(o.id));
    if (llegadas.length) {
      datos.ofertas = [...llegadas, ...datos.ofertas].slice(0, 20);
      datos.busqueda = datos.alertaVista;
    }
    return llegadas.length || 1;
  }

  const alertaActual = () => estadoAlerta?.alerta ?? { activa: false, puestos: '', ubicacion: '', hora: '08:30', minEncaje: 60 };

  function pintarAlerta(nota = '') {
    const caja = contenedor.querySelector('#empleo-alerta');
    if (!caja || !estadoAlerta) return;
    caja.hidden = false;
    if (estadoAlerta.error) {
      caja.innerHTML = `
        <div class="empleo-alerta__cabecera">
          <span class="empleo-alerta__icono" aria-hidden="true">${icono('campana', 18)}</span>
          <div><strong>Alerta diaria de ofertas</strong>
          <p class="ajuste__ayuda">Cada mañana puedo buscarte ofertas nuevas y avisarte al móvil de las que encajan contigo. Para eso, conecta antes los avisos.</p></div>
        </div>
        <div class="empleo-alerta__acciones"><button type="button" class="boton" data-ir-avisos>${icono('campana', 15)} Conectar los avisos</button></div>`;
      caja.querySelector('[data-ir-avisos]').addEventListener('click', () => abrirAjustes('avisos'));
      return;
    }
    const a = alertaActual();
    const u = estadoAlerta.ultimas;
    const busca = a.puestos ? `Busca «${a.puestos}»${a.ubicacion ? ` en ${a.ubicacion}` : ''}${a.modalidad ? ` (${a.modalidad})` : ''}. ` : '';
    caja.innerHTML = `
      <div class="empleo-alerta__cabecera">
        <span class="empleo-alerta__icono" aria-hidden="true">${icono('campana', 18)}</span>
        <div><strong id="et-alerta">Alerta diaria de ofertas</strong>
        <p class="ajuste__ayuda">Cada mañana miro LinkedIn y freehire y te aviso al móvil solo de las ofertas nuevas que encajan. Las que ya viste no se repiten.</p></div>
        <button type="button" class="interruptor" role="switch" aria-labelledby="et-alerta" id="alerta-activa" aria-checked="${a.activa}" data-bloquear></button>
      </div>
      ${
        a.activa
          ? `<div class="empleo-alerta__opciones">
              <label class="empleo-campo"><span>A qué hora</span><input class="campo" type="time" id="alerta-hora" value="${escapar(a.hora)}" data-bloquear></label>
              <label class="empleo-campo"><span>Avisarme de</span><select class="campo" id="alerta-encaje" data-bloquear>${NIVELES_ALERTA.map(
                ([v, n]) => `<option value="${v}"${v === a.minEncaje ? ' selected' : ''}>${n}</option>`,
              ).join('')}</select></label>
            </div>
            <p class="ajuste__ayuda">${escapar(busca)}Usa lo que tengas en «qué buscas»: al buscar con otros puestos, la alerta se actualiza.</p>
            ${estadoAlerta.groq ? '' : '<p class="ajuste__ayuda empleo-alerta__ojo">Sin IA en el servidor te llegan todas las ofertas nuevas, sin puntuar. Para que solo te avise de las que encajan, activa tu clave de OpenAI o de Groq en el servidor (Ajustes → Avisos).</p>'}
            <div class="empleo-alerta__acciones"><button type="button" class="boton" id="alerta-probar" data-bloquear>${icono('actualizar', 15)} Probar ahora</button></div>`
          : ''
      }
      ${
        nota || u
          ? `<p class="empleo-mono empleo-alerta__ultima" role="status">${escapar(
              nota || `última búsqueda: ${fechaCorta(u.fecha)} · ${u.ofertas.length} ${u.ofertas.length === 1 ? 'oferta nueva' : 'ofertas nuevas'}${u.evaluadas ? '' : ' sin puntuar'}`,
            )}</p>`
          : ''
      }`;
    caja.querySelector('#alerta-activa').addEventListener('click', () => tarea(() => guardarAlerta({ activa: !a.activa })));
    caja.querySelector('#alerta-hora')?.addEventListener('change', (e) => {
      if (/^\d{2}:\d{2}$/.test(e.target.value)) tarea(() => guardarAlerta({ hora: e.target.value }));
    });
    caja.querySelector('#alerta-encaje')?.addEventListener('change', (e) => tarea(() => guardarAlerta({ minEncaje: Number(e.target.value) })));
    caja.querySelector('#alerta-probar')?.addEventListener('click', () => tarea(probarAlerta));
  }

  // Guarda la alerta con la búsqueda de arriba y el resumen del CV (para puntuar).
  async function guardarAlerta(cambios = {}, { callada = false } = {}) {
    const a = alertaActual();
    datos.preferencias = preferenciasDelFormulario();
    const nueva = { activa: a.activa, hora: a.hora, minEncaje: a.minEncaje, ...datos.preferencias, ...cambios, perfil: datos.cv.perfil };
    try {
      const { alerta } = await alertas.guardarAlerta(nueva);
      estadoAlerta = { ...estadoAlerta, alerta };
      await guardar();
    } catch (error) {
      if (callada) return false;
      pintarAlerta();
      if (/puesto/i.test(error.message)) contenedor.querySelector('#empleo-busqueda [name="puestos"]')?.focus();
      throw error;
    }
    if (callada) return true;
    pintarAlerta(cambios.activa === true ? `activada: te aviso cada día a las ${estadoAlerta.alerta.hora}` : cambios.activa === false ? 'alerta desactivada' : 'alerta guardada');
  }

  async function probarAlerta() {
    progreso('Buscando ofertas nuevas, como hará la alerta cada mañana…');
    const { ultimas } = await alertas.probarAlerta();
    estadoAlerta = { ...estadoAlerta, ultimas };
    if (incorporarUltimas(ultimas)) {
      await guardar();
      pintarOfertas();
    }
    pintarAlerta(
      ultimas.ofertas.length
        ? ultimas.ofertas.length === 1
          ? `1 oferta nueva${ultimas.evaluadas ? ' que encaja' : ''}: está abajo, marcada como «nueva»`
          : `${ultimas.ofertas.length} ofertas nuevas${ultimas.evaluadas ? ' que encajan' : ''}: están abajo, marcadas como «nueva»`
        : 'nada nuevo que encaje desde la última vez; mañana vuelvo a mirar',
    );
    if (ultimas.ofertas.length) contenedor.querySelector('#empleo-ofertas')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  async function buscar() {
    const { perfil } = datos.cv;
    const pasos = { portales: 'Buscando en LinkedIn y freehire…', web: 'Buscando en InfoJobs, Indeed y webs de empresas…' };
    const { ofertas, avisos } = await buscarOfertas(ia, perfil, datos.preferencias, { portales, alPaso: (p) => progreso(pasos[p]) });
    datos.ofertas = ofertas;
    nuevas.clear();
    datos.busqueda = Date.now();
    datos.avisosBusqueda = avisos;
    pintarOfertas();
    progreso('Evaluando cada oferta: idioma, ubicación y cinco dimensiones…');
    try {
      datos.ofertas = await evaluarEncaje(ia, perfil, ofertas, { preferencias: datos.preferencias });
    } catch {
      // Sin puntuación también sirven.
    }
    await guardar();
    pintarOfertas();
    contenedor.querySelector('#empleo-ofertas')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    // La alerta diaria sigue a la última búsqueda.
    const a = estadoAlerta?.alerta;
    if (a?.activa && (a.puestos !== datos.preferencias.puestos || a.ubicacion !== datos.preferencias.ubicacion || a.modalidad !== datos.preferencias.modalidad)) {
      guardarAlerta({}, { callada: true }).then((ok) => ok && pintarAlerta('alerta actualizada con esta búsqueda'));
    }
  }

  function tarjetaOferta(o, i) {
    const nivel = nivelEncaje(o.encaje);
    const hecha = candidaturaDe(o);
    return `
      <article class="oferta" data-id="${escapar(o.id)}">
        <div class="oferta__num" aria-hidden="true">${dosCifras(i + 1)}</div>
        <div class="oferta__cuerpo">
          <p class="empleo-mono oferta__fuente">${escapar([o.fuente, o.publicada].filter(Boolean).join(' · '))}</p>
          <h4 class="oferta__puesto">${escapar(o.puesto)}</h4>
          <p class="oferta__empresa">${escapar([o.empresa, o.ubicacion].filter(Boolean).join(' · '))}</p>
          <ul class="chips">
            ${nuevas.has(o.id) ? '<li class="chip chip--nueva">Nueva</li>' : ''}
            ${hecha ? `<li class="chip chip--si">CV adaptado · ${fechaCorta(hecha.fecha)}</li>` : ''}
            ${o.encaje != null ? `<li class="chip chip--encaje" data-nivel="${o.puerta === 'no' ? 'bajo' : nivel}">${o.encaje} · ${escapar(o.veredicto || 'encaje')}</li>` : ''}
            ${o.modalidad ? `<li class="chip">${escapar(o.modalidad)}</li>` : ''}
            ${o.salario ? `<li class="chip">${escapar(o.salario)}</li>` : ''}
          </ul>
          ${o.puerta === 'no' || o.puerta === 'aviso' ? `<p class="oferta__puerta" data-puerta="${o.puerta}">${o.puerta === 'no' ? 'No pasa el filtro' : 'Ojo'}: ${escapar(o.notaPuerta || 'revisa los requisitos de idioma o ubicación')}</p>` : ''}
          ${o.dimensiones ? `<p class="empleo-mono oferta__dimensiones">técnica ${o.dimensiones.tecnica ?? '–'} · experiencia ${o.dimensiones.experiencia ?? '–'} · cultura ${o.dimensiones.cultura ?? '–'} · carrera ${o.dimensiones.carrera ?? '–'}</p>` : ''}
          ${o.resumen ? `<p class="oferta__resumen">${escapar(o.resumen)}</p>` : ''}
          ${o.motivos.length ? `<ul class="oferta__lista oferta__lista--si">${o.motivos.map((m) => `<li>${escapar(m)}</li>`).join('')}</ul>` : ''}
          ${o.faltan.length ? `<ul class="oferta__lista oferta__lista--no">${o.faltan.map((m) => `<li>${escapar(m)}</li>`).join('')}</ul>` : ''}
          <div class="oferta__acciones">
            ${
              hecha
                ? `<button type="button" class="boton boton--primario" data-ver="${escapar(hecha.id)}">${icono('documento', 15)} Ver mi candidatura</button>`
                : `<button type="button" class="boton boton--primario" data-adaptar="${escapar(o.id)}" data-bloquear>${icono('chispa', 15)} Adaptar CV</button>`
            }
            ${o.url ? `<button type="button" class="boton" data-abrir="${escapar(o.url)}">${icono('enlace', 15)} Ver oferta</button>` : ''}
          </div>
        </div>
      </article>`;
  }

  function pintarOfertas() {
    const seccion = contenedor.querySelector('#empleo-ofertas');
    if (!seccion) return;
    if (!datos.ofertas.length) {
      seccion.innerHTML = '';
      return;
    }
    seccion.innerHTML = `
      <p class="empleo-etiqueta">(ofertas · ${fechaCorta(datos.busqueda || Date.now())})</p>
      ${datos.ofertas.map(tarjetaOferta).join('')}
      <p class="ajuste__ayuda apartado__nota">${
        datos.avisosBusqueda?.length ? `${escapar(datos.avisosBusqueda.join(' '))} ` : ''
      }Ofertas de LinkedIn y freehire (los buscadores de ai-job-search) y de la búsqueda web de la IA, puntuadas con su marco de evaluación. Abre la oferta antes de enviar nada.</p>`;
    seccion.querySelectorAll('[data-adaptar]').forEach((b) =>
      b.addEventListener('click', () => {
        const oferta = datos.ofertas.find((o) => o.id === b.dataset.adaptar);
        if (oferta) tarea(() => candidatura(oferta));
      }),
    );
    seccion.querySelectorAll('[data-ver]').forEach((b) =>
      b.addEventListener('click', () => {
        const p = datos.postulaciones.find((x) => x.id === b.dataset.ver);
        if (p) detalle(p);
      }),
    );
    seccion.querySelectorAll('[data-abrir]').forEach((b) => b.addEventListener('click', () => api.ventana.abrirEnlace(b.dataset.abrir)));
  }

  function pintarCandidaturas() {
    const seccion = contenedor.querySelector('#empleo-candidaturas');
    if (!seccion) return;
    if (!datos.postulaciones.length) {
      seccion.innerHTML = '';
      return;
    }
    seccion.innerHTML = `
      <p class="empleo-etiqueta">(tus candidaturas · ${datos.postulaciones.length})</p>
      <ul class="filas">
        ${datos.postulaciones
          .map(
            (p) => `<li class="fila"><button type="button" class="fila__abrir empleo-cand" data-cand="${escapar(p.id)}">
              <span class="fila__icono">${icono('documento', 16)}</span>
              <span class="fila__cuerpo"><span class="fila__titulo">${escapar(p.oferta.puesto)}</span><span class="fila__detalle">${escapar(
                [p.oferta.empresa, fechaCorta(p.fecha)].filter(Boolean).join(' · '),
              )}</span></span>
              <span class="chip empleo-estado" data-estado="${p.estado}">${ESTADOS.find(([v]) => v === p.estado)[1]}</span>
            </button></li>`,
          )
          .join('')}
      </ul>`;
    seccion.querySelectorAll('[data-cand]').forEach((b) =>
      b.addEventListener('click', () => {
        const p = datos.postulaciones.find((x) => x.id === b.dataset.cand);
        if (p) detalle(p);
      }),
    );
  }

  // La candidatura ya preparada para una oferta (misma dirección o misma oferta).
  const mismaOferta = (a, b) => Boolean((a.url && a.url === b.url) || (a.id && a.id === b.id) || (a.puesto && a.puesto === b.puesto && a.empresa && a.empresa === b.empresa));
  const candidaturaDe = (oferta) => datos.postulaciones.find((p) => mismaOferta(p.oferta, oferta));

  // Redacta (y revisa) el CV y la carta para una oferta y abre el resultado.
  // Si ya está hecha, se abre la guardada; solo «Rehacer» la vuelve a generar.
  async function candidatura(oferta, { yaLeida = false, rehacer = null } = {}) {
    const hecha = !rehacer && candidaturaDe(oferta);
    if (hecha) return detalle(hecha);
    let completa = oferta;
    if (!yaLeida && oferta.url && !oferta.descripcion) {
      progreso('Leyendo la oferta completa…');
      try {
        const leida = await leerOferta(ia, oferta.url, { detalle: detallePortal });
        completa = { ...oferta, descripcion: leida.descripcion, requisitos: leida.requisitos.length ? leida.requisitos : oferta.requisitos };
      } catch {
        // Con el resumen de la búsqueda también vale.
      }
    }
    const pasos = {
      redactar: 'Redactando tu CV y la carta a medida…',
      investigar: 'El agente revisor investiga la empresa…',
      revisar: 'El agente revisor lo critica y lo pule…',
    };
    const resultado = await adaptarCV(ia, datos.cv.perfil, completa, { alPaso: (p) => progreso(pasos[p]) });
    const nueva = {
      id: rehacer?.id ?? `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      fecha: Date.now(),
      estado: rehacer?.estado ?? 'preparada',
      oferta: { ...completa, encaje: resultado.encaje ?? completa.encaje },
      ...resultado,
      entrevista: null,
    };
    datos.postulaciones = [nueva, ...datos.postulaciones.filter((x) => x.id !== nueva.id)].slice(0, MAX_POSTULACIONES);
    await guardar();
    detalle(nueva);
  }

  // ---------- Una candidatura: CV, carta y notas del revisor ----------

  function htmlCV(cv, idioma) {
    const [tPerfil, tExp, tForm, tHab, tIdi, tCert] = TITULOS_HTML[idioma] ?? TITULOS_HTML.es;
    const tContacto = { es: 'Contacto', en: 'Contact', fr: 'Contact', pt: 'Contacto', de: 'Kontakt', it: 'Contatti' }[idioma] ?? 'Contacto';
    const estilo = normalizarEstiloCV(datos.estiloCV);
    const foto = estilo.conFoto && datos.foto ? `<img class="papel__foto" data-forma="${estilo.forma}" src="${datos.foto}" alt="">` : '';
    const fechas = (a, b) => [a, b].filter(Boolean).join(' - ');
    const contacto = [cv.ubicacion, cv.email, cv.telefono, ...cv.enlaces].filter(Boolean);
    const quien = `<div class="papel__quien">
          <h3 class="papel__nombre">${escapar(cv.nombre)}</h3>
          ${cv.titular ? `<p class="papel__titular">${escapar(cv.titular)}</p>` : ''}
          ${estilo.plantilla === 'lateral' ? '' : `<p class="papel__contacto">${escapar(contacto.join(estilo.plantilla === 'elegante' ? '   |   ' : '  ·  '))}</p>`}
        </div>`;
    const cuerpo = `
        ${cv.resumen ? `<h4>${tPerfil}</h4><p>${escapar(cv.resumen)}</p>` : ''}
        ${cv.experiencia.length ? `<h4>${tExp}</h4>${cv.experiencia
          .map(
            (e) => `<div class="papel__bloque"><div class="papel__fila"><strong>${escapar([e.puesto, e.empresa].filter(Boolean).join(' — '))}</strong><span>${escapar(fechas(e.inicio, e.fin))}</span></div>
              ${e.lugar ? `<p class="papel__gris">${escapar(e.lugar)}</p>` : ''}
              ${e.logros.length ? `<ul>${e.logros.map((l) => `<li>${escapar(l)}</li>`).join('')}</ul>` : ''}</div>`,
          )
          .join('')}` : ''}
        ${cv.formacion.length ? `<h4>${tForm}</h4>${cv.formacion
          .map((f) => `<div class="papel__bloque"><div class="papel__fila"><strong>${escapar(f.titulo)}</strong><span>${escapar(fechas(f.inicio, f.fin))}</span></div>${f.centro ? `<p class="papel__gris">${escapar(f.centro)}</p>` : ''}</div>`)
          .join('')}` : ''}`;
    const listasHtml = `
        ${cv.habilidades.length ? `<h4>${tHab}</h4><p>${escapar(cv.habilidades.join('  ·  '))}</p>` : ''}
        ${cv.idiomas.length ? `<h4>${tIdi}</h4><p>${escapar(cv.idiomas.join('  ·  '))}</p>` : ''}
        ${cv.certificaciones.length ? `<h4>${tCert}</h4>${cv.certificaciones.map((c) => `<p>${escapar(c)}</p>`).join('')}` : ''}`;
    const atributos = `class="papel" data-plantilla="${estilo.plantilla}" style="--cv:${COLORES[estilo.color]}" lang="${escapar(idioma)}"`;
    if (estilo.plantilla === 'lateral') {
      const lista = (titulo, items) => (items.length ? `<h5>${titulo}</h5><ul>${items.map((x) => `<li>${escapar(x)}</li>`).join('')}</ul>` : '');
      return `
      <article ${atributos}>
        <aside class="papel__lateral">${foto}${lista(tContacto, contacto)}${lista(tHab, cv.habilidades.slice(0, 16))}${lista(tIdi, cv.idiomas.slice(0, 6))}${lista(tCert, cv.certificaciones.slice(0, 5))}</aside>
        <div class="papel__principal">${quien}${cuerpo}</div>
      </article>`;
    }
    return `
      <article ${atributos}>
        <header class="papel__cabecera">${foto}${quien}</header>
        ${cuerpo}${listasHtml}
      </article>`;
  }

  // Barra de diseño del CV: plantilla, color y foto. Vale para todas las candidaturas.
  function barraEstilo() {
    const e = normalizarEstiloCV(datos.estiloCV);
    return `
      <section class="cv-estilo" aria-label="Diseño del CV">
        <div class="segmentado cv-estilo__plantillas" role="group" aria-label="Diseño">
          ${PLANTILLAS.map(([v, n]) => `<button type="button" data-plantilla="${v}" aria-pressed="${e.plantilla === v}">${n}</button>`).join('')}
        </div>
        <div class="cv-estilo__fila">
          <div class="cv-estilo__colores" role="radiogroup" aria-label="Color">
            ${Object.entries(COLORES)
              .map(([v, c]) => `<button type="button" role="radio" data-color="${v}" aria-checked="${e.color === v}" aria-label="${NOMBRE_COLOR[v]}" title="${NOMBRE_COLOR[v]}" style="--muestra:${c}"></button>`)
              .join('')}
          </div>
          <div class="cv-estilo__foto">
            ${datos.foto ? `<img src="${datos.foto}" alt="Tu foto" data-forma="${e.forma}">` : `<span class="cv-estilo__sinfoto" aria-hidden="true">${icono('imagen', 18)}</span>`}
            <label class="boton boton--texto cv-estilo__subir">${datos.foto ? 'Cambiar foto' : 'Añadir foto'}<input type="file" accept="image/*" id="cv-foto" hidden></label>
          </div>
        </div>
        ${
          datos.foto
            ? `<div class="cv-estilo__fila">
          <label class="cv-estilo__casilla"><input type="checkbox" id="cv-con-foto" ${e.conFoto ? 'checked' : ''}> Poner la foto en el CV</label>
          <div class="segmentado cv-estilo__forma" role="group" aria-label="Forma de la foto">
            <button type="button" data-forma="circulo" aria-pressed="${e.forma === 'circulo'}">Redonda</button>
            <button type="button" data-forma="cuadrado" aria-pressed="${e.forma === 'cuadrado'}">Cuadrada</button>
          </div>
          <button type="button" class="boton boton--texto" id="cv-quitar-foto">Quitar foto</button>
        </div>`
            : ''
        }
        <p class="ajuste__ayuda">${
          e.plantilla === 'clasica'
            ? 'El clásico es el que mejor leen los filtros automáticos (ATS) de las empresas grandes.'
            : e.plantilla === 'lateral'
            ? 'Vistoso, pero algunos filtros automáticos (ATS) leen peor dos columnas: para portales grandes, mejor el Clásico.'
            : 'El diseño se aplica a todas tus candidaturas, al PDF del CV y al de la carta.'
        }</p>
      </section>`;
  }

  function textoPlano(p) {
    const cv = p.cv;
    const partes = [
      cv.nombre,
      cv.titular,
      [cv.ubicacion, cv.email, cv.telefono, ...cv.enlaces].filter(Boolean).join(' · '),
      '',
      cv.resumen,
      '',
      ...cv.experiencia.flatMap((e) => [`${[e.puesto, e.empresa].filter(Boolean).join(' — ')} (${[e.inicio, e.fin].filter(Boolean).join(' – ')})`, ...e.logros.map((l) => `• ${l}`), '']),
      ...cv.formacion.map((f) => `${f.titulo}, ${f.centro} (${[f.inicio, f.fin].filter(Boolean).join(' – ')})`),
      '',
      cv.habilidades.join(', '),
      cv.idiomas.join(', '),
      '',
      '———',
      '',
      p.carta,
    ];
    return partes.filter((x) => x != null).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }

  function detalle(p) {
    // Los PDF se preparan ya: así, al pulsar, se comparten sin esperas (el
    // iPhone solo deja compartir justo después del toque).
    let pdfs = null;
    const prepararPdfs = () =>
      (pdfs = import('./empleo-pdf.js').then(async ({ pdfCV, pdfCarta }) => ({
        cv: await pdfCV(p.cv, { idioma: p.idioma, estilo: datos.estiloCV, foto: datos.foto }),
        carta: await pdfCarta(p.carta, p.cv, { idioma: p.idioma, estilo: datos.estiloCV, foto: datos.foto }),
      })));
    prepararPdfs().catch(() => {});
    // Comprobación ATS sobre la capa de texto del PDF (copia: pdf.js se queda los bytes).
    let ats = null;
    const comprobar = () =>
      (ats = pdfs.then(async (listos) => {
        const { textoDePdf } = await import('./empleo-archivos.js');
        return comprobarATS(await textoDePdf(listos.cv.slice()), { cv: p.cv, terminos: p.terminosOferta.length ? p.terminosOferta : p.palabrasClave });
      }));
    comprobar().catch(() => {});
    const o = p.oferta;
    contenedor.innerHTML = `
      <div class="apartado desplazable empleo">
        <div class="apartado__cabecera">
          <button type="button" class="icono-boton" id="cand-volver" aria-label="Volver a Empleo">${icono('volver')}</button>
          <h2>Candidatura</h2>
        </div>
        <header class="candidatura">
          <p class="empleo-mono">${escapar([o.empresa, o.ubicacion, o.modalidad].filter(Boolean).join(' · '))}</p>
          <h3 class="candidatura__puesto">${escapar(o.puesto)}</h3>
          <div class="candidatura__estado">
            ${o.encaje != null ? `<span class="chip chip--encaje" data-nivel="${nivelEncaje(o.encaje)}">${o.encaje} · ${escapar(o.veredicto || 'encaje')}</span>` : ''}
            <select class="campo" id="cand-estado" aria-label="Estado de la candidatura">
              ${ESTADOS.map(([v, n]) => `<option value="${v}" ${p.estado === v ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
        </header>
        <div class="segmentado candidatura__pestanas" role="tablist">
          <button type="button" role="tab" data-pestana="cv" aria-pressed="true">CV</button>
          <button type="button" role="tab" data-pestana="carta" aria-pressed="false">Carta</button>
          <button type="button" role="tab" data-pestana="notas" aria-pressed="false">Revisor</button>
          <button type="button" role="tab" data-pestana="entrevista" aria-pressed="false">Entrevista</button>
        </div>
        <div class="empleo-progreso" id="empleo-progreso" role="status" hidden></div>
        <div id="cand-contenido"></div>
        <div class="candidatura__acciones">
          <button type="button" class="boton boton--primario" id="cand-pdf-cv">${icono('descargar', 15)} PDF del CV</button>
          <button type="button" class="boton" id="cand-pdf-carta">${icono('descargar', 15)} PDF de la carta</button>
          <button type="button" class="boton" id="cand-copiar">Copiar texto</button>
          ${o.url ? `<button type="button" class="boton" id="cand-oferta">${icono('enlace', 15)} Ver oferta</button>` : ''}
        </div>
        <p class="apartado__mensaje" role="alert" hidden></p>
        <div class="apartado__pie">
          <button type="button" class="boton" id="cand-rehacer-todo" data-bloquear>${icono('actualizar', 15)} Rehacer con la IA</button>
          <button type="button" class="boton" id="cand-borrar">Borrar esta candidatura</button>
        </div>
      </div>`;

    const contenido = contenedor.querySelector('#cand-contenido');
    const pestana = (nombre) => {
      contenedor.querySelectorAll('[data-pestana]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pestana === nombre)));
      if (nombre === 'cv') {
        contenido.innerHTML = `${barraEstilo()}<div id="cv-vista">${htmlCV(p.cv, p.idioma)}</div>`;
        conectarEstilo();
      }
      if (nombre === 'carta') {
        contenido.innerHTML = `<div class="papel papel--carta"><textarea class="papel__carta" id="cand-carta" aria-label="Carta de presentación">${escapar(p.carta)}</textarea></div>
          <p class="ajuste__ayuda">Puedes retocarla aquí; el PDF sale con tus cambios.</p>`;
        const area = contenido.querySelector('#cand-carta');
        const ajustarAlto = () => {
          area.style.height = 'auto';
          area.style.height = `${area.scrollHeight + 4}px`;
        };
        requestAnimationFrame(ajustarAlto);
        area.addEventListener('input', ajustarAlto);
        area.addEventListener('change', async () => {
          p.carta = area.value.trim();
          await guardar();
          prepararPdfs().catch(() => {});
          comprobar().catch(() => {});
        });
      }
      if (nombre === 'notas') {
        contenido.innerHTML = `
          <section class="empleo-notas">
            <p class="empleo-etiqueta">(comprobación ATS del PDF)</p>
            <div id="cand-ats" class="empleo-ats"><p class="apartado__cargando">Leyendo el PDF como lo haría un ATS…</p></div>
            ${p.empresa ? `<p class="empleo-etiqueta">(lo que el revisor sabe de ${escapar(o.empresa)})</p><p class="empleo-texto">${escapar(p.empresa)}</p>` : ''}
            ${p.notas.length ? `<p class="empleo-etiqueta">(lo que ha cambiado el revisor)</p><ul class="oferta__lista">${p.notas.map((n) => `<li>${escapar(n)}</li>`).join('')}</ul>` : ''}
            ${p.palabrasClave.length ? `<p class="empleo-etiqueta">(palabras clave de la oferta en tu CV)</p><ul class="chips">${p.palabrasClave.map((k) => `<li class="chip">${escapar(k)}</li>`).join('')}</ul>` : ''}
            ${o.motivos.length ? `<p class="empleo-etiqueta">(por qué encajas)</p><ul class="oferta__lista oferta__lista--si">${o.motivos.map((m) => `<li>${escapar(m)}</li>`).join('')}</ul>` : ''}
            ${o.faltan.length ? `<p class="empleo-etiqueta">(qué te falta)</p><ul class="oferta__lista oferta__lista--no">${o.faltan.map((m) => `<li>${escapar(m)}</li>`).join('')}</ul>` : ''}
          </section>`;
        pintarATS();
      }
      if (nombre === 'entrevista') pintarEntrevista();
    };

    // Cambiar el diseño o la foto: se guarda, se repinta y se rehacen los PDF.
    async function cambiarEstilo(cambios) {
      datos.estiloCV = normalizarEstiloCV({ ...datos.estiloCV, ...cambios });
      await guardar();
      pestana('cv');
      prepararPdfs().catch(() => {});
      comprobar().catch(() => {});
    }

    function conectarEstilo() {
      contenido.querySelectorAll('.cv-estilo [data-plantilla]').forEach((b) => b.addEventListener('click', () => cambiarEstilo({ plantilla: b.dataset.plantilla })));
      contenido.querySelectorAll('.cv-estilo [data-color]').forEach((b) => b.addEventListener('click', () => cambiarEstilo({ color: b.dataset.color })));
      contenido.querySelectorAll('.cv-estilo__forma [data-forma]').forEach((b) => b.addEventListener('click', () => cambiarEstilo({ forma: b.dataset.forma })));
      contenido.querySelector('#cv-con-foto')?.addEventListener('change', (e) => cambiarEstilo({ conFoto: e.target.checked }));
      contenido.querySelector('#cv-quitar-foto')?.addEventListener('click', async () => {
        datos.foto = '';
        await cambiarEstilo({});
      });
      contenido.querySelector('#cv-foto')?.addEventListener('change', async (e) => {
        try {
          datos.foto = await prepararFoto(e.target.files?.[0]);
          await cambiarEstilo({ conFoto: true });
        } catch (error) {
          mensaje(error.message);
        }
      });
    }

    async function pintarATS() {
      const caja = contenido.querySelector('#cand-ats');
      if (!caja) return;
      try {
        const r = await (ats ?? comprobar());
        if (!caja.isConnected) return;
        const fila = (ok, texto) => `<li data-ok="${ok}">${escapar(texto)}</li>`;
        caja.innerHTML = `
          <ul class="empleo-comprobaciones">
            ${fila(r.email && r.telefono, r.email && r.telefono ? 'Email y teléfono en texto: el ATS los lee' : 'Falta el email o el teléfono en la capa de texto')}
            ${fila(r.legible, r.legible ? 'Sin caracteres rotos' : 'Hay caracteres que el ATS no entenderá')}
            ${fila(r.fechas, r.fechas ? 'Fechas con guion normal' : 'Alguna fecha usa «–»: algunos ATS no la entienden')}
            ${r.porcentaje != null ? fila(r.porcentaje >= 70, `Términos de la oferta en tu CV: ${r.cubiertos.length} de ${r.cubiertos.length + r.faltan.length} (${r.porcentaje} %)`) : ''}
          </ul>
          ${r.cubiertos.length ? `<ul class="chips">${r.cubiertos.map((t) => `<li class="chip chip--si">${escapar(t)}</li>`).join('')}</ul>` : ''}
          ${r.faltan.length ? `<ul class="chips">${r.faltan.map((t) => `<li class="chip chip--no">${escapar(t)}</li>`).join('')}</ul>
            <p class="ajuste__ayuda">Los que faltan no se añaden solos: si de verdad los tienes, ponlos en tu CV y vuelve a adaptar.</p>` : ''}`;
      } catch (error) {
        caja.innerHTML = `<p class="ajuste__ayuda">No se ha podido comprobar: ${escapar(error.message)}</p>`;
      }
    }

    function pintarEntrevista() {
      const e = p.entrevista;
      if (!e) {
        contenido.innerHTML = `
          <section class="empleo-notas">
            <p class="empleo-texto">Kitsune prepara la entrevista con tu experiencia real: ejemplos STAR, las preguntas difíciles que te harán con esta oferta y qué preguntar tú.</p>
            <button type="button" class="boton boton--primario" id="cand-preparar" data-bloquear>${icono('chispa', 15)} Preparar la entrevista</button>
          </section>`;
        contenido.querySelector('#cand-preparar').addEventListener('click', () =>
          tarea(async () => {
            progreso('Preparando tu entrevista…');
            p.entrevista = await prepararEntrevista(ia, datos.cv.perfil, o, { empresa: p.empresa });
            await guardar();
            if (contenedor.querySelector('[data-pestana="entrevista"]')?.getAttribute('aria-pressed') === 'true') pintarEntrevista();
          }),
        );
        return;
      }
      contenido.innerHTML = `
        <section class="empleo-notas">
          ${e.porQueEmpresa ? `<p class="empleo-etiqueta">(por qué esta empresa)</p><p class="empleo-texto">${escapar(e.porQueEmpresa)}</p>` : ''}
          ${e.star.length ? `<p class="empleo-etiqueta">(tus ejemplos STAR)</p>${e.star
            .map(
              (x) => `<article class="empleo-star"><h4>${escapar(x.titulo)}${x.competencia ? ` <span class="empleo-mono">· ${escapar(x.competencia)}</span>` : ''}</h4>
                <dl><dt>S</dt><dd>${escapar(x.s)}</dd><dt>T</dt><dd>${escapar(x.t)}</dd><dt>A</dt><dd>${escapar(x.a)}</dd><dt>R</dt><dd>${escapar(x.r)}</dd></dl>
                ${x.usarPara.length ? `<p class="empleo-mono">para: ${escapar(x.usarPara.join(' · '))}</p>` : ''}</article>`,
            )
            .join('')}` : ''}
          ${e.dificiles.length ? `<p class="empleo-etiqueta">(preguntas difíciles)</p>${e.dificiles
            .map((x) => `<details class="empleo-pregunta"><summary>${escapar(x.pregunta)}</summary><p>${escapar(x.respuesta)}</p></details>`)
            .join('')}` : ''}
          ${e.paraPreguntar.length ? `<p class="empleo-etiqueta">(qué preguntar tú)</p><ul class="oferta__lista">${e.paraPreguntar.map((x) => `<li>${escapar(x)}</li>`).join('')}</ul>` : ''}
          <button type="button" class="boton" id="cand-rehacer" data-bloquear>Volver a preparar</button>
        </section>`;
      contenido.querySelector('#cand-rehacer').addEventListener('click', () => {
        p.entrevista = null;
        pintarEntrevista();
      });
    }
    contenedor.querySelectorAll('[data-pestana]').forEach((b) => b.addEventListener('click', () => pestana(b.dataset.pestana)));
    pestana('cv');

    contenedor.querySelector('#cand-volver').addEventListener('click', panel);
    contenedor.querySelector('#cand-estado').addEventListener('change', async (e) => {
      p.estado = e.target.value;
      await guardar();
    });
    const entregar = (tipo) => async () => {
      try {
        const listos = await pdfs;
        await entregarPdf(listos[tipo], nombreArchivo(tipo === 'cv' ? 'CV' : 'Carta', p));
      } catch (error) {
        mensaje(`No se ha podido crear el PDF: ${error.message}`);
      }
    };
    contenedor.querySelector('#cand-pdf-cv').addEventListener('click', entregar('cv'));
    contenedor.querySelector('#cand-pdf-carta').addEventListener('click', entregar('carta'));
    contenedor.querySelector('#cand-copiar').addEventListener('click', async (e) => {
      try {
        await navigator.clipboard.writeText(textoPlano(p));
        e.target.textContent = 'Copiado';
        setTimeout(() => (e.target.textContent = 'Copiar texto'), 1600);
      } catch {
        mensaje('No se ha podido copiar.');
      }
    });
    contenedor.querySelector('#cand-oferta')?.addEventListener('click', () => api.ventana.abrirEnlace(o.url));
    const rehacerTodo = contenedor.querySelector('#cand-rehacer-todo');
    rehacerTodo.addEventListener('click', () => {
      if (rehacerTodo.dataset.confirmar !== 'si') {
        rehacerTodo.dataset.confirmar = 'si';
        rehacerTodo.textContent = '¿Seguro? Se cambiará el CV y la carta guardados';
        return;
      }
      tarea(() => candidatura(p.oferta, { yaLeida: Boolean(p.oferta.descripcion), rehacer: p }));
    });
    const borrar = contenedor.querySelector('#cand-borrar');
    borrar.addEventListener('click', async () => {
      if (borrar.dataset.confirmar !== 'si') {
        borrar.dataset.confirmar = 'si';
        borrar.textContent = '¿Seguro? Pulsa otra vez para borrarla';
        return;
      }
      datos.postulaciones = datos.postulaciones.filter((x) => x.id !== p.id);
      await guardar();
      panel();
    });
    contenedor.querySelector('.apartado')?.scrollTo?.(0, 0);
  }

  // Han llegado cambios de otro dispositivo: se vuelve a leer (si no hay nada en marcha).
  function recargar() {
    if (ocupado) return;
    datos = null;
    estadoAlerta = null;
    if (!pintado) return;
    pintado = false;
    if (!contenedor.hidden && !contenedor.closest('[hidden]')) mostrar();
  }

  return { mostrar, recargar };
}
