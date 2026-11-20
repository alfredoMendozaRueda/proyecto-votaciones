// Progreso → Semanas: el resumen de la última semana, la vista previa de la
// semana en curso, la gráfica de medias semanales con los hitos, el próximo hito,
// el historial y el detalle de cada semana (con «Regenerar»). También el editor
// de hitos (Perfil → Hitos y recompensas) y la celebración al conseguir uno.
import { metricasSemana, hitosDePeso, hitosRedondos, proximoHito, pesoInicial, momentoGeneracion, aplicarPropuesta, descartarPropuesta } from '../../compartido/forma/semanas.js';
import { mediasSemanales } from '../../compartido/forma/progreso.js';
import { lunesDe, sumarDias, fechaCorta } from '../../compartido/forma/fechas.js';
import { deKg, aKg, unidadPeso } from '../../compartido/forma/calculos.js';
import { id as nuevoId } from '../../compartido/forma/datos.js';
import { ic, escapar, num, signo, grafica } from './ui.js';

const ESTADOS = {
  verde: { nombre: 'Ritmo ideal', clase: 'verde' },
  amarillo: { nombre: 'Lento', clase: 'amarillo' },
  rojo: { nombre: 'Demasiado rápido', clase: 'rojo' },
  gris: { nombre: 'Datos insuficientes', clase: 'gris' },
  neutro: { nombre: 'Fuera del rango ideal', clase: 'neutro' },
};
const DIAS = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

