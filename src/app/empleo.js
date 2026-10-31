// Apartado Empleo: sube tu CV, Kitsune busca ofertas que encajen contigo,
// las puntúa y, para la que elijas, redacta un CV y una carta a medida que
// después repasa un agente revisor. Todo se guarda cifrado en el dispositivo.
import { icono } from './iconos.js';
import {
  analizarCV,
  buscarOfertas,
  evaluarEncaje,
  leerOferta,
  adaptarCV,
  normalizarDatosEmpleo,
  normalizarPreferencias,
  MAX_POSTULACIONES,
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
    if (pintado) return;
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
          <span class="avatar empleo-perfil__avatar" aria-hidden="true">${escapar((perfil.nombre || '?').charAt(0).toUpperCase())}</span>
          <div class="empleo-perfil__datos">
            <strong>${escapar(perfil.nombre || 'Tu perfil')}</strong>
            <span>${escapar(perfil.titular)}</span>
            <span class="empleo-mono">${escapar([perfil.ubicacion, perfil.nivel].filter(Boolean).join(' · '))}</span>
          </div>
          <button type="button" class="boton boton--texto" id="empleo-cambiar" data-bloquear>Cambiar CV</button>
          ${perfil.habilidades.length ? `<ul class="chips empleo-perfil__chips">${perfil.habilidades.slice(0, 10).map((h) => `<li class="chip">${escapar(h)}</li>`).join('')}</ul>` : ''}
        </section>

        <form class="empleo-busqueda" id="empleo-busqueda">
          <p class="empleo-etiqueta">(qué buscas)</p>
          <label class="empleo-campo"><span>Puestos</span><input class="campo" name="puestos" maxlength="300" value="${escapar(pref.puestos)}" placeholder="Desarrolladora frontend, React…"></label>
          <label class="empleo-campo"><span>Dónde</span><input class="campo" name="ubicacion" maxlength="150" value="${escapar(pref.ubicacion)}" placeholder="Madrid, Valencia, España…"></label>
          <div class="empleo-campo"><span>Modalidad</span>
            <div class="segmentado" role="group" aria-label="Modalidad">
              ${MODALIDADES.map(([v, n]) => `<button type="button" data-modalidad="${v}" aria-pressed="${pref.modalidad === v}">${n}</button>`).join('')}
            </div>
          </div>
          <label class="empleo-campo"><span>Salario mínimo <small>(opcional)</small></span><input class="campo" name="salario" maxlength="60" value="${escapar(pref.salario)}" placeholder="30.000 € brutos/año"></label>
          <button type="submit" class="boton boton--primario empleo-buscar" data-bloquear>${icono('buscar', 16)} Buscar ofertas</button>
        </form>

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
        <section class="empleo-seccion" id="empleo-candidaturas"></section>

        <div class="apartado__pie"><button type="button" class="boton" id="empleo-borrar-todo">Borrar mis datos de empleo</button></div>
      </div>`;

    const formulario = contenedor.querySelector('#empleo-busqueda');
    formulario.querySelectorAll('[data-modalidad]').forEach((b) =>
      b.addEventListener('click', () => {
        formulario.querySelectorAll('[data-modalidad]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      }),
    );
    formulario.addEventListener('submit', (e) => {
      e.preventDefault();
      datos.preferencias = normalizarPreferencias({
        puestos: formulario.puestos.value,
        ubicacion: formulario.ubicacion.value,
        salario: formulario.salario.value,
        modalidad: formulario.querySelector('[data-modalidad][aria-pressed="true"]')?.dataset.modalidad ?? '',
      });
      tarea(buscar);
    });
    contenedor.querySelector('#empleo-oferta').addEventListener('submit', (e) => {
      e.preventDefault();
      const entrada = e.target.oferta.value.trim();
      if (!entrada) return mensaje('Pega el enlace o el texto de la oferta.');
      tarea(async () => {
        progreso(/^https?:\/\//.test(entrada) ? 'Abriendo la oferta…' : 'Leyendo la oferta…');
        const oferta = await leerOferta(ia, entrada);
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
  }

  async function buscar() {
    const { perfil } = datos.cv;
    const pasos = ['Buscando en LinkedIn, InfoJobs e Indeed…', 'Buscando en portales especializados y webs de empresas…'];
    const { ofertas } = await buscarOfertas(ia, perfil, datos.preferencias, { alPaso: (i) => progreso(pasos[i]) });
    datos.ofertas = ofertas;
    datos.busqueda = Date.now();
    pintarOfertas();
    progreso('Evaluando el encaje con tu perfil…');
    try {
      datos.ofertas = await evaluarEncaje(ia, perfil, ofertas);
    } catch {
      // Sin puntuación también sirven.
    }
    await guardar();
    pintarOfertas();
    contenedor.querySelector('#empleo-ofertas')?.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  function tarjetaOferta(o, i) {
    const nivel = nivelEncaje(o.encaje);
    return `
      <article class="oferta" data-id="${escapar(o.id)}">
        <div class="oferta__num" aria-hidden="true">${dosCifras(i + 1)}</div>
        <div class="oferta__cuerpo">
          <p class="empleo-mono oferta__fuente">${escapar([o.fuente, o.publicada].filter(Boolean).join(' · '))}</p>
          <h4 class="oferta__puesto">${escapar(o.puesto)}</h4>
          <p class="oferta__empresa">${escapar([o.empresa, o.ubicacion].filter(Boolean).join(' · '))}</p>
          <ul class="chips">
            ${o.encaje != null ? `<li class="chip chip--encaje" data-nivel="${nivel}">${o.encaje} % encaje</li>` : ''}
            ${o.modalidad ? `<li class="chip">${escapar(o.modalidad)}</li>` : ''}
            ${o.salario ? `<li class="chip">${escapar(o.salario)}</li>` : ''}
          </ul>
          ${o.resumen ? `<p class="oferta__resumen">${escapar(o.resumen)}</p>` : ''}
          ${o.motivos.length ? `<ul class="oferta__lista oferta__lista--si">${o.motivos.map((m) => `<li>${escapar(m)}</li>`).join('')}</ul>` : ''}
          ${o.faltan.length ? `<ul class="oferta__lista oferta__lista--no">${o.faltan.map((m) => `<li>${escapar(m)}</li>`).join('')}</ul>` : ''}
          <div class="oferta__acciones">
            <button type="button" class="boton boton--primario" data-adaptar="${escapar(o.id)}" data-bloquear>${icono('chispa', 15)} Adaptar CV</button>
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
      <p class="ajuste__ayuda apartado__nota">Las encuentra la IA buscando en internet: abre la oferta para comprobar que sigue abierta antes de enviar nada.</p>`;
    seccion.querySelectorAll('[data-adaptar]').forEach((b) =>
      b.addEventListener('click', () => {
        const oferta = datos.ofertas.find((o) => o.id === b.dataset.adaptar);
        if (oferta) tarea(() => candidatura(oferta));
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
      <p class="empleo-etiqueta">(tus candidaturas)</p>
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

  // Redacta (y revisa) el CV y la carta para una oferta y abre el resultado.
  async function candidatura(oferta, { yaLeida = false } = {}) {
    let completa = oferta;
    if (!yaLeida && oferta.url && !oferta.descripcion) {
      progreso('Leyendo la oferta completa…');
      try {
        const leida = await leerOferta(ia, oferta.url);
        completa = { ...oferta, descripcion: leida.descripcion, requisitos: leida.requisitos.length ? leida.requisitos : oferta.requisitos };
      } catch {
        // Con el resumen de la búsqueda también vale.
      }
    }
    const pasos = { redactar: 'Redactando tu CV y la carta a medida…', revisar: 'El agente revisor lo está puliendo…' };
    const resultado = await adaptarCV(ia, datos.cv.perfil, completa, { alPaso: (p) => progreso(pasos[p]) });
    const nueva = {
      id: `p${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
      fecha: Date.now(),
      estado: 'preparada',
      oferta: { ...completa, encaje: resultado.encaje ?? completa.encaje },
      ...resultado,
    };
    datos.postulaciones = [nueva, ...datos.postulaciones].slice(0, MAX_POSTULACIONES);
    await guardar();
    detalle(nueva);
  }

  // ---------- Una candidatura: CV, carta y notas del revisor ----------

  function htmlCV(cv, idioma) {
    const [tPerfil, tExp, tForm, tHab, tIdi, tCert] = TITULOS_HTML[idioma] ?? TITULOS_HTML.es;
    const fechas = (a, b) => [a, b].filter(Boolean).join(' – ');
    return `
      <article class="papel" lang="${escapar(idioma)}">
        <h3 class="papel__nombre">${escapar(cv.nombre)}</h3>
        ${cv.titular ? `<p class="papel__titular">${escapar(cv.titular)}</p>` : ''}
        <p class="papel__contacto">${escapar([cv.ubicacion, cv.email, cv.telefono, ...cv.enlaces].filter(Boolean).join('  ·  '))}</p>
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
          .join('')}` : ''}
        ${cv.habilidades.length ? `<h4>${tHab}</h4><p>${escapar(cv.habilidades.join('  ·  '))}</p>` : ''}
        ${cv.idiomas.length ? `<h4>${tIdi}</h4><p>${escapar(cv.idiomas.join('  ·  '))}</p>` : ''}
        ${cv.certificaciones.length ? `<h4>${tCert}</h4>${cv.certificaciones.map((c) => `<p>${escapar(c)}</p>`).join('')}` : ''}
      </article>`;
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
        cv: await pdfCV(p.cv, { idioma: p.idioma }),
        carta: await pdfCarta(p.carta, p.cv, { idioma: p.idioma }),
      })));
    prepararPdfs().catch(() => {});
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
            ${o.encaje != null ? `<span class="chip chip--encaje" data-nivel="${nivelEncaje(o.encaje)}">${o.encaje} % encaje</span>` : ''}
            <select class="campo" id="cand-estado" aria-label="Estado de la candidatura">
              ${ESTADOS.map(([v, n]) => `<option value="${v}" ${p.estado === v ? 'selected' : ''}>${n}</option>`).join('')}
            </select>
          </div>
        </header>
        <div class="segmentado candidatura__pestanas" role="tablist">
          <button type="button" role="tab" data-pestana="cv" aria-pressed="true">CV</button>
          <button type="button" role="tab" data-pestana="carta" aria-pressed="false">Carta</button>
          <button type="button" role="tab" data-pestana="notas" aria-pressed="false">Revisor</button>
        </div>
        <div id="cand-contenido"></div>
        <div class="candidatura__acciones">
          <button type="button" class="boton boton--primario" id="cand-pdf-cv">${icono('descargar', 15)} PDF del CV</button>
          <button type="button" class="boton" id="cand-pdf-carta">${icono('descargar', 15)} PDF de la carta</button>
          <button type="button" class="boton" id="cand-copiar">Copiar texto</button>
          ${o.url ? `<button type="button" class="boton" id="cand-oferta">${icono('enlace', 15)} Ver oferta</button>` : ''}
        </div>
        <p class="apartado__mensaje" role="alert" hidden></p>
        <div class="apartado__pie"><button type="button" class="boton" id="cand-borrar">Borrar esta candidatura</button></div>
      </div>`;

    const contenido = contenedor.querySelector('#cand-contenido');
    const pestana = (nombre) => {
      contenedor.querySelectorAll('[data-pestana]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.pestana === nombre)));
      if (nombre === 'cv') contenido.innerHTML = htmlCV(p.cv, p.idioma);
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
        });
      }
      if (nombre === 'notas') {
        contenido.innerHTML = `
          <section class="empleo-notas">
            ${p.notas.length ? `<p class="empleo-etiqueta">(lo que ha cambiado el revisor)</p><ul class="oferta__lista">${p.notas.map((n) => `<li>${escapar(n)}</li>`).join('')}</ul>` : ''}
            ${p.palabrasClave.length ? `<p class="empleo-etiqueta">(palabras clave de la oferta en tu CV)</p><ul class="chips">${p.palabrasClave.map((k) => `<li class="chip">${escapar(k)}</li>`).join('')}</ul>` : ''}
            ${o.motivos.length ? `<p class="empleo-etiqueta">(por qué encajas)</p><ul class="oferta__lista oferta__lista--si">${o.motivos.map((m) => `<li>${escapar(m)}</li>`).join('')}</ul>` : ''}
            ${o.faltan.length ? `<p class="empleo-etiqueta">(qué te falta)</p><ul class="oferta__lista oferta__lista--no">${o.faltan.map((m) => `<li>${escapar(m)}</li>`).join('')}</ul>` : ''}
            ${!p.notas.length && !p.palabrasClave.length ? '<p class="apartado__vacio">El revisor no ha dejado notas.</p>' : ''}
          </section>`;
      }
    };
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

  return { mostrar };
}
