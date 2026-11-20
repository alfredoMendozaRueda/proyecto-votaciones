// Forma: la otra cara de Kitsune, para la dieta y el gimnasio. Se carga solo
// cuando la abres (no pesa en Kitsune) y vive encima del diálogo con su propio
// diseño, su barra y sus pantallas: Diario, Entreno, Añadir, Progreso y Perfil.
import '@fontsource-variable/archivo/wdth.css';
import './forma.css';
import { fechaISO, sumarDias, nombreDia } from '../../compartido/forma/fechas.js';
import { normalizarForma } from '../../compartido/forma/datos.js';
import { ic, escapar, crearHojas, crearTostada } from './ui.js';
import { vistaDiario } from './vista-diario.js';
import { vistaEntreno } from './vista-entreno.js';
import { vistaProgreso } from './vista-progreso.js';
import { vistaPerfil } from './vista-perfil.js';
import { vistaBienvenida } from './vista-bienvenida.js';
import { crearAnadir } from './anadir.js';
import { crearImportador } from './importador.js';
import { crearMisAlimentos } from './mis-alimentos.js';
import { crearBiblioteca } from './biblioteca.js';
import { crearEditorSesion } from './editor-sesion.js';
import { crearIntegraciones } from './integraciones.js';
import { aplicarImportacion } from '../../compartido/forma/importar.js';
import { generarResumen, semanasPendientes, peticionResumenIA, leerTextoIA } from '../../compartido/forma/semanas.js';
import { puedeUsarIA } from '../../compartido/forma/ia.js';
import { contarUsoIA } from '../../compartido/forma/acciones.js';

const VISTAS = [
  { id: 'diario', nombre: 'Diario', icono: 'diario' },
  { id: 'entreno', nombre: 'Entreno', icono: 'entreno' },
  { id: 'anadir', nombre: 'Añadir', icono: 'mas' },
  { id: 'progreso', nombre: 'Progreso', icono: 'progreso' },
  { id: 'perfil', nombre: 'Perfil', icono: 'perfil' },
];

