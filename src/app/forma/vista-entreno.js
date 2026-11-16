// Entreno: empezar una rutina o un entreno libre, apuntar series (calentamiento
// o efectivas), ver lo que hiciste la última vez, cuándo subir peso, el
// descanso entre series, la calculadora de discos, el historial, la gráfica de
// cada ejercicio y el asesor de descarga.
import { ultimaVez, textoSeries, sugerenciaSubida, asesorDescarga, avisoFuerzaEnDeficit, historialEjercicio, ejerciciosDeSesion, duracionSesion, kcalDeCardio, volumenSemanal, volumenSesion, carga, tipoSerie } from '../../compartido/forma/entreno.js';
import { empezarSesion, actualizarActiva, terminarSesion, descartarActiva, borrarSesion, guardarRutina, borrarRutina, crearEjercicio, alternarPrincipal, aceptarDescarga, descartarDescarga, verAviso } from '../../compartido/forma/acciones.js';
import { discosPorLado, epley } from '../../compartido/forma/calculos.js';
import { ejercicio, GRUPOS, TIPOS_CARDIO, id as nuevoId } from '../../compartido/forma/datos.js';

const NOMBRE_CARDIO = Object.fromEntries(TIPOS_CARDIO);
const INTENSIDAD = { baja: 'baja', media: 'media', alta: 'alta' };
import { mejorMarca, pesoDeReferencia } from '../../compartido/forma/progreso.js';
import { lunesDe, nombreDia, fechaCorta } from '../../compartido/forma/fechas.js';
import { ic, escapar, num, grafica, vibrar } from './ui.js';

