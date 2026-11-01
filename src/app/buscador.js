// Buscador de Kitsune (la lupa de arriba, o Ctrl+K): busca a la vez en tus
// recordatorios, citas, candidaturas, ofertas, conversaciones, lo que Kitsune
// recuerda de ti, tu correo y los ajustes, y lleva directo a lo que eliges.
// Sin texto, enseña los accesos rápidos.
import { icono } from './iconos.js';
import { normalizarDatosEmpleo } from '../compartido/empleo.js';

const escapar = (t = '') => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const plano = (t) =>
  String(t ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();
const fecha = (ms) => new Date(ms).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const hora = (ms) => new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const POR_GRUPO = 5;

// Ajustes que se buscan por lo que la gente escribe (la sección a la que llevan).
const AJUSTES = [
  ['Voz y leer en voz alta', 'comportamiento', 'voz hablar leer altavoz diana voicestudio'],
  ['Claves de IA: Groq, OpenAI y Claude', 'claude', 'clave api key groq openai claude'],
  ['Modo de IA: Ahorro, Eficiente o Calidad', 'claude', 'modo ahorro eficiente calidad luna'],
  ['Gasto de OpenAI', 'claude', 'gasto dinero coste dolares euros consumo'],
  ['Cómo quieres que te hable', 'claude', 'personalidad tono hablar tuteame'],
  ['Registro de la IA', 'registro-ia', 'registro log ia piensa'],
  ['Aspecto del zorro: pelaje, estilo y tamaño', 'kitsune', 'pelaje estilo tamano color zorro aspecto'],
  ['Cuenta de Google: correo y calendario', 'correo', 'google gmail calendario cuenta conectar'],
  ['Avisos en el móvil y servidor', 'avisos', 'avisos push notificaciones servidor silencio'],
  ['Sincronizar iPhone y Windows', 'sincro', 'sincronizar iphone windows dispositivos'],
  ['Bloqueo con Face ID', 'bloqueo', 'face id bloqueo huella cara privacidad'],
  ['Permisos: qué puede hacer Kitsune', 'permisos', 'permisos confirmar preguntar privacidad'],
  ['Atajo de teclado e inicio con Windows', 'comportamiento', 'atajo teclado windows iniciar'],
];

export function crearBuscador({ dialogo, api, ir, abrirAjustes, abrirConversacion, abrirCorreo, abrirCandidatura, abrirPestanaEmpleo, nuevaConversacion }) {
  const caja = document.createElement('div');
  caja.className = 'lupa';
  caja.id = 'buscador';
  caja.hidden = true;
  caja.setAttribute('role', 'dialog');
  caja.setAttribute('aria-label', 'Buscar en Kitsune');
  caja.innerHTML = `
    <div class="lupa__barra">
      ${icono('buscar', 18)}
      <input class="lupa__texto" id="buscador-texto" type="search" placeholder="Busca citas, avisos, candidaturas, correos…" autocomplete="off" spellcheck="false" aria-label="Buscar en Kitsune" aria-controls="buscador-resultados">
      <button type="button" class="icono-boton" id="buscador-cerrar" aria-label="Cerrar el buscador">${icono('cerrar')}</button>
    </div>
    <div class="lupa__resultados desplazable" id="buscador-resultados"></div>`;
  dialogo.append(caja);
  const entrada = caja.querySelector('#buscador-texto');
  const lista = caja.querySelector('#buscador-resultados');
  let fuentes = null;
  let acciones = [];
  let turnoCorreo = 0;
  let relojCorreo = null;
  let foco = null;

  // Lo que hay en el dispositivo se carga una vez al abrir; si algo falla, se busca sin ello.
  async function cargarFuentes() {
    const seguro = (p) => Promise.resolve(p).catch(() => null);
    const ahora = Date.now();
    const [recordatorios, empleo, conversaciones, memoria, calendario] = await Promise.all([
      seguro(api.recordatorios?.listar()),
      seguro(api.empleo?.leer()),
      seguro(api.conversaciones?.listar()),
      seguro(api.memoria?.listar()),
      seguro(api.calendario?.estado()),
    ]);
    const conCalendario = calendario?.conectado && calendario.calendario && !calendario.necesitaReconectar;
    const eventos = conCalendario ? await seguro(api.calendario.eventos(ahora - 30 * 86_400_000, ahora + 120 * 86_400_000)) : null;
    const datos = normalizarDatosEmpleo(empleo ?? {});
    return {
      recordatorios: recordatorios ?? [],
      eventos: eventos ?? [],
      candidaturas: datos.postulaciones,
      ofertas: datos.ofertas,
      conversaciones: conversaciones?.lista ?? [],
      memoria: Array.isArray(memoria) ? memoria : [],
    };
  }

  const coincide = (palabras, ...textos) => {
    const t = plano(textos.join(' '));
    return palabras.every((p) => t.includes(p));
  };

  function grupos(q) {
    const palabras = plano(q).split(/\s+/).filter(Boolean);
    const f = fuentes ?? { recordatorios: [], eventos: [], candidaturas: [], ofertas: [], conversaciones: [], memoria: [] };
    const apartados = [
      { icono: 'sol', titulo: 'Hoy', detalle: 'Tu día de un vistazo', hacer: () => ir('hoy'), claves: 'hoy inicio resumen dia' },
      { icono: 'chat', titulo: 'Chat', detalle: 'Habla con Kitsune', hacer: () => ir('chat'), claves: 'chat hablar preguntar' },
      { icono: 'sobre', titulo: 'Correo', detalle: 'Tu bandeja de Gmail', hacer: () => ir('correo'), claves: 'correo gmail bandeja' },
      { icono: 'calendario', titulo: 'Agenda', detalle: 'Calendario y avisos', hacer: () => ir('agenda'), claves: 'agenda calendario citas' },
      { icono: 'maletin', titulo: 'Empleo', detalle: 'Ofertas, candidaturas y tu CV', hacer: () => ir('empleo'), claves: 'empleo trabajo ofertas cv' },
      { icono: 'nueva', titulo: 'Nuevo recordatorio', detalle: 'Agenda › Avisos', hacer: () => ir('recordatorios', { nuevo: true }), claves: 'nuevo recordatorio aviso recuerdame' },
      { icono: 'chispa', titulo: 'Buscar y preparar candidaturas', detalle: 'Empleo', hacer: () => ir('empleo', { buscarYPreparar: true }), claves: 'buscar preparar candidaturas ofertas' },
      { icono: 'conversacion', titulo: 'Nueva conversación', detalle: 'La actual queda guardada', hacer: nuevaConversacion, claves: 'nueva conversacion chat' },
      { icono: 'historial', titulo: 'Conversaciones guardadas', detalle: 'Chat', hacer: () => ir('historial'), claves: 'historial conversaciones guardadas' },
      { icono: 'memoria', titulo: 'Lo que sé de ti', detalle: 'Chat › memoria', hacer: () => ir('memoria'), claves: 'memoria recuerda sabe' },
      { icono: 'ajustes', titulo: 'Ajustes', detalle: 'Todos los temas', hacer: () => abrirAjustes(null), claves: 'ajustes configuracion opciones' },
    ];
    if (!palabras.length) return [['Ir a', apartados.slice(0, 7)]];
    const resultado = [];
    const poner = (titulo, items) => items.length && resultado.push([titulo, items.slice(0, POR_GRUPO)]);
    poner(
      'Ir a',
      apartados.filter((a) => coincide(palabras, a.titulo, a.claves)),
    );
    poner(
      'Recordatorios',
      f.recordatorios
        .filter((r) => coincide(palabras, r.texto))
        .map((r) => ({ icono: 'campana', titulo: r.texto, detalle: `${fecha(r.cuando)} · ${hora(r.cuando)}`, hacer: () => ir('recordatorios') })),
    );
    poner(
      'Agenda',
      f.eventos
        .filter((e) => coincide(palabras, e.titulo, e.lugar))
        .sort((a, b) => Math.abs(a.inicio - Date.now()) - Math.abs(b.inicio - Date.now()))
        .map((e) => ({
          icono: 'calendario',
          titulo: e.titulo || '(sin título)',
          detalle: [fecha(e.inicio), e.todoElDia ? 'todo el día' : hora(e.inicio), e.lugar].filter(Boolean).join(' · '),
          hacer: () => ir('agenda'),
        })),
    );
    poner(
      'Candidaturas',
      f.candidaturas
        .filter((p) => coincide(palabras, p.oferta.puesto, p.oferta.empresa, p.oferta.ubicacion))
        .map((p) => ({
          icono: 'documento',
          titulo: p.oferta.puesto,
          detalle: [p.oferta.empresa, !p.revisada ? 'por revisar' : p.estado].filter(Boolean).join(' · '),
          hacer: () => abrirCandidatura(p.id),
        })),
    );
    poner(
      'Ofertas',
      f.ofertas
        .filter((o) => coincide(palabras, o.puesto, o.empresa, o.ubicacion, ...(o.requisitos ?? [])))
        .map((o) => ({
          icono: 'maletin',
          titulo: o.puesto,
          detalle: [o.empresa, o.ubicacion, o.encaje != null ? `encaje ${o.encaje}` : ''].filter(Boolean).join(' · '),
          hacer: () => abrirPestanaEmpleo('ofertas'),
        })),
    );
    poner(
      'Conversaciones',
      f.conversaciones
        .filter((c) => coincide(palabras, c.titulo, c.resumen))
        .map((c) => ({ icono: 'chat', titulo: c.titulo || 'Conversación', detalle: c.resumen || fecha(c.actualizada ?? c.creada ?? Date.now()), hacer: () => abrirConversacion(c.id) })),
    );
    poner(
      'Lo que sé de ti',
      f.memoria.filter((m) => coincide(palabras, m.texto)).map((m) => ({ icono: 'memoria', titulo: m.texto, detalle: 'memoria', hacer: () => ir('memoria') })),
    );
    poner(
      'Ajustes',
      AJUSTES.filter(([titulo, , claves]) => coincide(palabras, titulo, claves)).map(([titulo, seccion]) => ({
        icono: 'ajustes',
        titulo,
        detalle: 'Ajustes',
        hacer: () => abrirAjustes(seccion),
      })),
    );
    return resultado;
  }

  function pintar(q, correos = null) {
    const gs = grupos(q);
    if (correos?.length) {
      gs.push([
        'Correo',
        correos.slice(0, POR_GRUPO).map((m) => ({
          icono: 'sobre',
          titulo: m.asunto || '(sin asunto)',
          detalle: [m.de?.nombre || m.de?.email, m.fecha ? fecha(m.fecha) : ''].filter(Boolean).join(' · '),
          hacer: () => abrirCorreo(m.id),
        })),
      ]);
    }
    acciones = gs.flatMap(([, items]) => items);
    let i = 0;
    lista.innerHTML = gs.length
      ? gs
          .map(
            ([titulo, items]) => `<section class="lupa__grupo" aria-label="${escapar(titulo)}">
          <p class="lupa__titulo">${escapar(titulo)}</p>
          ${items
            .map(
              (a) => `<button type="button" class="lupa__item" data-i="${i++}">
            <span class="lupa__icono">${icono(a.icono, 16)}</span>
            <span class="lupa__texto-item"><span>${escapar(a.titulo)}</span>${a.detalle ? `<small>${escapar(a.detalle)}</small>` : ''}</span>
          </button>`,
            )
            .join('')}
        </section>`,
          )
          .join('')
      : `<p class="lupa__vacio">${q.trim().length >= 3 && api.correo ? 'Buscando también en tu correo…' : 'Nada con ese nombre. Prueba con otra palabra.'}</p>`;
  }

  // El correo se busca en Gmail (con su buscador), con una pequeña espera mientras escribes.
  function buscarCorreo(q) {
    clearTimeout(relojCorreo);
    const turno = ++turnoCorreo;
    if (q.trim().length < 3 || !api.correo?.listar) return;
    relojCorreo = setTimeout(async () => {
      const estado = await api.correo.estado?.().catch(() => null);
      if (!estado?.conectado) return;
      const r = await api.correo.listar({ consulta: q.trim() }).catch(() => null);
      if (turno !== turnoCorreo || caja.hidden) return;
      pintar(entrada.value, r?.mensajes ?? []);
    }, 450);
  }

  function elegir(i) {
    const accion = acciones[i];
    if (!accion) return;
    cerrar({ devolverFoco: false });
    accion.hacer();
  }

  async function abrir() {
    if (!caja.hidden) return entrada.focus();
    foco = document.activeElement;
    caja.hidden = false;
    entrada.value = '';
    pintar('');
    entrada.focus();
    fuentes = await cargarFuentes();
    if (!caja.hidden) pintar(entrada.value);
  }

  function cerrar({ devolverFoco = true } = {}) {
    if (caja.hidden) return;
    caja.hidden = true;
    clearTimeout(relojCorreo);
    turnoCorreo++;
    if (devolverFoco) foco?.focus?.({ preventScroll: true });
  }

  entrada.addEventListener('input', () => {
    pintar(entrada.value);
    buscarCorreo(entrada.value);
  });
  entrada.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      elegir(0);
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      lista.querySelector('.lupa__item')?.focus();
    }
  });
  lista.addEventListener('click', (e) => {
    const b = e.target.closest('[data-i]');
    if (b) elegir(Number(b.dataset.i));
  });
  // Flechas para moverse por los resultados.
  lista.addEventListener('keydown', (e) => {
    if (!['ArrowDown', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const items = [...lista.querySelectorAll('.lupa__item')];
    const i = items.indexOf(document.activeElement);
    const siguiente = items[i + (e.key === 'ArrowDown' ? 1 : -1)];
    if (siguiente) siguiente.focus();
    else if (e.key === 'ArrowUp') entrada.focus();
  });
  caja.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      cerrar();
    }
  });
  caja.querySelector('#buscador-cerrar').addEventListener('click', () => cerrar());

  return { abrir, cerrar, abierto: () => !caja.hidden };
}