export async function montarForma({ raiz, api, salir }) {
  raiz.tabIndex = -1;
  raiz.innerHTML = `
    <header class="f-cab">
      <div class="f-marca" aria-label="Forma"><span class="f-marca__signo" aria-hidden="true"></span>FORMA</div>
      <div class="f-cab__centro" data-cab-centro></div>
      <button type="button" class="f-salir" data-a="salir" title="Volver a Kitsune">${ic('zorro', 16)}<span>Kitsune</span></button>
    </header>
    <main class="f-cuerpo" data-cuerpo></main>
    <nav class="f-barra" aria-label="Forma">
      ${VISTAS.map((v) =>
        v.id === 'anadir'
          ? `<button type="button" class="f-barra__mas" data-a="anadir" aria-label="Añadir comida">${ic('mas', 26)}</button>`
          : `<button type="button" class="f-barra__boton" data-ir="${v.id}">${ic(v.icono, 21)}<span>${v.nombre}</span></button>`,
      ).join('')}
    </nav>
    <div class="f-hojas" data-hojas></div>
    <div class="f-tostada" data-tostada role="status" hidden></div>`;

  const cuerpo = raiz.querySelector('[data-cuerpo]');
  const centro = raiz.querySelector('[data-cab-centro]');
  const hojas = crearHojas(raiz.querySelector('[data-hojas]'));
  const tostada = crearTostada(raiz.querySelector('[data-tostada]'));

  const estado = {
    datos: normalizarForma(await api.forma.leer()),
    vista: 'diario',
    fecha: fechaISO(),
    // Estado de cada pantalla (pestañas internas, borradores…).
    local: {},
  };

  let guardando = Promise.resolve();
  const ctx = {
    api,
    hojas,
    tostada,
    estado,
    get datos() {
      return estado.datos;
    },
    hoy: () => fechaISO(),
    // Guarda y vuelve a pintar. Los cambios van en orden aunque lleguen seguidos.
    guardar(nuevos, { pintar: repintar = true } = {}) {
      estado.datos = normalizarForma(nuevos);
      const copia = estado.datos;
      guardando = guardando.then(() => api.forma.guardar(copia)).catch((e) => tostada(`No se ha podido guardar: ${e.message}`));
      if (repintar) pintar();
      return guardando;
    },
    pintar: () => pintar(),
    irA: (vista) => irA(vista),
    abrirAnadir: (opciones) => anadir.abrir(opciones),
    // Importar desde JSON: lo revalida y guarda el «servidor» de cada plataforma
    // (en Windows, el proceso principal) de una vez; si algo falla, no cambia nada.
    async importar(plan) {
      await guardando;
      let r;
      if (api.forma.importar) r = await api.forma.importar(plan);
      else {
        r = aplicarImportacion(estado.datos, plan, { hoy: fechaISO() });
        await api.forma.guardar(normalizarForma(r.datos));
      }
      estado.datos = normalizarForma(r.datos);
      return r.resumen;
    },
    // Vuelve a leer lo guardado (lo que otra parte acaba de escribir), sin perder el entreno a medias.
    async recargar() {
      await guardando;
      const nuevos = normalizarForma(await api.forma.leer());
      estado.datos = { ...nuevos, activa: estado.datos.activa ?? nuevos.activa };
    },
    // Apple Salud: recoge del buzón del servidor lo que mandó el Atajo (como mucho
    // cada 2 minutos, salvo «Recoger ahora»), lo aplica y repinta.
    async recogerSalud({ avisar = false, siempre = false } = {}) {
      if (!api.forma.salud || (!siempre && Date.now() - ultimaRecogida < 120_000)) return null;
      ultimaRecogida = Date.now();
      try {
        await guardando;
        const r = await api.forma.salud.recoger();
        if (r?.recogidas) {
          const nuevos = normalizarForma(r.datos ?? (await api.forma.leer()));
          estado.datos = { ...nuevos, activa: estado.datos.activa ?? nuevos.activa };
          const partes = [r.pasos ? `${r.pasos} día${r.pasos > 1 ? 's' : ''} de pasos` : '', r.pesajes ? `${r.pesajes} pesaje${r.pesajes > 1 ? 's' : ''}` : ''].filter(Boolean);
          if (partes.length) tostada(`Apple Salud: ${partes.join(' y ')}.`);
          if (!raiz.hidden && !hojas.abierta()) pintar();
        }
        return r;
      } catch (e) {
        if (avisar) tostada(`No se ha podido recoger: ${e.message}`);
        return null;
      }
    },
  };
  let ultimaRecogida = 0;

  // ---------- Resumen semanal ----------
  // El texto lo escribe la IA (si está activada y quedan usos) solo con las
  // métricas ya calculadas; si no hay IA o falla, el de reglas.
  async function textoIA(m) {
    if (!estado.datos.ajustes.resumenIA || !api.ia?.tarea || !puedeUsarIA(estado.datos, fechaISO())) return null;
    try {
      const r = await api.ia.tarea(peticionResumenIA(m));
      estado.datos = contarUsoIA(estado.datos, fechaISO());
      return leerTextoIA(r?.texto);
    } catch {
      return null;
    }
  }
  // Genera (o regenera) una semana y la guarda. Devuelve el resumen.
  ctx.generarSemana = async (lunes, { ia = true } = {}) => {
    await guardando;
    const base = generarResumen(estado.datos, lunes, { ahora: Date.now() });
    const texto = ia ? await textoIA(base.resumen.datos) : null;
    const r = texto ? generarResumen(estado.datos, lunes, { ahora: Date.now(), texto, origen: 'ia' }) : generarResumen(estado.datos, lunes, { ahora: Date.now() });
    await ctx.guardar(r.datos, { pintar: false });
    return r.resumen;
  };
  // Las semanas cerradas que aún no tienen resumen (al abrir Forma, al volver y
  // cada minuto). Solo la más reciente lleva texto de la IA.
  let generando = false;
  ctx.generarResumenes = async () => {
    if (generando || !estado.datos.perfil) return;
    const pendientes = semanasPendientes(estado.datos, Date.now());
    if (!pendientes.length) return;
    generando = true;
    try {
      for (const lunes of pendientes) await ctx.generarSemana(lunes, { ia: lunes === pendientes.at(-1) });
      if (!raiz.hidden) {
        tostada('Tu resumen semanal está listo', { accion: () => ctx.irASemanas(), etiqueta: 'Ver', ms: 8000 });
        if (!hojas.abierta()) pintar();
      }
    } finally {
      generando = false;
    }
  };
  ctx.irASemanas = () => {
    hojas.cerrarTodas();
    estado.local.progreso = 'semanas';
    const ultimo = estado.datos.resumenes.at(-1);
    if (ultimo && estado.datos.resumenVisto !== ultimo.id) ctx.guardar({ ...estado.datos, resumenVisto: ultimo.id }, { pintar: false });
    irA('progreso');
  };
  // El servidor avisa a la hora elegida (solo sabe el día y la hora, no tus datos).
  let avisoEnviado = '';
  ctx.sincronizarAvisoResumen = async () => {
    const a = estado.datos.ajustes;
    const cfg = { activo: Boolean(a.resumenAviso && estado.datos.perfil), dia: a.resumenDia, hora: a.resumenHora };
    const firma = JSON.stringify(cfg);
    if (firma === avisoEnviado || !api.forma.avisoResumen) return;
    try {
      if (await api.forma.avisoResumen(cfg)) avisoEnviado = firma;
    } catch {
      // Sin servidor: el resumen se genera igual al abrir la app.
    }
  };
  const anadir = crearAnadir(ctx);
  const importador = crearImportador(ctx);
  const misAlimentos = crearMisAlimentos(ctx);
  const biblioteca = crearBiblioteca(ctx);
  ctx.abrirBiblioteca = () => biblioteca.abrir();
  const editorSesion = crearEditorSesion(ctx);
  ctx.editarSesion = (sid) => editorSesion.abrir(sid);
  const integraciones = crearIntegraciones(ctx);
  ctx.panelIntegraciones = () => integraciones.panel();

  const vistas = { diario: vistaDiario(ctx), entreno: vistaEntreno(ctx), progreso: vistaProgreso(ctx), perfil: vistaPerfil(ctx) };
  const bienvenida = vistaBienvenida(ctx);
  ctx.editarPerfil = (paso) => {
    estado.vista = 'perfil';
    bienvenida.editar(paso);
    cuerpo.scrollTop = 0;
  };

  function pintarCabecera() {
    if (estado.vista === 'diario' && estado.datos.perfil) {
      const f = estado.fecha;
      centro.innerHTML = `<div class="f-fecha">
          <button type="button" data-a="dia-antes" aria-label="Día anterior">${ic('atras', 16)}</button>
          <label class="f-fecha__texto">${escapar(nombreDia(f, ctx.hoy()))}<input type="date" data-fecha value="${f}" max="${sumarDias(ctx.hoy(), 0)}" aria-label="Elegir día"></label>
          <button type="button" data-a="dia-despues" aria-label="Día siguiente" ${f >= ctx.hoy() ? 'disabled style="opacity:.3"' : ''}>${ic('adelante', 16)}</button>
        </div>`;
    } else centro.innerHTML = '';
  }

  function pintar() {
    const sinPerfil = !estado.datos.perfil;
    // En el alta y al editar el perfil, los botones del paso van abajo y la barra se esconde.
    raiz.classList.toggle('sin-barra', sinPerfil || bienvenida.editando());
    for (const b of raiz.querySelectorAll('[data-ir]')) {
      if (b.dataset.ir === estado.vista) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    }
    pintarCabecera();
    const arriba = cuerpo.scrollTop;
    const vista = sinPerfil || bienvenida.editando() ? bienvenida : vistas[estado.vista];
    cuerpo.innerHTML = vista.html();
    vista.despues?.(cuerpo);
    if (estado.mantenerScroll) cuerpo.scrollTop = arriba;
    estado.mantenerScroll = false;
  }

  function irA(vista) {
    if (!vistas[vista]) return;
    const cambia = vista !== estado.vista;
    estado.vista = vista;
    hojas.cerrarTodas();
    pintar();
    if (cambia) cuerpo.scrollTop = 0;
  }

  // Repintar sin perder el sitio (al marcar una serie, sumar agua…).
  ctx.repintar = () => {
    estado.mantenerScroll = true;
    pintar();
  };

  // ---------- Eventos: todo por delegación ----------
  const acciones = {
    salir: () => salir(raiz.querySelector('.f-salir')),
    anadir: () => anadir.abrir({ fecha: estado.fecha }),
    'dia-antes': () => {
      estado.fecha = sumarDias(estado.fecha, -1);
      pintar();
    },
    'dia-despues': () => {
      if (estado.fecha >= ctx.hoy()) return;
      estado.fecha = sumarDias(estado.fecha, 1);
      pintar();
    },
  };

  const modulos = () => [...Object.values(vistas), bienvenida, anadir, importador, misAlimentos, biblioteca, editorSesion, integraciones];
  const buscarAccion = (el) => {
    const a = el.dataset.a;
    if (acciones[a]) return acciones[a];
    for (const v of modulos()) if (v.acciones?.[a]) return v.acciones[a];
    return null;
  };

  raiz.addEventListener('click', (e) => {
    const ir = e.target.closest('[data-ir]');
    if (ir && raiz.contains(ir)) return irA(ir.dataset.ir);
    const el = e.target.closest('[data-a]');
    if (!el || !raiz.contains(el) || el.disabled) return;
    const f = buscarAccion(el);
    if (f) {
      e.preventDefault();
      f(el, e);
    }
  });
  raiz.addEventListener('change', (e) => {
    if (e.target.matches('[data-fecha]') && e.target.value) {
      estado.fecha = e.target.value > ctx.hoy() ? ctx.hoy() : e.target.value;
      return pintar();
    }
    const el = e.target.closest('[data-cambio]');
    if (!el) return;
    for (const v of modulos()) v.cambios?.[el.dataset.cambio]?.(el, e);
  });
  raiz.addEventListener('input', (e) => {
    // Decimales con coma (82,4) como se escriben en España: se guardan con punto.
    const t = e.target;
    if (t.matches?.('input[inputmode="decimal"]') && t.value.includes(',')) {
      const pos = t.selectionStart;
      t.value = t.value.replace(/,/g, '.');
      try {
        t.setSelectionRange(pos, pos);
      } catch {
        // Algunos campos no tienen cursor.
      }
    }
    const el = e.target.closest('[data-entrada]');
    if (!el) return;
    for (const v of modulos()) v.entradas?.[el.dataset.entrada]?.(el, e);
  });
  raiz.addEventListener('submit', (e) => {
    const el = e.target.closest('form[data-form]');
    if (!el) return;
    e.preventDefault();
    for (const v of modulos()) v.formularios?.[el.dataset.form]?.(el, e);
  });
  raiz.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && hojas.abierta()) {
      e.stopPropagation();
      hojas.cerrar();
    }
  });

  // Lo que llega de otro dispositivo (sincronización): se recarga y se repinta.
  api.sincro?.alCambios?.(async (colecciones) => {
    if (!Array.isArray(colecciones) || !colecciones.includes('forma')) return;
    const nuevos = normalizarForma(await api.forma.leer());
    // El entreno a medias de este dispositivo no se pierde.
    estado.datos = { ...nuevos, activa: estado.datos.activa ?? nuevos.activa };
    if (!hojas.abierta()) ctx.repintar();
  });

  // Cambia de día solo a medianoche si estabas mirando «hoy».
  let ultimoHoy = fechaISO();
  setInterval(() => {
    const ahora = fechaISO();
    if (ahora !== ultimoHoy) {
      if (estado.fecha === ultimoHoy) estado.fecha = ahora;
      ultimoHoy = ahora;
      if (!raiz.hidden && !hojas.abierta()) ctx.repintar();
    }
    if (!raiz.hidden) ctx.generarResumenes();
  }, 60_000);

  pintar();
  // Lo que haya mandado el Atajo de Apple Salud: al arrancar, al abrir Forma y al volver a la app.
  // Y los resúmenes semanales pendientes, después de recoger lo de Salud.
  const ponerseAlDia = () => Promise.resolve(ctx.recogerSalud()).finally(() => ctx.generarResumenes());
  if (!raiz.hidden) ponerseAlDia();
  ctx.sincronizarAvisoResumen();
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !raiz.hidden) ponerseAlDia();
  });

  return {
    mostrar() {
      raiz.hidden = false;
      if (estado.fecha !== fechaISO() && estado.fecha === ultimoHoy) estado.fecha = fechaISO();
      pintar();
      ponerseAlDia();
    },
    ocultar() {
      hojas.cerrarTodas();
      raiz.hidden = true;
    },
    // Acciones directas (atajos del iPhone: ?forma=agua, ?forma=escaner, ?forma=peso).
    accion(nombre) {
      if (!estado.datos.perfil) return;
      if (nombre === 'agua') {
        estado.fecha = fechaISO();
        irA('diario');
        vistas.diario.acciones['agua+']?.({ dataset: { ml: '250' } });
        tostada('+250 ml de agua');
      } else if (nombre === 'escaner') anadir.abrir({ fecha: fechaISO(), escaner: true });
      else if (nombre === 'anadir') anadir.abrir({ fecha: fechaISO() });
      else if (nombre === 'peso') {
        irA('progreso');
        vistas.progreso.acciones['nuevo-peso']?.();
      } else if (nombre === 'entreno') irA('entreno');
      else if (nombre === 'importar') importador.abrir();
      else if (nombre === 'semanas') ctx.irASemanas();
    },
  };
}