const reloj = (ms) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(ss).padStart(2, '0')}` : `${m}:${String(ss).padStart(2, '0')}`;
};

export function vistaEntreno(ctx) {
  let intervalo = null;
  let descanso = null; // { fin, total }
  let elDescanso = null;

  const raiz = () => document.querySelector('.forma');

  // ---------- Sesión en marcha ----------

  function rutinaDe(s) {
    return ctx.datos.rutinas.find((r) => r.id === s.rutinaId) ?? null;
  }

  function bloqueEjercicio(s, eid) {
    const d = ctx.datos;
    const e = ejercicio(d, eid);
    const series = s.series.filter((x) => x.ejercicioId === eid);
    const u = ultimaVez(d, eid, s.fecha, s.id);
    const enRutina = rutinaDe(s)?.ejercicios.find((x) => x.ejercicioId === eid);
    const sube = enRutina ? sugerenciaSubida(d, eid, enRutina.repMax, { antesDe: s.fecha, excluir: s.id }) : null;
    let n = 0;
    const filas = series
      .map((x, i) => {
        const etiqueta = x.calentamiento ? 'C' : String(++n);
        const previa = u?.series[x.calentamiento ? -1 : n - 1] ?? u?.series.at(-1);
        return `<div class="f-serie ${x.hecha ? 'hecha' : ''}">
          <button type="button" class="f-serie__n ${x.calentamiento ? 'calentamiento' : ''}" data-a="serie-tipo" data-id="${x.id}" title="${x.calentamiento ? 'Calentamiento (no cuenta)' : 'Serie efectiva'} · toca para cambiar">${etiqueta}</button>
          <input class="f-entrada" type="text" inputmode="decimal" autocomplete="off" step="any" aria-label="Kilos" data-entrada="serie" data-id="${x.id}" data-k="kg" value="${x.kg || ''}" placeholder="${previa && !x.calentamiento ? num(previa.kg, 2) : 'kg'}">
          <input class="f-entrada" type="number" inputmode="numeric" aria-label="Repeticiones" data-entrada="serie" data-id="${x.id}" data-k="reps" value="${x.reps || ''}" placeholder="${previa && !x.calentamiento ? previa.reps : enRutina ? `${enRutina.repMin}-${enRutina.repMax}` : 'reps'}">
          <input class="f-entrada" type="number" inputmode="numeric" aria-label="RIR" data-entrada="serie" data-id="${x.id}" data-k="rir" value="${x.rir ?? ''}" placeholder="RIR">
          <button type="button" class="f-serie__ok" data-a="serie-ok" data-id="${x.id}" aria-label="Serie hecha" aria-pressed="${x.hecha}">${ic('check', 16)}</button>
        </div>`;
      })
      .join('');
    return `<section class="f-panel f-ejercicio">
      <div class="f-ejercicio__cab">
        <h3>${escapar(e.nombre)}${e.principal ? ' <span style="color:var(--f-azul-2)">★</span>' : ''}<span class="f-ejercicio__ultima">${u ? `Última vez (${escapar(nombreDia(u.fecha, ctx.hoy()).toLowerCase())}): ${escapar(textoSeries(u.series))}` : 'Primera vez con este ejercicio'}${enRutina ? ` · objetivo ${enRutina.repMin}–${enRutina.repMax} reps` : ''}</span></h3>
        <button type="button" class="f-icono-boton" data-a="ejercicio-menu" data-id="${eid}" aria-label="Opciones de ${escapar(e.nombre)}">${ic('menu', 16)}</button>
      </div>
      ${sube ? `<p class="f-consejo">${ic('progreso', 15)}${escapar(sube.texto)}</p>` : ''}
      <div class="f-series">
        <div class="f-serie f-serie--cab"><span>Serie</span><span>kg</span><span>Reps</span><span>RIR</span><span></span></div>
        ${filas}
      </div>
      <div class="f-ejercicio__pie">
        <button type="button" class="f-boton f-boton--chico" data-a="serie-mas" data-ej="${eid}">${ic('mas', 14)}Serie</button>
        <button type="button" class="f-boton f-boton--chico" data-a="serie-mas" data-ej="${eid}" data-calentamiento="1">${ic('mas', 14)}Calentamiento</button>
        <button type="button" class="f-boton f-boton--chico" style="margin-left:auto" data-a="discos" data-ej="${eid}">${ic('discos', 15)}Discos</button>
      </div>
    </section>`;
  }

  function htmlSesion(s) {
    const ejercicios = ejerciciosDeSesion(s);
    const hechas = s.series.filter((x) => x.hecha && !x.calentamiento);
    const volumen = volumenSesion(ctx.datos, { series: s.series.filter((x) => x.hecha) });
    return `<div class="f-vista">
      <section class="f-panel f-panel--azul f-visor">
        <div class="f-sesion-cab">
          <div style="flex:1"><span class="f-etiqueta">${escapar(s.nombre || 'Entreno')}</span><div class="f-cronometro" data-crono>${reloj(Date.now() - s.inicio)}</div></div>
          <button type="button" class="f-boton f-boton--azul" data-a="terminar">${ic('check', 16)}Terminar</button>
        </div>
        <div class="f-kpis">
          <div class="f-kpi"><span>Series</span><b>${hechas.length}</b></div>
          <div class="f-kpi"><span>Volumen</span><b>${num(volumen)} kg</b></div>
          <div class="f-kpi"><span>Ejercicios</span><b>${ejercicios.length}</b></div>
        </div>
      </section>
      ${ejercicios.map((eid) => bloqueEjercicio(s, eid)).join('')}
      ${
        s.cardio.length
          ? `<section class="f-panel f-columna"><span class="f-etiqueta">Cardio</span>${s.cardio
              .map((c) => `<div class="f-fila f-entre"><span>${escapar(NOMBRE_CARDIO[c.tipo] ?? c.tipo)} · ${c.minutos} min${c.velocidad ? ` · ${num(c.velocidad, 1)} km/h` : ''}${c.inclinacion ? ` · ${num(c.inclinacion, 1)} %` : ''} · ${escapar(INTENSIDAD[c.intensidad] ?? c.intensidad)}</span><span class="f-suave">${num(c.kcal)} kcal <button type="button" class="f-enlace" data-a="cardio-quitar" data-id="${c.id}">Quitar</button></span></div>`)
              .join('')}</section>`
          : ''
      }
      <div class="f-rejilla-2">
        <button type="button" class="f-boton" data-a="ejercicio-anadir">${ic('mas', 16)}Ejercicio</button>
        <button type="button" class="f-boton" data-a="cardio">${ic('fuego', 16)}Cardio</button>
      </div>
      <label class="f-campo"><span>Notas</span><textarea class="f-entrada" data-entrada="sesion-notas" placeholder="Cómo te has sentido, molestias, máquina ocupada…">${escapar(s.notas)}</textarea></label>
      <button type="button" class="f-boton f-boton--peligro" data-a="descartar-sesion">Descartar este entreno</button>
    </div>`;
  }

  // ---------- Portada ----------

  function htmlInicio() {
    const d = ctx.datos;
    const hoy = ctx.hoy();
    const deload = asesorDescarga(d, hoy);
    const fuerza = avisoFuerzaEnDeficit(d, hoy);
    const semana = lunesDe(hoy);
    const estaSemana = d.sesiones.filter((s) => s.fecha >= semana);
    const vol = volumenSemanal(d);
    const volEsta = vol.find((v) => v.semana === semana)?.volumen ?? 0;
    const volAntes = vol.find((v) => v.semana === lunesDe(nombreAnterior(semana)))?.volumen ?? 0;
    const sesiones = [...d.sesiones].sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : (b.inicio ?? 0) - (a.inicio ?? 0)));
    return `<div class="f-vista">
      <div class="f-fila f-entre"><h1 class="f-titulo">Entreno</h1><span class="f-tenue">${d.perfil?.diasEntreno ?? 0} días/semana</span></div>
      <section class="f-panel">
        <div class="f-etiqueta"><span>Esta semana</span><b>${estaSemana.length} / ${d.perfil?.diasEntreno ?? 0} entrenos</b></div>
        <div class="f-semana" style="display:grid;grid-template-columns:repeat(7,1fr);gap:6px;margin-top:12px">${['L', 'M', 'X', 'J', 'V', 'S', 'D']
          .map((l, i) => {
            const f = sumar(semana, i);
            const hecho = d.sesiones.some((s) => s.fecha === f);
            return `<div style="display:grid;justify-items:center;gap:6px"><span class="f-tenue" style="font-size:11px">${l}</span><span style="width:100%;height:30px;border-radius:7px;border:1px solid ${f === hoy ? 'var(--f-azul)' : 'var(--f-linea)'};${hecho ? 'background:linear-gradient(180deg,var(--f-azul-2),var(--f-azul));box-shadow:0 0 12px -3px var(--f-azul);border-color:transparent' : ''}"></span></div>`;
          })
          .join('')}</div>
        <div class="f-kpis">
          <div class="f-kpi"><span>Volumen</span><b>${num(volEsta / 1000, 1)} t</b></div>
          <div class="f-kpi"><span>Vs. anterior</span><b>${volAntes ? `${volEsta >= volAntes ? '+' : '−'}${num(Math.abs((volEsta / volAntes - 1) * 100))} %` : '—'}</b></div>
          <div class="f-kpi"><span>Series</span><b>${estaSemana.reduce((t, s) => t + s.series.filter((x) => !x.calentamiento).length, 0)}</b></div>
        </div>
      </section>
      ${
        deload
          ? `<section class="f-panel f-panel--aviso f-columna"><div class="f-fila">${ic('info', 18)}<strong>Semana de descarga recomendada</strong></div>
        <p class="f-explica">${escapar(deload.texto)} ${escapar(deload.propuesta)}</p>
        <div class="f-fila"><button type="button" class="f-boton f-boton--chico" data-a="deload-no">Ahora no</button><button type="button" class="f-boton f-boton--chico f-boton--azul" data-a="deload-si">Hago la descarga esta semana</button></div></section>`
          : ''
      }
      ${fuerza && !d.avisosVistos.includes(fuerza.id) ? `<section class="f-panel f-panel--aviso f-fila">${ic('info', 18)}<p class="f-explica" style="flex:1;color:var(--f-texto)">${escapar(fuerza.texto)}</p><button type="button" class="f-icono-boton" style="border:0;background:none" data-a="ver-aviso" data-id="${fuerza.id}" aria-label="Cerrar">${ic('cerrar', 15)}</button></section>` : ''}
      <span class="f-etiqueta">Empezar</span>
      ${d.rutinas
        .map((r) => {
          const ultima = sesiones.find((s) => s.rutinaId === r.id);
          return `<button type="button" class="f-rutina" data-a="empezar" data-id="${r.id}"><span class="f-rutina__icono">${ic('entreno', 20)}</span><span style="flex:1;min-width:0"><strong>${escapar(r.nombre)}</strong><small>${r.ejercicios.length} ejercicios · ${r.ejercicios.reduce((t, e) => t + e.series, 0)} series${ultima ? ` · última: ${escapar(nombreDia(ultima.fecha, hoy).toLowerCase())}` : ''}</small></span><span class="f-icono-boton f-icono-boton--azul">${ic('play', 14)}</span></button>`;
        })
        .join('')}
      <div class="f-rejilla-2">
        <button type="button" class="f-boton" data-a="empezar-libre">${ic('play', 14)}Entreno libre</button>
        <button type="button" class="f-boton" data-a="rutina-nueva">${ic('mas', 16)}Nueva rutina</button>
      </div>
      ${d.rutinas.length ? `<div class="f-chips">${d.rutinas.map((r) => `<button type="button" class="f-chip" data-a="rutina-editar" data-id="${r.id}">${ic('lapiz', 13)}${escapar(r.nombre)}</button>`).join('')}</div>` : ''}
      <span class="f-etiqueta">Herramientas</span>
      <div class="f-rejilla-2">
        <button type="button" class="f-boton" data-a="biblioteca">${ic('estrella', 16)}Ejercicios</button>
        <button type="button" class="f-boton" data-a="importar">${ic('importar', 16)}Importar</button>
        <button type="button" class="f-boton" data-a="discos">${ic('discos', 16)}Discos</button>
      </div>
      <span class="f-etiqueta">Historial</span>
      ${
        sesiones.length
          ? `<div class="f-lista">${sesiones
              .slice(0, 12)
              .map((s) => {
                const ef = s.series.filter((x) => !x.calentamiento);
                const dur = duracionSesion(s);
                return `<button type="button" class="f-item" data-a="sesion-ver" data-id="${s.id}"><span class="f-item__texto"><span class="f-item__nombre">${escapar(s.nombre || 'Entreno')}</span><span class="f-item__detalle">${escapar(nombreDia(s.fecha, hoy))} · ${ef.length} series${dur ? ` · ${dur} min` : ''}${s.cardio.length ? ' · cardio' : ''}${s.origen === 'importado' ? ' · importado' : ''}</span></span><span class="f-item__kcal">${num(volumenSesion(ctx.datos, s))} <small>kg</small></span></button>`;
              })
              .join('')}</div>`
          : '<p class="f-tenue">Cuando termines tu primer entreno aparecerá aquí, con lo que hiciste en cada ejercicio.</p>'
      }
    </div>`;
  }

  const sumar = (f, n) => {
    const d = new Date(`${f}T12:00:00`);
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const nombreAnterior = (semana) => sumar(semana, -7);

  function html() {
    const s = ctx.datos.activa;
    return s ? htmlSesion(s) : htmlInicio();
  }

  function despues() {
    clearInterval(intervalo);
    if (ctx.datos.activa) {
      intervalo = setInterval(() => {
        const el = document.querySelector('[data-crono]');
        if (!el || !ctx.datos.activa) return clearInterval(intervalo);
        el.textContent = reloj(Date.now() - ctx.datos.activa.inicio);
      }, 1000);
    }
  }

  // ---------- Descanso entre series ----------
  function empezarDescanso(segundos = ctx.datos.ajustes.descanso) {
    descanso = { fin: Date.now() + segundos * 1000 };
    pintarDescanso();
  }

  function pintarDescanso() {
    const r = raiz();
    if (!r) return;
    if (!descanso) {
      elDescanso?.remove();
      elDescanso = null;
      return;
    }
    if (!elDescanso) {
      elDescanso = document.createElement('div');
      elDescanso.className = 'f-descanso';
      elDescanso.setAttribute('role', 'timer');
      elDescanso.innerHTML = `<span>Descanso</span><b data-desc></b><button type="button" class="f-boton f-boton--chico" data-a="descanso-mas" data-s="-15">−15</button><button type="button" class="f-boton f-boton--chico" data-a="descanso-mas" data-s="15">+15</button><button type="button" class="f-icono-boton" data-a="descanso-fin" aria-label="Terminar descanso">${ic('cerrar', 14)}</button>`;
      r.append(elDescanso);
      const tic = () => {
        if (!descanso || !elDescanso) return;
        const queda = descanso.fin - Date.now();
        elDescanso.querySelector('[data-desc]').textContent = reloj(queda + 999);
        if (queda <= 0) {
          vibrar([180, 90, 180]);
          pitido();
          descanso = null;
          pintarDescanso();
          return;
        }
        setTimeout(tic, 250);
      };
      tic();
    }
  }

  function pitido() {
    try {
      const a = new (window.AudioContext || window.webkitAudioContext)();
      const o = a.createOscillator();
      const g = a.createGain();
      o.frequency.value = 880;
      g.gain.setValueAtTime(0.0001, a.currentTime);
      g.gain.exponentialRampToValueAtTime(0.2, a.currentTime + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.45);
      o.connect(g).connect(a.destination);
      o.start();
      o.stop(a.currentTime + 0.5);
      setTimeout(() => a.close(), 800);
    } catch {
      // Sin audio: basta la vibración.
    }
  }

  // ---------- Hojas ----------

  function hojaElegirEjercicio(alElegir, titulo = 'Añadir ejercicio') {
    const pintarLista = (texto = '') => {
      const t = texto.toLowerCase();
      const lista = ctx.datos.ejercicios.filter((e) => !e.oculto && (!t || e.nombre.toLowerCase().includes(t) || e.grupo.toLowerCase().includes(t) || e.alias.some((a) => a.toLowerCase().includes(t))));
      return GRUPOS.map((g) => {
        const es = lista.filter((e) => e.grupo === g);
        if (!es.length) return '';
        return `<span class="f-etiqueta">${g}</span><div class="f-lista">${es.map((e) => `<button type="button" class="f-item" data-a="elegir-ejercicio" data-id="${e.id}"><span class="f-item__texto"><span class="f-item__nombre">${escapar(e.nombre)}</span></span>${e.principal ? `<span style="color:var(--f-azul-2)">★</span>` : ''}</button>`).join('')}</div>`;
      }).join('') + (t ? `<button type="button" class="f-boton" data-a="crear-ejercicio">${ic('mas', 16)}Crear «${escapar(texto)}»</button>` : '');
    };
    const hoja = ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>${escapar(titulo)}</h2></div>
       <div class="f-buscador">${ic('buscar', 17)}<input class="f-entrada" type="search" placeholder="Buscar ejercicio" data-entrada="buscar-ejercicio" autocomplete="off"></div>
       <label class="f-campo" data-grupo-nuevo hidden><span>Grupo del ejercicio nuevo</span><select class="f-entrada" data-grupo>${GRUPOS.map((g) => `<option>${g}</option>`).join('')}</select></label>
       <div class="f-columna" data-lista-ejercicios>${pintarLista()}</div>`,
      { clase: 'f-hoja--alta', titulo },
    );
    hoja.alElegir = alElegir;
    hoja.pintarLista = pintarLista;
    ctx.estado.local.elegir = hoja;
  }

  function hojaDiscos(kg = null) {
    const a = ctx.datos.ajustes;
    const hoja = ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Discos</h2></div>
       <label class="f-campo"><span>Peso total en la barra</span><div class="f-con-unidad" data-unidad="kg"><input class="f-entrada" type="text" inputmode="decimal" autocomplete="off" step="any" value="${kg ?? 60}" data-entrada="discos"></div></label>
       <div data-discos></div>
       <p class="f-tenue">Barra de ${num(a.barra, 2)} kg y discos de ${a.discos.map((x) => num(x, 2)).join(', ')} kg. Lo cambias en Perfil → Gimnasio.</p>`,
      { titulo: 'Discos' },
    );
    const pintar = (v) => {
      const r = discosPorLado(Number(v), { barra: a.barra, discos: a.discos });
      const lado = r.lado.map((d) => `<span class="f-disco" data-kg="${d}">${num(d, 2)}</span>`).join('');
      hoja.cuerpo.querySelector('[data-discos]').innerHTML = `
        <div class="f-barra-discos"><div class="f-barra-discos__lado" style="flex-direction:row-reverse">${lado}</div><div class="f-barra-discos__eje"></div><div class="f-barra-discos__lado">${lado}</div></div>
        <p style="text-align:center;font-weight:700">${r.lado.length ? `Por lado: ${r.lado.map((d) => num(d, 2)).join(' + ')} kg` : Number(v) <= a.barra ? 'Solo la barra' : '—'}</p>
        ${!r.exacto && Number(v) > a.barra ? `<p class="f-tenue" style="text-align:center;color:var(--f-aviso)">Con tus discos no se llega justo: lo más cerca es ${num(r.total, 2)} kg.</p>` : ''}`;
    };
    pintar(kg ?? 60);
    hoja.pintarDiscos = pintar;
    ctx.estado.local.discos = hoja;
  }

  function hojaRutina(rutina = null) {
    const borrador = rutina ? structuredClone(rutina) : { id: nuevoId('q'), nombre: '', ejercicios: [] };
    ctx.estado.local.rutina = borrador;
    const hoja = ctx.hojas.abrir('', { clase: 'f-hoja--alta', titulo: 'Rutina' });
    ctx.estado.local.hojaRutina = hoja;
    pintarRutina();
  }

  function pintarRutina() {
    const hoja = ctx.estado.local.hojaRutina;
    const r = ctx.estado.local.rutina;
    if (!hoja) return;
    hoja.cuerpo.innerHTML = `<div class="f-hoja__titulo"><h2>${ctx.datos.rutinas.some((x) => x.id === r.id) ? 'Editar rutina' : 'Nueva rutina'}</h2></div>
      <label class="f-campo"><span>Nombre</span><input class="f-entrada" value="${escapar(r.nombre)}" placeholder="Espalda y bíceps" data-entrada="rutina-nombre"></label>
      ${r.ejercicios
        .map(
          (e, i) => `<div class="f-panel" style="padding:12px">
          <div class="f-fila f-entre"><strong style="font-size:14px">${escapar(ejercicio(ctx.datos, e.ejercicioId).nombre)}</strong><button type="button" class="f-icono-boton" data-a="rutina-quitar" data-i="${i}" aria-label="Quitar">${ic('cerrar', 14)}</button></div>
          <div class="f-rejilla-3" style="margin-top:8px">
            ${[
              ['series', 'Series'],
              ['repMin', 'Reps mín.'],
              ['repMax', 'Reps máx.'],
            ]
              .map(([k, t]) => `<label class="f-campo"><span>${t}</span><input class="f-entrada" type="number" inputmode="numeric" value="${e[k]}" data-entrada="rutina-num" data-i="${i}" data-k="${k}"></label>`)
              .join('')}
          </div></div>`,
        )
        .join('')}
      <button type="button" class="f-boton" data-a="rutina-ejercicio">${ic('mas', 16)}Añadir ejercicio</button>
      <div class="f-fila">
        ${ctx.datos.rutinas.some((x) => x.id === r.id) ? `<button type="button" class="f-boton f-boton--peligro" data-a="rutina-borrar">${ic('basura', 15)}</button>` : ''}
        <button type="button" class="f-boton f-boton--azul" style="flex:1" data-a="rutina-guardar">Guardar rutina</button>
      </div>`;
  }

  function hojaSesion(s) {
    const porEj = ejerciciosDeSesion(s);
    ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>${escapar(s.nombre || 'Entreno')}</h2></div>
       <p class="f-tenue">${escapar(nombreDia(s.fecha, ctx.hoy()))}${duracionSesion(s) ? ` · ${duracionSesion(s)} min` : ''}</p>
       ${porEj
         .map((eid) => {
           const ss = s.series.filter((x) => x.ejercicioId === eid);
           const meta = (s.ejercicios ?? []).find((e) => e.ejercicioId === eid);
           const marca = (x) => ({ calentamiento: '(C) ', dropset: '(D) ' })[tipoSerie(x)] ?? '';
           const cifra = (x) => (x.segundos && !x.reps ? `${x.segundos} s` : `${num(x.kg, 2)}${x.lastre ? `+${num(x.lastre, 2)}` : ''}×${x.reps}`);
           return `<div class="f-panel" style="padding:12px"><strong style="font-size:14px">${meta?.superserie ? `${meta.superserie} · ` : ''}${escapar(ejercicio(ctx.datos, eid).nombre)}</strong>
           <p class="f-tenue">${ss.map((x) => `${marca(x)}${cifra(x)}${x.fallo ? ' al fallo' : x.rir !== undefined ? ` @${x.rir}` : ''}`).join(' · ')}</p>
           ${meta?.notas ? `<p class="f-tenue" style="font-style:italic">${escapar(meta.notas)}</p>` : ''}</div>`;
         })
         .join('')}
       <p class="f-tenue">Volumen: ${num(volumenSesion(ctx.datos, s))} kg${s.origen === 'importado' ? ' · importado' : ''}</p>
       ${s.cardio.map((c) => `<p class="f-tenue">${escapar(NOMBRE_CARDIO[c.tipo] ?? c.tipo)} · ${c.minutos} min${c.velocidad ? ` · ${num(c.velocidad, 1)} km/h` : ''}${c.inclinacion ? ` · ${num(c.inclinacion, 1)} % de inclinación` : ''} · ${num(c.kcal)} kcal</p>`).join('')}
       ${s.notas ? `<p class="f-explica">${escapar(s.notas)}</p>` : ''}
       <button type="button" class="f-boton f-boton--peligro" data-a="sesion-borrar" data-id="${s.id}">${ic('basura', 15)}Borrar este entreno</button>`,
      { titulo: 'Entreno' },
    );
  }

  function hojaEjercicio(eid) {
    const e = ejercicio(ctx.datos, eid);
    const h = historialEjercicio(ctx.datos, eid);
    const mejor = mejorMarca(ctx.datos, eid);
    ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>${escapar(e.nombre)}</h2>
         <button type="button" class="f-chip" data-a="principal" data-id="${eid}" aria-pressed="${e.principal}">${ic('estrella', 14)}Principal</button></div>
       <p class="f-tenue">${escapar(e.grupo)} · Los principales se usan en el asesor de descarga y en los avisos de fuerza.</p>
       ${mejor ? `<div class="f-resultado"><div><span>1RM estimado</span><b>${num(mejor.e1rm, 1)} kg</b><small>${num(mejor.kg, 2)} × ${mejor.reps} · ${escapar(fechaCorta(mejor.fecha))}</small></div><div><span>Sesiones</span><b>${h.length}</b><small>con series efectivas</small></div></div>` : ''}
       ${grafica({ series: [{ puntos: h.map((p) => ({ x: p.fecha, y: p.e1rm })), clase: 'hielo' }, { puntos: h.map((p) => ({ x: p.fecha, y: p.kg })), puntosVisibles: true, clase: 'azul' }], vacio: 'Haz al menos dos sesiones para ver la gráfica' })}
       <div class="f-leyenda"><span><i style="--c:var(--f-hielo)"></i>1RM estimado (Epley)</span><span><i></i>Mejor peso</span></div>`,
      { titulo: e.nombre },
    );
  }

  // La biblioteca (crear, editar, alias, fusionar…) vive en biblioteca.js; su
  // botón «Progreso» abre esta ficha con la gráfica.
  const hojaBiblioteca = () => ctx.abrirBiblioteca();
  ctx.verEjercicio = (eid) => hojaEjercicio(eid);

  // ---------- Acciones ----------

  const guardarActiva = (cambio, opciones = { pintar: false }) => ctx.guardar(actualizarActiva(ctx.datos, cambio), opciones);

  function empezar(rutina) {
    if (ctx.datos.activa) return ctx.tostada('Ya tienes un entreno en marcha.');
    ctx.guardar(empezarSesion(ctx.datos, { rutina, fecha: ctx.hoy() }));
    vibrar(25);
  }

  const acciones = {
    empezar: (el) => empezar(ctx.datos.rutinas.find((r) => r.id === el.dataset.id)),
    'empezar-libre': () => empezar(null),
    'serie-ok': (el) => {
      const s = ctx.datos.activa;
      const x = s?.series.find((y) => y.id === el.dataset.id);
      if (!x) return;
      const marcar = !x.hecha;
      // Si dejaste kg o reps vacíos, vale lo de la última vez (el texto gris).
      const fila = el.closest('.f-serie');
      const kg = x.kg || Number(fila.querySelector('[data-k="kg"]').placeholder.replace(',', '.')) || 0;
      const reps = x.reps || Number(fila.querySelector('[data-k="reps"]').placeholder) || 0;
      if (marcar && !reps) return ctx.tostada('Pon las repeticiones de la serie.');
      guardarActiva((a) => ({ series: a.series.map((y) => (y.id === x.id ? { ...y, kg, reps, hecha: marcar } : y)) }));
      ctx.repintar();
      vibrar(marcar ? 22 : 8);
      // Descanso: el de la serie, el del ejercicio en la rutina o el general.
      const enRutina = ctx.datos.rutinas.find((r) => r.id === s.rutinaId)?.ejercicios.find((e) => e.ejercicioId === x.ejercicioId);
      if (marcar && !x.calentamiento) empezarDescanso(x.descanso ?? enRutina?.descanso ?? ctx.datos.ajustes.descanso);
    },
    'serie-tipo': (el) => {
      guardarActiva((a) => ({ series: a.series.map((y) => (y.id === el.dataset.id ? { ...y, calentamiento: !y.calentamiento, tipo: y.calentamiento ? 'efectiva' : 'calentamiento' } : y)) }));
      ctx.repintar();
    },
    'serie-mas': (el) => {
      const eid = el.dataset.ej;
      const cal = el.dataset.calentamiento === '1';
      guardarActiva((a) => {
        const del = a.series.filter((y) => y.ejercicioId === eid);
        const ultima = del.at(-1);
        const nueva = { id: nuevoId('k'), ejercicioId: eid, kg: cal ? 0 : (ultima?.kg ?? 0), reps: cal ? 0 : (ultima?.reps ?? 0), calentamiento: cal, tipo: cal ? 'calentamiento' : 'efectiva', hecha: false };
        // El calentamiento va delante de las efectivas.
        const series = [...a.series];
        const pos = cal ? series.findIndex((y) => y.ejercicioId === eid) : series.map((y) => y.ejercicioId).lastIndexOf(eid) + 1;
        series.splice(pos < 0 ? series.length : pos, 0, nueva);
        return { series };
      });
      ctx.repintar();
    },
    'ejercicio-menu': (el) => {
      const eid = el.dataset.id;
      const e = ejercicio(ctx.datos, eid);
      ctx.hojas.abrir(
        `<div class="f-hoja__titulo"><h2>${escapar(e.nombre)}</h2></div>
         <button type="button" class="f-boton" data-a="ver-ejercicio" data-id="${eid}">${ic('progreso', 16)}Ver progreso</button>
         <button type="button" class="f-boton" data-a="discos" data-ej="${eid}">${ic('discos', 16)}Calcular discos</button>
         <button type="button" class="f-boton f-boton--peligro" data-a="ejercicio-quitar" data-id="${eid}">${ic('basura', 16)}Quitar del entreno</button>`,
        { titulo: e.nombre },
      );
    },
    'ver-ejercicio': (el) => {
      ctx.hojas.cerrar();
      hojaEjercicio(el.dataset.id);
    },
    'ejercicio-quitar': (el) => {
      ctx.hojas.cerrar();
      guardarActiva((a) => ({ series: a.series.filter((y) => y.ejercicioId !== el.dataset.id) }));
      ctx.repintar();
    },
    'ejercicio-anadir': () =>
      hojaElegirEjercicio((eid) => {
        ctx.hojas.cerrar();
        const u = ultimaVez(ctx.datos, eid);
        guardarActiva((a) => ({ series: [...a.series, ...Array.from({ length: Math.max(3, u?.series.length ?? 3) }, (_, i) => ({ id: nuevoId('k'), ejercicioId: eid, kg: 0, reps: 0, calentamiento: false, hecha: false, _i: i }))] }));
        ctx.repintar();
      }),
    'elegir-ejercicio': (el) => ctx.estado.local.elegir?.alElegir?.(el.dataset.id),
    'crear-ejercicio': () => {
      const hoja = ctx.estado.local.elegir;
      const nombre = hoja.cuerpo.querySelector('[data-entrada="buscar-ejercicio"]').value.trim();
      const grupoCaja = hoja.cuerpo.querySelector('[data-grupo-nuevo]');
      if (grupoCaja.hidden) {
        grupoCaja.hidden = false;
        return ctx.tostada('Elige su grupo muscular y vuelve a tocar «Crear».');
      }
      const grupo = hoja.cuerpo.querySelector('[data-grupo]').value;
      const r = crearEjercicio(ctx.datos, nombre, grupo);
      ctx.guardar(r.datos, { pintar: false });
      hoja.alElegir(r.ejercicio.id);
    },
    discos: (el) => {
      const eid = el?.dataset?.ej;
      const s = ctx.datos.activa;
      const kg = eid && s ? Math.max(0, ...s.series.filter((x) => x.ejercicioId === eid && !x.calentamiento).map((x) => x.kg)) || ultimaVez(ctx.datos, eid)?.series[0]?.kg : null;
      if (ctx.hojas.abierta()?.el?.querySelector('[data-a="ejercicio-quitar"]')) ctx.hojas.cerrar();
      hojaDiscos(kg || null);
    },
    cardio: () => {
      ctx.hojas.abrir(
        `<div class="f-hoja__titulo"><h2>Cardio</h2></div>
         <form class="f-columna" data-form="cardio">
           <div class="f-rejilla-2">
             <label class="f-campo"><span>Qué</span><select class="f-entrada" name="tipo">${TIPOS_CARDIO.map(([k, t]) => `<option value="${k}">${t}</option>`).join('')}</select></label>
             <label class="f-campo"><span>Minutos</span><input class="f-entrada" name="minutos" type="number" inputmode="numeric" value="20" required></label>
             <label class="f-campo"><span>Intensidad</span><select class="f-entrada" name="intensidad"><option value="baja">Baja</option><option value="media" selected>Media</option><option value="alta">Alta</option></select></label>
             <label class="f-campo"><span>Velocidad (opc.)</span><div class="f-con-unidad" data-unidad="km/h"><input class="f-entrada" name="velocidad" type="text" inputmode="decimal" autocomplete="off"></div></label>
             <label class="f-campo"><span>Inclinación (opc.)</span><div class="f-con-unidad" data-unidad="%"><input class="f-entrada" name="inclinacion" type="text" inputmode="decimal" autocomplete="off"></div></label>
           </div>
           <p class="f-tenue">Con velocidad (e inclinación) en cinta, andar o correr, las kcal se calculan con las fórmulas del ACSM; si no, por tipo e intensidad.</p>
           <button type="submit" class="f-boton f-boton--azul">Añadir cardio</button>
         </form>`,
        { titulo: 'Cardio' },
      );
    },
    'cardio-quitar': (el) => {
      guardarActiva((a) => ({ cardio: a.cardio.filter((c) => c.id !== el.dataset.id) }));
      ctx.repintar();
    },
    terminar: () => {
      const s = ctx.datos.activa;
      const hechas = s.series.filter((x) => x.hecha && x.reps > 0);
      if (!hechas.length && !s.cardio.length) {
        return ctx.tostada('Marca al menos una serie como hecha (✓) o descarta el entreno.');
      }
      const antes = new Set(ctx.datos.hitos.filter((h) => h.cumplido).map((h) => h.id));
      const datos = terminarSesion(ctx.datos);
      const nuevos = datos.hitos.filter((h) => h.cumplido && !antes.has(h.id));
      descanso = null;
      pintarDescanso();
      const ef = hechas.filter((x) => !x.calentamiento);
      const records = ef.filter((x) => {
        const previa = mejorMarca(ctx.datos, x.ejercicioId);
        return tipoSerie(x) === 'efectiva' && (!previa || epley(carga(x), x.reps) > previa.e1rm + 0.01);
      });
      ctx.guardar(datos);
      vibrar([30, 60, 30]);
      ctx.tostada(nuevos.length ? `¡Hito cumplido! ${nuevos[0].recompensa || ''}`.trim() : `Entreno guardado: ${ef.length} series, ${num(volumenSesion(ctx.datos, { series: ef }))} kg${records.length ? ` · ${new Set(records.map((x) => x.ejercicioId)).size} récord${records.length > 1 ? 's' : ''}` : ''}`, { ms: 6000 });
    },
    'descartar-sesion': () => {
      ctx.hojas.abrir(
        `<div class="f-hoja__titulo"><h2>¿Descartar el entreno?</h2></div><p class="f-explica">Se perderán las series de esta sesión.</p>
         <div class="f-fila"><button type="button" class="f-boton" data-cerrar-hoja style="flex:1">Seguir entrenando</button><button type="button" class="f-boton f-boton--peligro" data-a="descartar-si" style="flex:1">Descartar</button></div>`,
      );
    },
    'descartar-si': () => {
      ctx.hojas.cerrarTodas();
      descanso = null;
      pintarDescanso();
      ctx.guardar(descartarActiva(ctx.datos));
    },
    'descanso-mas': (el) => {
      if (!descanso) return;
      descanso.fin += Number(el.dataset.s) * 1000;
    },
    'descanso-fin': () => {
      descanso = null;
      pintarDescanso();
    },
    'sesion-ver': (el) => {
      const s = ctx.datos.sesiones.find((x) => x.id === el.dataset.id);
      if (s) hojaSesion(s);
    },
    'sesion-borrar': (el) => {
      const antes = ctx.datos;
      ctx.hojas.cerrar();
      ctx.guardar(borrarSesion(ctx.datos, el.dataset.id));
      ctx.tostada('Entreno borrado', { accion: () => ctx.guardar(antes) });
    },
    'rutina-nueva': () => hojaRutina(),
    'rutina-editar': (el) => hojaRutina(ctx.datos.rutinas.find((r) => r.id === el.dataset.id)),
    'rutina-ejercicio': () =>
      hojaElegirEjercicio((eid) => {
        ctx.hojas.cerrar();
        ctx.estado.local.rutina.ejercicios.push({ ejercicioId: eid, series: 3, repMin: 8, repMax: 12 });
        pintarRutina();
      }),
    'rutina-quitar': (el) => {
      ctx.estado.local.rutina.ejercicios.splice(Number(el.dataset.i), 1);
      pintarRutina();
    },
    'rutina-guardar': () => {
      const r = ctx.estado.local.rutina;
      if (!r.nombre.trim()) return ctx.tostada('Ponle un nombre a la rutina.');
      if (!r.ejercicios.length) return ctx.tostada('Añade al menos un ejercicio.');
      ctx.hojas.cerrarTodas();
      ctx.guardar(guardarRutina(ctx.datos, { ...r, nombre: r.nombre.trim() }));
      ctx.tostada(`Rutina «${r.nombre.trim()}» guardada`);
    },
    'rutina-borrar': () => {
      const r = ctx.estado.local.rutina;
      const antes = ctx.datos;
      ctx.hojas.cerrarTodas();
      ctx.guardar(borrarRutina(ctx.datos, r.id));
      ctx.tostada('Rutina borrada', { accion: () => ctx.guardar(antes) });
    },
    biblioteca: () => hojaBiblioteca(),
    principal: (el) => {
      ctx.guardar(alternarPrincipal(ctx.datos, el.dataset.id), { pintar: false });
      const e = ejercicio(ctx.datos, el.dataset.id);
      el.setAttribute('aria-pressed', String(e.principal));
    },
    'deload-si': () => {
      ctx.guardar(aceptarDescarga(ctx.datos, ctx.hoy()));
      ctx.tostada('Semana de descarga: mismos pesos, la mitad de series. El asesor vuelve a contar desde hoy.', { ms: 6000 });
    },
    'deload-no': () => ctx.guardar(descartarDescarga(ctx.datos, ctx.hoy())),
    'ver-aviso': (el) => ctx.guardar(verAviso(ctx.datos, el.dataset.id)),
  };

  const entradas = {
    serie: (el) => {
      const k = el.dataset.k;
      const v = el.value === '' ? (k === 'rir' ? undefined : 0) : Math.max(0, Number(el.value.replace(',', '.')) || 0);
      guardarActiva((a) => ({ series: a.series.map((y) => (y.id === el.dataset.id ? { ...y, [k]: v } : y)) }));
    },
    'sesion-notas': (el) => guardarActiva(() => ({ notas: el.value })),
    'buscar-ejercicio': (el) => {
      const hoja = ctx.estado.local.elegir;
      if (hoja) hoja.cuerpo.querySelector('[data-lista-ejercicios]').innerHTML = hoja.pintarLista(el.value.trim());
    },
    discos: (el) => ctx.estado.local.discos?.pintarDiscos(el.value),
    'rutina-nombre': (el) => {
      ctx.estado.local.rutina.nombre = el.value;
    },
    'rutina-num': (el) => {
      const e = ctx.estado.local.rutina.ejercicios[Number(el.dataset.i)];
      if (e) e[el.dataset.k] = Math.max(1, Math.min(100, Number(el.value) || 1));
    },
  };

  const formularios = {
    cardio: (form) => {
      const minutos = Number(form.elements.minutos.value);
      if (!(minutos > 0)) return;
      const peso = pesoDeReferencia(ctx.datos, ctx.hoy()) ?? ctx.datos.perfil?.peso ?? 75;
      const n = (k) => {
        const v = Number(String(form.elements[k].value).replace(',', '.'));
        return form.elements[k].value !== '' && Number.isFinite(v) && v >= 0 ? v : undefined;
      };
      const base = { tipo: form.elements.tipo.value, minutos, intensidad: form.elements.intensidad.value, velocidad: n('velocidad'), inclinacion: n('inclinacion') };
      const c = { id: nuevoId('c'), ...base, kcal: kcalDeCardio(base, peso) };
      ctx.hojas.cerrar();
      guardarActiva((a) => ({ cardio: [...a.cardio, c] }));
      ctx.repintar();
    },
  };

  return { html, despues, acciones, entradas, formularios };
}