export function crearSemanas(ctx) {
  const u = () => ctx.datos.perfil?.unidades ?? 'metrico';
  const P = (kg, d = 1) => num(deKg(kg, u()), d);
  const U = () => unidadPeso(u());
  const rangoSemana = (lunes) => `${fechaCorta(lunes)} – ${fechaCorta(sumarDias(lunes, 6))}`;
  const punto = (estado) => `<i class="f-semaforo f-semaforo--${ESTADOS[estado]?.clase ?? 'gris'}" aria-hidden="true"></i>`;
  const ultimo = () => ctx.datos.resumenes.at(-1) ?? null;

  // ---------- Bloques ----------

  function cabeceraPeso(m) {
    const p = m.peso;
    return `<div class="f-sem__peso">
      <div><span class="f-sem__cifra">${p.media !== null ? P(p.media, 1) : '—'}</span><span class="f-tenue"> ${U()} de media</span></div>
      <div class="f-sem__cambio">${p.cambioKg !== null ? `${signo(deKg(p.cambioKg, u()), 2)} ${U()} · ${signo(p.cambioPct, 2)} %` : 'sin semana anterior'}</div>
    </div>
    <p class="f-sem__ritmo">${punto(p.ritmo.estado)}<b>${escapar(ESTADOS[p.ritmo.estado]?.nombre ?? '')}</b> · ${escapar(p.ritmo.texto)}</p>`;
  }

  function chips(m) {
    const n = m.nutricion;
    const e = m.entreno;
    return `<div class="f-sem__chips">
      <span>${ic('diario', 13)} ${n.dias}/7 días</span>
      <span>${ic('entreno', 13)} ${e.hechas}${e.planificadas ? `/${e.planificadas}` : ''} entrenos</span>
      <span>${ic('diana', 13)} proteína ${n.proteina.dias} d</span>
      ${e.records.length ? `<span>${ic('trofeo', 13)} ${e.records.length} récord${e.records.length > 1 ? 's' : ''}</span>` : ''}
      ${e.pasos ? `<span>👣 ${num(e.pasos.media)}</span>` : ''}
    </div>`;
  }

  // Propuesta de ajuste del objetivo (o lo que decidiste con ella).
  function bloquePropuesta(r) {
    const prop = r.datos.propuesta;
    if (!prop) return '';
    const cifra = `${prop.delta > 0 ? '+' : '−'}${num(Math.abs(prop.delta))} kcal al día`;
    if (r.decision === 'aplicada') return `<p class="f-sem__decision">${ic('check', 14)} Ajuste aplicado: ${cifra}.</p>`;
    if (r.decision === 'descartada') return `<p class="f-sem__decision f-tenue">Propuesta de ${cifra} descartada.</p>`;
    return `<div class="f-sem__propuesta" data-propuesta>
      <div class="f-fila">${ic('diana', 18)}<strong>Ajuste propuesto: ${cifra}</strong></div>
      <p class="f-explica">${escapar(prop.motivo)} Se aplica a tu objetivo de todos los días y puedes quitarlo en Perfil.</p>
      <div class="f-fila"><button type="button" class="f-boton f-boton--chico" data-a="sem-descartar" data-lunes="${r.id}">Ahora no</button><button type="button" class="f-boton f-boton--chico f-boton--azul" data-a="sem-aplicar" data-lunes="${r.id}" style="flex:1">Aplicar ${cifra}</button></div>
    </div>`;
  }

  function panelUltima() {
    const r = ultimo();
    if (!r) {
      const a = ctx.datos.ajustes;
      return `<section class="f-panel f-columna"><div class="f-etiqueta"><span>Última semana</span></div>
        <p class="f-explica">Tu primer resumen llegará el ${escapar(DIAS[a.resumenDia - 1].toLowerCase())}${a.resumenDia === 7 ? '' : ' siguiente'} a las ${escapar(a.resumenHora)}. Mientras, abajo tienes la semana en curso.</p></section>`;
    }
    const m = r.datos;
    return `<section class="f-panel f-panel--azul f-columna" data-panel="ultima">
      <div class="f-etiqueta"><span>Semana pasada · ${escapar(rangoSemana(r.id))}</span>${r.estado === 'datos_incompletos' ? '<b class="f-sem__aviso">datos incompletos</b>' : ''}</div>
      ${cabeceraPeso(m)}
      ${chips(m)}
      <p class="f-sem__texto">${escapar(r.texto)}</p>
      ${bloquePropuesta(r)}
      <button type="button" class="f-boton" data-a="sem-ver" data-lunes="${r.id}">${ic('progreso', 16)}Ver el resumen completo</button>
    </section>`;
  }

  function panelEnCurso() {
    const lunes = lunesDe(ctx.hoy());
    const m = metricasSemana(ctx.datos, lunes, { parcial: true });
    const p = m.peso;
    return `<section class="f-panel f-columna" data-panel="en-curso">
      <div class="f-etiqueta"><span>Semana en curso · ${escapar(rangoSemana(lunes))}</span><b>vista previa</b></div>
      <div class="f-kpis">
        <div class="f-kpi"><span>Media</span><b>${p.media !== null ? `${P(p.media, 1)}` : '—'}</b><small class="f-tenue">${p.n} pesaje${p.n === 1 ? '' : 's'}</small></div>
        <div class="f-kpi"><span>Días</span><b>${m.nutricion.dias}/7</b><small class="f-tenue">apuntados</small></div>
        <div class="f-kpi"><span>Entrenos</span><b>${m.entreno.hechas}${m.entreno.planificadas ? `/${m.entreno.planificadas}` : ''}</b><small class="f-tenue">${m.entreno.records.length ? `${m.entreno.records.length} récord${m.entreno.records.length > 1 ? 's' : ''}` : 'esta semana'}</small></div>
      </div>
      <p class="f-tenue">${p.cambioKg !== null ? `De momento ${signo(deKg(p.cambioKg, u()), 2)} ${U()} frente a la semana pasada. ` : ''}Se calcula al vuelo y no se guarda hasta que acabe la semana.</p>
    </section>`;
  }

  function panelGrafica() {
    const d = ctx.datos;
    const medias = mediasSemanales(d).slice(-26);
    const hitos = hitosDePeso(d);
    const pendientes = hitos.filter((h) => !h.cumplido).slice(0, 2);
    const lineas = [...hitos.filter((h) => h.cumplido).slice(-2), ...pendientes].map((h) => ({ y: deKg(h.valor, u()), etiqueta: `${P(h.valor, 1)}${h.recompensa ? ` · ${h.recompensa.slice(0, 18)}` : ''}`, hecha: Boolean(h.cumplido) }));
    return `<section class="f-panel f-columna">
      <div class="f-etiqueta"><span>Media semanal de peso</span><b>${medias.length} semanas</b></div>
      ${grafica({ series: [{ puntos: medias.map((s) => ({ x: sumarDias(s.lunes, 3), y: deKg(s.media, u()) })), puntosVisibles: true }], lineas, vacio: 'Con dos semanas con pesajes verás la tendencia' })}
      ${lineas.length ? '<div class="f-leyenda"><span><i></i>Media de cada semana</span><span><i style="--c:var(--f-hielo);height:0;border-top:1px dashed var(--f-hielo)"></i>Tus hitos</span></div>' : ''}
    </section>`;
  }

  function panelHito() {
    const d = ctx.datos;
    const h = proximoHito(d);
    const hechos = hitosDePeso(d).filter((x) => x.cumplido);
    const actual = mediasSemanales(d).at(-1)?.media ?? null;
    const inicial = pesoInicial(d);
    let cuerpo;
    if (!hitosDePeso(d).length) {
      const sug = hitosRedondos(d, actual ?? d.perfil?.peso);
      cuerpo = `<p class="f-explica">Ponte metas con premio: se consiguen cuando la <b style="color:var(--f-texto)">media de una semana</b> llega al peso, nunca por un pesaje suelto.</p>
        ${sug.length ? `<button type="button" class="f-boton f-boton--azul" data-a="sem-hitos-sugeridos">${ic('mas', 16)}Añadir ${escapar(sug.map((v) => P(v, 1)).join(', '))} ${U()}</button>` : ''}`;
    } else if (!h) {
      cuerpo = `<p class="f-explica">¡Has conseguido todos tus hitos! Añade el siguiente cuando quieras.</p>`;
    } else {
      const total = inicial !== null ? inicial - h.valor : null;
      const progreso = actual === null || !total ? 0 : Math.max(0, Math.min(1, (inicial - actual) / total));
      const fecha = ultimo()?.datos?.proyeccion?.hito?.valor === h.valor ? ultimo().datos.proyeccion.hito.fecha : null;
      cuerpo = `<div class="f-sem__hito">
          <div><span class="f-tenue">Próximo hito</span><b>${P(h.valor, 1)} ${U()}</b>${h.recompensa ? `<span class="f-sem__premio">🎁 ${escapar(h.recompensa)}</span>` : ''}</div>
          <div class="f-sem__falta">${actual !== null ? `<b>${num(Math.max(0, deKg(actual - h.valor, u())), 1)}</b><span class="f-tenue">${U()} por bajar</span>` : '<span class="f-tenue">Sin pesajes aún</span>'}</div>
        </div>
        <div class="f-progreso f-progreso--grande" role="progressbar" aria-valuenow="${Math.round(progreso * 100)}" aria-valuemin="0" aria-valuemax="100"><i style="--p:${Math.round(progreso * 100)}%"></i></div>
        <p class="f-tenue">Desde ${inicial !== null ? `${P(inicial, 1)} ${U()}` : 'tu peso inicial'}${fecha ? ` · al ritmo actual, hacia el ${escapar(fechaCorta(fecha))}` : ''}. ${hechos.length ? `Conseguidos: ${hechos.map((x) => `${P(x.valor, 1)}`).join(', ')} ${U()}.` : ''}</p>`;
    }
    return `<section class="f-panel f-columna" data-panel="hito">
      <div class="f-etiqueta"><span>Hitos y recompensas</span><button type="button" class="f-enlace" data-a="sem-hitos">${ic('lapiz', 14)} Editar</button></div>
      ${cuerpo}
    </section>`;
  }

  function panelHistorial() {
    const lista = [...ctx.datos.resumenes].reverse();
    if (!lista.length) return '';
    return `<section class="f-panel f-panel--plano">
      <div class="f-etiqueta" style="padding:14px 14px 4px"><span>Semanas anteriores</span></div>
      <div class="f-lista">${lista
        .map((r) => {
          const p = r.datos.peso;
          return `<button type="button" class="f-item" data-a="sem-ver" data-lunes="${r.id}">
            ${punto(p.ritmo.estado)}
            <span class="f-item__texto"><span class="f-item__nombre">${escapar(rangoSemana(r.id))}</span>
            <span class="f-item__detalle">${p.media !== null ? `${P(p.media, 1)} ${U()}` : 'Sin pesajes'}${p.cambioKg !== null ? ` · ${signo(deKg(p.cambioKg, u()), 2)}` : ''}${r.datos.hitos.conseguidos.length ? ' · 🏆' : ''}${r.estado === 'datos_incompletos' ? ' · incompleto' : ''}</span></span>
            ${ic('adelante', 15)}</button>`;
        })
        .join('')}</div>
    </section>`;
  }

  function html() {
    pendienteCelebrar();
    return `${panelUltima()}${panelEnCurso()}${panelHito()}${panelGrafica()}${panelHistorial()}`;
  }

  // ---------- Detalle de una semana ----------

  const fila = (nombre, valor, extra = '') => `<div class="f-sem__fila"><span>${nombre}</span><b>${valor}</b>${extra ? `<small class="f-tenue">${extra}</small>` : ''}</div>`;
  const frente = (a, b, unidad = '', d = 0) => `${a !== null ? num(a, d) : '—'}${unidad} <span class="f-tenue">/ ${b !== null ? num(b, d) : '—'}${unidad}</span>`;

  function hojaDetalle(lunes) {
    const r = ctx.datos.resumenes.find((x) => x.id === lunes);
    if (!r) return;
    const m = r.datos;
    const p = m.peso;
    const n = m.nutricion;
    const e = m.entreno;
    const pr = m.proyeccion;
    const h = m.hitos;
    ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Semana del ${escapar(rangoSemana(lunes))}</h2></div>
       ${r.estado === 'datos_incompletos' ? '<p class="f-sem__aviso">Datos incompletos: menos de 5 días apuntados o menos de 4 pesajes.</p>' : ''}
       <section class="f-sem__bloque">${cabeceraPeso(m)}
         ${fila('Pesajes', `${p.n} de 7`)}
         ${p.mediaAnterior !== null ? fila('Semana anterior', `${P(p.mediaAnterior, 2)} ${U()}`) : ''}
         ${p.ritmo.kgSemana !== null ? fila('Ritmo', `${signo(deKg(p.ritmo.kgSemana, u()), 2)} ${U()}/sem`, `${signo(p.ritmo.pctSemana, 2)} % del peso`) : ''}
         ${p.grasa ? fila('% de grasa', `${num(p.grasa.media, 1)} %`, p.grasa.cambio !== null ? `${signo(p.grasa.cambio, 1)} puntos` : '') : ''}
         ${p.magra ? fila('Masa magra', `${P(p.magra.media, 1)} ${U()}`, p.magra.cambio !== null ? `${signo(deKg(p.magra.cambio, u()), 1)} ${U()}` : '') : ''}
         ${p.grasa || p.magra ? '<p class="f-tenue">El % de grasa por bioimpedancia es orientativo: fíjate en la tendencia.</p>' : ''}
       </section>
       <section class="f-sem__bloque"><span class="f-etiqueta">Nutrición${n.completo ? '' : ' · datos incompletos'}</span>
         ${fila('Días apuntados', `${n.dias} de 7`)}
         ${fila('Kcal de media', frente(n.kcal.media, n.kcal.objetivo, ''), 'frente a tu objetivo de esos días')}
         ${fila('En objetivo (±10 %)', `${n.adherencia.dias} de ${n.adherencia.de} días`)}
         ${fila('Proteína', frente(n.proteina.media, n.proteina.objetivo, ' g'), `objetivo cumplido ${n.proteina.dias} días`)}
         ${fila('Hidratos', frente(n.hidratos.media, n.hidratos.objetivo, ' g'))}
         ${fila('Grasa', frente(n.grasa.media, n.grasa.objetivo, ' g'))}
         ${fila('Fibra', frente(n.fibra.media, n.fibra.objetivo, ' g'))}
         ${
           n.maximo
             ? `<div class="f-sem__fila"><span>Día con más kcal</span><b>${num(n.maximo.kcal)} kcal</b><small class="f-tenue">${escapar(fechaCorta(n.maximo.fecha))}${n.maximo.nota ? ` · ${escapar(n.maximo.nota)}` : ''}</small></div>
                <form class="f-fila" data-form="sem-nota" data-fecha="${n.maximo.fecha}" data-lunes="${lunes}"><input class="f-entrada" name="nota" maxlength="80" placeholder="Nota de ese día (cumpleaños…)" value="${escapar(ctx.datos.dias[n.maximo.fecha]?.nota ?? '')}" style="flex:1"><button type="submit" class="f-boton f-boton--chico">Guardar</button></form>`
             : ''
         }
       </section>
       <section class="f-sem__bloque"><span class="f-etiqueta">Entreno y actividad</span>
         ${fila('Sesiones', `${e.hechas}${e.planificadas ? ` de ${e.planificadas}` : ''}`, e.planificadas ? 'si cambiaste un entreno de día, cuenta igual' : '')}
         ${fila('Volumen total', `${num(e.volumen)} kg`, e.volumenAnterior ? `semana anterior ${num(e.volumenAnterior)} kg` : '')}
         ${e.sesiones.map((s) => fila(`· ${escapar(s.nombre)} <span class="f-tenue">${escapar(fechaCorta(s.fecha))}</span>`, `${num(s.volumen)} kg`)).join('')}
         ${e.grupos.length ? `<div class="f-sem__grupos">${e.grupos.map((g) => `<span><b>${escapar(g.grupo)}</b> ${num(g.volumen)} kg${g.anterior ? ` <small class="${g.volumen >= g.anterior ? 'f-sube' : 'f-baja'}">${signo(g.volumen - g.anterior, 0)}</small>` : ''}</span>`).join('')}</div>` : ''}
         ${e.records.length ? `<span class="f-etiqueta">${ic('trofeo', 13)} Récords</span>${e.records.map((x) => fila(escapar(x.nombre), `${num(x.kg, 2)} × ${x.reps}`, `1RM ${num(x.e1rm, 1)} kg${x.anterior ? ` (antes ${num(x.anterior, 1)})` : ''}`)).join('')}` : ''}
         ${fila('Cardio', `${num(e.cardioMin)} min`)}
         ${e.pasos ? fila('Pasos', `${num(e.pasos.media)} de media`, `${e.pasos.dias} días con Apple Salud`) : ''}
         ${e.descarga ? `<p class="f-sem__aviso">${escapar(e.descarga.texto)} ${escapar(e.descarga.propuesta)}</p>` : ''}
       </section>
       <section class="f-sem__bloque"><span class="f-etiqueta">Proyección e hitos</span>
         ${pr ? fila('Tendencia (3 semanas)', `${signo(deKg(pr.kgSemana, u()), 2)} ${U()}/sem`) : '<p class="f-tenue">Hacen falta 10 pesajes en las últimas 3 semanas para estimar fechas.</p>'}
         ${pr?.hito ? fila(`Próximo hito (${P(pr.hito.valor, 1)} ${U()})`, pr.hito.fecha ? escapar(fechaCorta(pr.hito.fecha)) : '—', pr.hito.fecha ? 'fecha estimada' : 'a este ritmo no se alcanza') : ''}
         ${pr?.objetivo ? fila(`Objetivo (${P(pr.objetivo.valor, 1)} ${U()})`, pr.objetivo.fecha ? escapar(fechaCorta(pr.objetivo.fecha)) : '—', pr.objetivo.fecha ? 'fecha estimada' : 'a este ritmo no se alcanza') : ''}
         ${h.conseguidos.map((x) => `<p class="f-sem__logro">🏆 Hito conseguido: <b>${P(x.valor, 1)} ${U()}</b>${x.recompensa ? ` → ${escapar(x.recompensa)}` : ''}</p>`).join('')}
         ${h.proximo ? fila('Te faltan', h.proximo.faltan !== null ? `${num(Math.max(0, deKg(h.proximo.faltan, u())), 1)} ${U()}` : '—', `para ${P(h.proximo.valor, 1)} ${U()}${h.proximo.recompensa ? ` · ${escapar(h.proximo.recompensa)}` : ''}`) : ''}
       </section>
       ${m.propuesta ? `<section class="f-sem__bloque"><span class="f-etiqueta">Ajuste del objetivo</span>${bloquePropuesta(r)}</section>` : ''}
       <section class="f-sem__bloque"><span class="f-etiqueta">Resumen${r.origen === 'ia' ? ' · escrito por la IA con estas cifras' : ''}</span><p class="f-sem__texto">${escapar(r.texto)}</p>
         <p class="f-tenue">Generado el ${escapar(new Date(r.generado).toLocaleString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}. Es una foto: si apuntas algo tarde, pulsa «Regenerar».</p></section>
       <button type="button" class="f-boton" data-a="sem-regenerar" data-lunes="${lunes}">${ic('chispa', 16)}Regenerar esta semana</button>`,
      { clase: 'f-hoja--alta', titulo: 'Resumen semanal' },
    );
  }

  // ---------- Celebración ----------

  let celebrando = false;
  function pendienteCelebrar() {
    if (celebrando) return;
    const h = hitosDePeso(ctx.datos).find((x) => x.cumplido && x.semana && !ctx.datos.celebrados.includes(x.id));
    if (!h) return;
    celebrando = true;
    setTimeout(() => celebrar(h), 250);
  }

  function celebrar(h) {
    const media = mediasSemanales(ctx.datos).find((s) => s.lunes === h.semana)?.media ?? null;
    ctx.hojas.abrir(
      `<div class="f-fiesta" aria-hidden="true">${Array.from({ length: 18 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
       <div class="f-celebra">
         <span class="f-celebra__trofeo">${ic('trofeo', 40)}</span>
         <span class="f-etiqueta">¡Hito conseguido!</span>
         <b class="f-celebra__peso">${P(h.valor, 1)} ${U()}</b>
         ${h.recompensa ? `<p class="f-celebra__premio">🎁 ${escapar(h.recompensa)}</p>` : '<p class="f-tenue">Elige tu recompensa en «Editar hitos».</p>'}
         <p class="f-tenue">Media de la semana del ${escapar(rangoSemana(h.semana))}${media !== null ? `: ${P(media, 2)} ${U()}` : ''}. Te lo has ganado.</p>
         <button type="button" class="f-boton f-boton--azul f-boton--ancho" data-a="sem-celebrado" data-id="${h.id}">¡Gracias!</button>
       </div>`,
      {
        titulo: 'Hito conseguido',
        alCerrar: () => {
          celebrando = false;
          marcarCelebrado(h.id);
        },
      },
    );
  }

  function marcarCelebrado(idHito) {
    if (ctx.datos.celebrados.includes(idHito)) return;
    ctx.guardar({ ...ctx.datos, celebrados: [...ctx.datos.celebrados, idHito] }, { pintar: false });
  }

  // ---------- Editor de hitos ----------

  function htmlEditor() {
    const d = ctx.datos;
    const lista = hitosDePeso(d);
    const actual = mediasSemanales(d).at(-1)?.media ?? d.perfil?.peso;
    const sug = hitosRedondos(d, actual);
    return `<p class="f-explica">Se consiguen cuando la <b style="color:var(--f-texto)">media semanal</b> llega al peso (nunca por un pesaje suelto) y ya no se pierden. Ordénalos como quieras: el primero sin conseguir es «el próximo».</p>
      <div class="f-columna" data-editor-hitos>${lista
        .map(
          (h, i) => `<div class="f-hito-ed${h.cumplido ? ' cumplido' : ''}">
          <div class="f-hito-ed__orden">
            <button type="button" class="f-icono-boton" data-a="sem-hito-subir" data-id="${h.id}" aria-label="Subir" ${i === 0 ? 'disabled' : ''}>${ic('atras', 14)}</button>
            <button type="button" class="f-icono-boton" data-a="sem-hito-bajar" data-id="${h.id}" aria-label="Bajar" ${i === lista.length - 1 ? 'disabled' : ''}>${ic('adelante', 14)}</button>
          </div>
          <label class="f-con-unidad" data-unidad="${U()}"><input class="f-entrada" type="text" inputmode="decimal" autocomplete="off" value="${num(deKg(h.valor, u()), 1).replace(/\./g, '')}" data-cambio="sem-hito-valor" data-id="${h.id}" aria-label="Peso del hito"></label>
          <input class="f-entrada" maxlength="120" placeholder="Recompensa" value="${escapar(h.recompensa ?? '')}" data-cambio="sem-hito-premio" data-id="${h.id}" aria-label="Recompensa">
          <button type="button" class="f-icono-boton" data-a="sem-hito-borrar" data-id="${h.id}" aria-label="Borrar hito">${ic('basura', 15)}</button>
          ${h.cumplido ? `<small class="f-hito-ed__hecho">🏆 Conseguido la semana del ${escapar(fechaCorta(h.semana ?? h.cumplido))}</small>` : ''}
        </div>`,
        )
        .join('')}</div>
      <form class="f-fila" data-form="sem-hito-nuevo">
        <label class="f-con-unidad" data-unidad="${U()}" style="width:110px"><input class="f-entrada" name="valor" type="text" inputmode="decimal" autocomplete="off" placeholder="Peso" required></label>
        <input class="f-entrada" name="recompensa" maxlength="120" placeholder="Recompensa (opcional)" style="flex:1">
        <button type="submit" class="f-boton f-boton--azul f-boton--chico">${ic('mas', 14)}</button>
      </form>
      ${sug.length ? `<button type="button" class="f-boton f-boton--fantasma" data-a="sem-hitos-sugeridos">${ic('chispa', 15)}Añadir ${escapar(sug.map((v) => P(v, 1)).join(', '))} ${U()}</button>` : ''}`;
  }

  let hojaHitos = null;
  function abrirHitos() {
    hojaHitos = ctx.hojas.abrir(`<div class="f-hoja__titulo"><h2>Hitos y recompensas</h2></div><div data-hitos-cuerpo>${htmlEditor()}</div>`, {
      clase: 'f-hoja--alta',
      titulo: 'Hitos',
      alCerrar: () => {
        hojaHitos = null;
        ctx.repintar();
      },
    });
  }
  function repintarEditor() {
    const caja = document.querySelector('[data-hitos-cuerpo]');
    if (caja) caja.innerHTML = htmlEditor();
  }

  // Guarda los hitos de peso en el orden de la lista (los demás tipos, igual).
  function guardarOrden(lista) {
    const orden = new Map(lista.map((h, i) => [h.id, i]));
    const hitos = ctx.datos.hitos.map((h) => (orden.has(h.id) ? { ...h, orden: orden.get(h.id) } : h));
    ctx.guardar({ ...ctx.datos, hitos }, { pintar: false });
    repintarEditor();
  }
  const cambiarHito = (idHito, cambios) => ctx.guardar({ ...ctx.datos, hitos: ctx.datos.hitos.map((h) => (h.id === idHito ? { ...h, ...cambios } : h)) }, { pintar: false });
  const leerKg = (texto) => {
    const v = Number(String(texto).replace(',', '.'));
    return v > 0 ? Math.round(aKg(v, u()) * 10) / 10 : null;
  };
  const comparador = () => (Number.isFinite(ctx.datos.perfil?.pesoObjetivo) && ctx.datos.perfil.pesoObjetivo > (pesoInicial(ctx.datos) ?? 0) ? '>' : '<');

  // Añade hitos y deja los de peso ordenados de más cerca a más lejos.
  function anadirHitos(valores) {
    const baja = comparador() === '<';
    const nuevos = valores.map((valor) => ({ id: nuevoId('h'), tipo: 'peso', comparador: comparador(), valor, recompensa: '', cumplido: null }));
    const todos = [...ctx.datos.hitos, ...nuevos];
    const peso = todos.filter((h) => h.tipo === 'peso').sort((a, b) => (baja ? b.valor - a.valor : a.valor - b.valor));
    const orden = new Map(peso.map((h, i) => [h.id, i]));
    ctx.guardar({ ...ctx.datos, hitos: todos.map((h) => (orden.has(h.id) ? { ...h, orden: orden.get(h.id) } : h)) }, { pintar: false });
  }

  const acciones = {
    'sem-ver': (el) => hojaDetalle(el.dataset.lunes),
    'sem-aplicar': (el) => {
      const antes = ctx.datos;
      const r = ctx.datos.resumenes.find((x) => x.id === el.dataset.lunes);
      ctx.hojas.cerrarTodas();
      ctx.guardar(aplicarPropuesta(ctx.datos, el.dataset.lunes, ctx.hoy()));
      ctx.tostada(`Objetivo ajustado: ${r.datos.propuesta.delta > 0 ? '+' : '−'}${num(Math.abs(r.datos.propuesta.delta))} kcal al día.`, { accion: () => ctx.guardar(antes), ms: 7000 });
    },
    'sem-descartar': (el) => {
      ctx.hojas.cerrarTodas();
      ctx.guardar(descartarPropuesta(ctx.datos, el.dataset.lunes));
    },
    'sem-regenerar': async (el) => {
      el.disabled = true;
      el.innerHTML = '<span class="f-cargando"></span>Regenerando…';
      await ctx.generarSemana(el.dataset.lunes, { ia: true });
      ctx.hojas.cerrarTodas();
      ctx.repintar();
      hojaDetalle(el.dataset.lunes);
      ctx.tostada('Semana recalculada con tus datos actuales.');
    },
    'sem-celebrado': (el) => {
      marcarCelebrado(el.dataset.id);
      ctx.hojas.cerrar();
    },
    'sem-hitos': () => abrirHitos(),
    'sem-hitos-sugeridos': () => {
      const actual = mediasSemanales(ctx.datos).at(-1)?.media ?? ctx.datos.perfil?.peso;
      const sug = hitosRedondos(ctx.datos, actual);
      if (!sug.length) return;
      anadirHitos(sug);
      ctx.tostada(`Hitos añadidos: ${sug.map((v) => P(v, 1)).join(', ')} ${U()}. Escribe sus recompensas.`);
      if (hojaHitos) repintarEditor();
      else abrirHitos();
    },
    'sem-hito-subir': (el) => {
      const lista = hitosDePeso(ctx.datos);
      const i = lista.findIndex((h) => h.id === el.dataset.id);
      if (i > 0) [lista[i - 1], lista[i]] = [lista[i], lista[i - 1]];
      guardarOrden(lista);
    },
    'sem-hito-bajar': (el) => {
      const lista = hitosDePeso(ctx.datos);
      const i = lista.findIndex((h) => h.id === el.dataset.id);
      if (i >= 0 && i < lista.length - 1) [lista[i + 1], lista[i]] = [lista[i], lista[i + 1]];
      guardarOrden(lista);
    },
    'sem-hito-borrar': (el) => {
      if (el.dataset.confirmar !== '1') {
        el.dataset.confirmar = '1';
        el.classList.add('f-icono-boton--peligro');
        el.setAttribute('aria-label', 'Toca otra vez para borrar');
        setTimeout(() => {
          el.dataset.confirmar = '';
          el.classList.remove('f-icono-boton--peligro');
        }, 3000);
        return;
      }
      ctx.guardar({ ...ctx.datos, hitos: ctx.datos.hitos.filter((h) => h.id !== el.dataset.id) }, { pintar: false });
      repintarEditor();
    },
  };

  const cambios = {
    'sem-hito-valor': (el) => {
      const kg = leerKg(el.value);
      if (kg === null || kg < 30 || kg > 300) return ctx.tostada('Escribe un peso válido.');
      cambiarHito(el.dataset.id, { valor: kg });
    },
    'sem-hito-premio': (el) => cambiarHito(el.dataset.id, { recompensa: el.value.trim().slice(0, 120) }),
  };

  const formularios = {
    'sem-hito-nuevo': (form) => {
      const kg = leerKg(form.elements.valor.value);
      if (kg === null || kg < 30 || kg > 300) return ctx.tostada('Escribe un peso válido.');
      const base = hitosDePeso(ctx.datos);
      const nuevo = { id: nuevoId('h'), tipo: 'peso', comparador: comparador(), valor: kg, recompensa: form.elements.recompensa.value.trim().slice(0, 120), cumplido: null, orden: base.length };
      ctx.guardar({ ...ctx.datos, hitos: [...ctx.datos.hitos, nuevo] }, { pintar: false });
      guardarOrden([...base, nuevo]);
    },
    'sem-nota': (form) => {
      const fecha = form.dataset.fecha;
      const nota = form.elements.nota.value.trim().slice(0, 80);
      const dia = { agua: 0, suplementos: [], ...ctx.datos.dias[fecha], nota: nota || undefined };
      ctx.guardar({ ...ctx.datos, dias: { ...ctx.datos.dias, [fecha]: dia } }, { pintar: false });
      ctx.tostada('Nota guardada. Pulsa «Regenerar» para que salga en el resumen.');
    },
  };

  return { html, acciones, cambios, formularios, abrirHitos, verSemana: hojaDetalle, momento: (lunes) => momentoGeneracion(lunes, ctx.datos.ajustes, ctx.datos.perfil?.zona) };
}
