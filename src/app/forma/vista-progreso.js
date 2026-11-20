// Progreso: peso con la media de 7 días, ritmo real frente al previsto, fecha
// estimada, resumen semanal, TDEE adaptativo, avisos, hitos, medidas y fotos.
import { serieMedia, pesoDeReferencia, ritmoReal, avisosProgreso, estadoHito, hitosSugeridos, resumenSemanal, tdeeAdaptativo, serieMedida, pesosPorDia, serieComposicion, pesoDelDia, pesajesPorFecha } from '../../compartido/forma/progreso.js';
import { apuntarPeso, apuntarMedida, anadirHito, borrarHito, verAviso, borrarPeso } from '../../compartido/forma/acciones.js';
import { calcularPlan, fechaEstimada, deKg, aKg, unidadPeso, deCm, aCm, unidadLongitud, KCAL_POR_KG_GRASA } from '../../compartido/forma/calculos.js';
import { objetivoDelDia, perfilActual } from '../../compartido/forma/diario.js';
import { ejercicio } from '../../compartido/forma/datos.js';
import { lunesDe, sumarDias, fechaLarga, fechaCorta, nombreDia, aDia } from '../../compartido/forma/fechas.js';
import { ic, escapar, num, signo, grafica, minigrafica, fotoReducida } from './ui.js';
import { nombreFuente } from '../../compartido/forma/salud.js';
import { listarFotos, guardarFoto, borrarFoto } from './fotos.js';

export function vistaProgreso(ctx) {
  let fotos = null; // se cargan al abrir
  const elegidas = new Set();
  const u = () => ctx.datos.perfil?.unidades ?? 'metrico';
  const P = (kg, d = 1) => num(deKg(kg, u()), d);

  function panelPeso() {
    const d = ctx.datos;
    const hoy = ctx.hoy();
    const serie = serieMedia(d);
    const ref = pesoDeReferencia(d, hoy);
    const inicio = pesosPorDia(d)[0];
    const ultimo = serie.at(-1);
    const ritmo = ritmoReal(d, hoy, 2);
    const plan = calcularPlan(perfilActual(d, hoy), { bloqueados: d.bloqueados, hoy });
    const previsto = plan.estimacion?.kgSemana != null ? -plan.estimacion.kgSemana : ((plan.kcalMedia - plan.mantenimiento) * 7) / KCAL_POR_KG_GRASA;
    // Fecha estimada con el ritmo real (si va en la buena dirección).
    const real = ritmo && ref ? fechaEstimada(d.perfil, (-ritmo * KCAL_POR_KG_GRASA) / 7, hoy, ref) : null;
    const ultimos = serie.filter((p) => p.fecha >= sumarDias(hoy, -60));
    return `<section class="f-panel f-visor">
      <div class="f-etiqueta"><span>Peso · media 7 días</span><button type="button" class="f-enlace" data-a="nuevo-peso">${ic('mas', 14)}</button></div>
      <div class="f-grande" style="margin-top:8px">
        <span class="f-grande__cifra">${ref ? P(ref) : '—'}</span><span class="f-grande__unidad">${unidadPeso(u())}</span>
        ${ref && inicio ? `<span class="f-delta" style="margin-left:auto;margin-bottom:6px">${signo(deKg(ref - inicio.kg, u()))} ${unidadPeso(u())} desde el ${escapar(fechaCorta(inicio.fecha))}</span>` : ''}
      </div>
      <form class="f-fila" data-form="peso" style="margin:14px 0 6px">
        <div class="f-con-unidad" data-unidad="${unidadPeso(u())}" style="flex:1"><input class="f-entrada" name="kg" type="text" inputmode="decimal" autocomplete="off" step="0.05" placeholder="${ultimo ? P(ultimo.kg) : 'Tu peso'}" aria-label="Peso de hoy" data-peso-hoy></div>
        <button type="submit" class="f-boton f-boton--azul">Apuntar hoy</button>
      </form>
      <p class="f-tenue" style="margin-bottom:12px">Mejor por la mañana, en ayunas y después del baño.${ultimo?.fecha === hoy ? ` Hoy: ${P(ultimo.kg, 2)} ${unidadPeso(u())}${textoOrigen(pesoDelDia(pesajesPorFecha(d).get(hoy)))}.` : ''}</p>
      ${grafica({
        series: [
          { puntos: ultimos.map((p) => ({ x: p.fecha, y: deKg(p.kg, u()) })), sinLinea: true, puntosVisibles: true },
          { puntos: ultimos.map((p) => ({ x: p.fecha, y: deKg(p.media, u()) })), area: true },
        ],
        objetivo: d.perfil.pesoObjetivo ? deKg(d.perfil.pesoObjetivo, u()) : null,
        vacio: 'Apunta tu peso unos días para ver la tendencia',
      })}
      <div class="f-leyenda"><span><i></i>Media de 7 días</span><span><i style="--c:var(--f-t2);height:4px;width:4px;border-radius:50%"></i>Cada pesada</span>${d.perfil.pesoObjetivo ? `<span><i style="--c:var(--f-hielo)"></i>Objetivo ${P(d.perfil.pesoObjetivo)}</span>` : ''}</div>
      <div class="f-kpis">
        <div class="f-kpi"><span>Ritmo real</span><b>${ritmo === null ? '—' : `${signo(deKg(ritmo, u()), 2)}`}</b><small class="f-tenue">${unidadPeso(u())}/sem</small></div>
        <div class="f-kpi"><span>Previsto</span><b>${signo(deKg(previsto, u()), 2)}</b><small class="f-tenue">${unidadPeso(u())}/sem</small></div>
        <div class="f-kpi"><span>Llegarías</span><b style="font-size:14px">${real ? escapar(fechaCorta(real.fecha)) : plan.estimacion ? escapar(fechaCorta(plan.estimacion.fecha)) : '—'}</b><small class="f-tenue">${real ? 'a tu ritmo real' : 'según el plan'}</small></div>
      </div>
    </section>`;
  }

  // «· Apple Salud 08:12» para los pesajes de la báscula.
  const textoOrigen = (p) => (p?.fuente ? ` · ${nombreFuente(p.fuente)}${p.hora ? ` ${p.hora}` : ''}` : '');

  // % de grasa y masa magra de la báscula (Apple Salud): la tendencia es lo que vale.
  function panelComposicion() {
    const d = ctx.datos;
    const serie = serieComposicion(d).filter((p) => p.fecha >= sumarDias(ctx.hoy(), -90));
    if (!serie.length) return '';
    const ultima = serie.at(-1);
    const primera = serie[0];
    const grasa = serie.filter((p) => Number.isFinite(p.grasa));
    const magra = serie.filter((p) => Number.isFinite(p.magra));
    const dif = (k) => (serie.length > 1 && Number.isFinite(primera[k]) && Number.isFinite(ultima[k]) ? ultima[k] - primera[k] : null);
    return `<section class="f-panel f-columna" data-panel="composicion">
      <div class="f-etiqueta"><span>Composición · báscula</span><b>${escapar(fechaCorta(ultima.fecha))}</b></div>
      <div class="f-kpis">
        <div class="f-kpi"><span>% de grasa</span><b>${Number.isFinite(ultima.grasa) ? `${num(ultima.grasa, 1)} %` : '—'}</b><small class="f-tenue">${dif('grasa') !== null ? `${signo(dif('grasa'), 1)} puntos` : 'sin tendencia aún'}</small></div>
        <div class="f-kpi"><span>Masa magra</span><b>${Number.isFinite(ultima.magra) ? `${P(ultima.magra)} ${unidadPeso(u())}` : '—'}</b><small class="f-tenue">${dif('magra') !== null ? `${signo(deKg(dif('magra'), u()), 1)} ${unidadPeso(u())}` : 'sin tendencia aún'}</small></div>
      </div>
      ${grasa.length > 1 ? `<span class="f-etiqueta" style="margin-top:6px">% de grasa</span>${grafica({ series: [{ puntos: grasa.map((p) => ({ x: p.fecha, y: p.grasa })), puntosVisibles: true }], alto: 120 })}` : ''}
      ${magra.length > 1 ? `<span class="f-etiqueta" style="margin-top:6px">Masa magra (${unidadPeso(u())})</span>${grafica({ series: [{ puntos: magra.map((p) => ({ x: p.fecha, y: deKg(p.magra, u()) })), puntosVisibles: true, clase: 'hielo' }], alto: 120 })}` : ''}
      ${grasa.length < 2 && magra.length < 2 ? '<p class="f-tenue">Con dos días de báscula verás aquí las gráficas de la tendencia.</p>' : ''}
      <p class="f-tenue">El % de grasa de una báscula de bioimpedancia es orientativo: cambia con el agua, la hora o si acabas de entrenar. Fíjate en la tendencia de semanas, no en el dato de un día.</p>
    </section>`;
  }

  function panelResumen() {
    const d = ctx.datos;
    const hoy = ctx.hoy();
    // El domingo por la noche, la semana en curso; si no, la última cerrada.
    const ahora = new Date();
    const esDomingoNoche = aDia(hoy).getDay() === 0 && ahora.getHours() >= 18;
    const lunes = esDomingoNoche ? lunesDe(hoy) : sumarDias(lunesDe(hoy), -7);
    const r = resumenSemanal(d, lunes, { objetivo: (f) => objetivoDelDia(d, f) });
    if (!r.diasRegistrados && !r.entrenos && r.cambio === null) return '';
    const nuevo = d.resumenVisto !== lunes;
    return `<section class="f-panel f-panel--azul">
      <div class="f-etiqueta"><span>${nuevo ? '● ' : ''}Resumen semanal</span><b>${escapar(fechaCorta(r.lunes))} – ${escapar(fechaCorta(r.domingo))}</b></div>
      <div class="f-informe">
        <div><span>Kcal en objetivo</span><b>${r.cumplimientoKcal ?? '—'}${r.cumplimientoKcal !== null ? ' %' : ''}</b><small class="f-tenue">${r.diasRegistrados} días apuntados</small></div>
        <div><span>Proteína cumplida</span><b>${r.cumplimientoProteina ?? '—'}${r.cumplimientoProteina !== null ? ' %' : ''}</b><small class="f-tenue">días con ≥ 90 %</small></div>
        <div><span>Media de peso</span><b>${r.cambio === null ? '—' : `${signo(deKg(r.cambio, u()), 2)}`}</b><small class="f-tenue">${unidadPeso(u())} en la semana</small></div>
        <div><span>Entrenos</span><b>${r.entrenos}</b><small class="f-tenue">${r.records.length ? `${r.records.length} récord${r.records.length > 1 ? 's' : ''}` : 'sin récords'}</small></div>
      </div>
      ${
        r.records.length
          ? `<div class="f-columna" style="margin-top:28px;gap:6px"><span class="f-etiqueta">${ic('trofeo', 13)} Récords</span>${[...r.records]
              .sort((a, b) => b.e1rm / (b.anterior || b.e1rm) - a.e1rm / (a.anterior || a.e1rm))
              .slice(0, 3)
              .map((x) => `<div class="f-fila f-entre" style="font-size:13px"><span>${escapar(ejercicio(d, x.ejercicioId).nombre)}</span><b>${num(x.kg, 2)} × ${x.reps}${x.anterior ? ` <span class="f-tenue">(+${num(x.e1rm - x.anterior, 1)} kg 1RM)</span>` : ''}</b></div>`)
              .join('')}${r.records.length > 3 ? `<span class="f-tenue">y ${r.records.length - 3} más</span>` : ''}</div>`
          : ''
      }
      ${nuevo ? `<button type="button" class="f-enlace" style="margin-top:12px" data-a="resumen-visto" data-lunes="${lunes}">Marcar como visto</button>` : ''}
    </section>`;
  }

  function panelAdaptativo() {
    const d = ctx.datos;
    const hoy = ctx.hoy();
    const t = tdeeAdaptativo(d, hoy);
    if (!t) return '';
    const plan = calcularPlan(perfilActual(d, hoy), { bloqueados: d.bloqueados, hoy });
    const dif = t.mantenimiento - plan.mantenimiento;
    const id = `tdee-${lunesDe(hoy)}`;
    if (Math.abs(dif) < 75 || d.avisosVistos.includes(id)) return '';
    return `<section class="f-panel f-panel--azul f-columna">
      <div class="f-fila">${ic('diana', 18)}<strong>Tu mantenimiento real</strong></div>
      <p class="f-explica">En ${t.dias} días has comido de media ${num(t.kcalMedia)} kcal y tu media de peso ha cambiado ${signo(deKg(t.kgSemana, u()), 2)} ${unidadPeso(u())}/semana. Eso apunta a un mantenimiento de <b style="color:var(--f-texto)">${num(t.mantenimiento)} kcal</b> (calculado: ${num(plan.mantenimiento)}). ¿Ajusto tu objetivo con este dato?</p>
      <div class="f-fila"><button type="button" class="f-boton f-boton--chico" data-a="ver-aviso" data-id="${id}">Ahora no</button><button type="button" class="f-boton f-boton--chico f-boton--azul" data-a="aceptar-tdee" data-valor="${t.mantenimiento}">Ajustar a ${num(t.mantenimiento)} kcal</button></div>
    </section>`;
  }

  function panelAvisos() {
    return avisosProgreso(ctx.datos, ctx.hoy())
      .filter((a) => !ctx.datos.avisosVistos.includes(a.id))
      .map((a) => `<section class="f-panel f-panel--aviso f-fila">${ic('info', 18)}<p class="f-explica" style="flex:1;color:var(--f-texto)">${escapar(a.texto)}</p><button type="button" class="f-icono-boton" style="border:0;background:none" data-a="ver-aviso" data-id="${a.id}" aria-label="Cerrar">${ic('cerrar', 15)}</button></section>`)
      .join('');
  }

  function textoHito(h) {
    const d = ctx.datos;
    const c = h.comparador === '>' ? 'más de' : 'menos de';
    if (h.tipo === 'peso') return `Peso ${c} ${P(h.valor)} ${unidadPeso(u())}`;
    if (h.tipo === 'medida') return `${h.medida} ${c} ${num(deCm(h.valor, u()), 1)} ${unidadLongitud(u())}`;
    return `${ejercicio(d, h.ejercicioId).nombre}: ${num(h.valor, 2)} kg`;
  }

  function panelHitos() {
    const d = ctx.datos;
    const hoy = ctx.hoy();
    const sug = hitosSugeridos(d).slice(0, 3);
    const inicial = pesosPorDia(d)[0]?.kg ?? d.perfil.peso;
    const ordenados = [...d.hitos].sort((a, b) => Boolean(a.cumplido) - Boolean(b.cumplido));
    return `<section class="f-panel f-panel--plano">
      <div class="f-etiqueta" style="padding:14px 14px 4px"><span>Hitos y recompensas</span><button type="button" class="f-enlace" data-a="hito-nuevo">${ic('mas', 14)}</button></div>
      ${
        ordenados.length
          ? ordenados
              .map((h) => {
                const e = estadoHito(d, h, hoy);
                let p = 0;
                if (h.cumplido) p = 100;
                else if (e.actual !== null) {
                  const desde = h.tipo === 'peso' ? inicial : h.tipo === 'fuerza' ? 0 : (serieMedida(d, h.medida)[0]?.cm ?? e.actual);
                  p = Math.max(0, Math.min(100, ((desde - e.actual) / (desde - h.valor || 1)) * 100));
                }
                return `<div class="f-hito ${h.cumplido ? 'cumplido' : ''}">
                  <span class="f-hito__icono">${ic(h.cumplido ? 'trofeo' : h.tipo === 'fuerza' ? 'entreno' : h.tipo === 'medida' ? 'regla' : 'diana', 17)}</span>
                  <div><strong>${escapar(textoHito(h))}</strong><small>${h.cumplido ? `Cumplido el ${escapar(fechaCorta(h.cumplido))}` : e.actual !== null ? `Ahora: ${h.tipo === 'peso' ? `${P(e.actual)} ${unidadPeso(u())} (media 7 días)` : h.tipo === 'medida' ? `${num(deCm(e.actual, u()), 1)} ${unidadLongitud(u())}` : `${num(e.actual, 2)} kg`}` : 'Sin datos todavía'}${h.recompensa ? ` · 🎁 ${escapar(h.recompensa)}` : ''}</small>
                  ${h.cumplido ? '' : `<div class="f-progreso"><i style="--p:${p}%"></i></div>`}</div>
                  <button type="button" class="f-icono-boton" style="border:0;background:none" data-a="hito-borrar" data-id="${h.id}" aria-label="Borrar hito">${ic('basura', 15)}</button>
                </div>`;
              })
              .join('')
          : '<p class="f-vacio">Ponte metas con premio: «menos de 80 kg → cena en el japonés».</p>'
      }
      ${sug.length ? `<div class="f-chips" style="padding:4px 14px 14px">${sug.map((s) => `<button type="button" class="f-chip" data-a="hito-sugerido" data-valor="${s.valor}" data-comparador="${s.comparador}">${ic('mas', 13)}${s.comparador === '<' ? '<' : '>'} ${P(s.valor)} ${unidadPeso(u())}</button>`).join('')}</div>` : ''}
    </section>`;
  }

  function panelMedidas() {
    const d = ctx.datos;
    return `<section class="f-columna">
      <div class="f-etiqueta"><span>Medidas</span><button type="button" class="f-enlace" data-a="medidas-nuevas">${ic('mas', 14)} Apuntar</button></div>
      <div class="f-medidas">${d.tiposMedida
        .map((t) => {
          const s = serieMedida(d, t);
          const ultima = s.at(-1);
          const dif = s.length > 1 ? ultima.cm - s[0].cm : null;
          return `<div class="f-medida"><span>${escapar(t)}</span><b>${ultima ? `${num(deCm(ultima.cm, u()), 1)}` : '—'} <small class="f-tenue">${unidadLongitud(u())}</small></b>
            <div class="f-fila f-entre"><small class="f-tenue">${dif !== null ? `${signo(deCm(dif, u()), 1)} desde ${escapar(fechaCorta(s[0].fecha))}` : ultima ? escapar(fechaCorta(ultima.fecha)) : 'Sin datos'}</small>${minigrafica(s.map((x) => x.cm))}</div></div>`;
        })
        .join('')}</div>
    </section>`;
  }

  function panelFotos() {
    const lista = fotos ?? [];
    return `<section class="f-columna">
      <div class="f-etiqueta"><span>Fotos de progreso · solo en este dispositivo</span>
        <label class="f-enlace" style="position:relative;cursor:pointer">${ic('camara', 15)}<input type="file" accept="image/*" data-cambio="foto-nueva" style="position:absolute;inset:0;opacity:0;width:100%"></label></div>
      ${
        lista.length
          ? `<div class="f-fotos">${lista
              .slice(0, 12)
              .map((f) => `<button type="button" class="f-foto" data-a="foto" data-id="${f.id}" aria-pressed="${elegidas.has(f.id)}"><img src="${f.url}" alt="Foto del ${escapar(fechaLarga(f.fecha))}" loading="lazy"><span>${escapar(fechaCorta(f.fecha))}</span></button>`)
              .join('')}</div>
             <p class="f-tenue">${elegidas.size === 2 ? '' : 'Toca dos fotos para compararlas lado a lado.'}</p>
             ${elegidas.size === 2 ? '<div class="f-fila"><button type="button" class="f-boton f-boton--azul" style="flex:1" data-a="fotos-comparar">Comparar</button><button type="button" class="f-boton" data-a="fotos-borrar">Borrar</button></div>' : elegidas.size === 1 ? '<button type="button" class="f-boton f-boton--peligro f-boton--chico" data-a="fotos-borrar">Borrar la foto elegida</button>' : ''}`
          : '<p class="f-tenue">Hazte una foto cada 2–4 semanas con la misma luz y la misma postura. Se quedan solo en este dispositivo, sin sincronizar.</p>'
      }
    </section>`;
  }

  function html() {
    return `<div class="f-vista">
      <h1 class="f-titulo">Progreso</h1>
      ${panelPeso()}
      ${panelComposicion()}
      ${panelAdaptativo()}
      ${panelAvisos()}
      ${panelResumen()}
      ${panelHitos()}
      ${panelMedidas()}
      ${panelFotos()}
      <button type="button" class="f-boton f-boton--fantasma" data-a="pesos-lista">${ic('diario', 16)}Ver y corregir pesos apuntados</button>
    </div>`;
  }

  async function despues() {
    if (fotos === null) {
      fotos = [];
      const lista = await listarFotos();
      fotos = lista.map((f) => ({ ...f, url: URL.createObjectURL(f.blob) }));
      if (fotos.length && ctx.estado.vista === 'progreso') ctx.repintar();
    }
  }

  function hojaHito() {
    const d = ctx.datos;
    ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Nuevo hito</h2></div>
       <form class="f-columna" data-form="hito">
         <label class="f-campo"><span>Tipo</span><select class="f-entrada" name="tipo" data-cambio="hito-tipo"><option value="peso">Peso (media de 7 días)</option><option value="medida">Medida</option><option value="fuerza">Fuerza</option></select></label>
         <label class="f-campo" data-solo="medida" hidden><span>Medida</span><select class="f-entrada" name="medida">${d.tiposMedida.map((t) => `<option>${escapar(t)}</option>`).join('')}</select></label>
         <label class="f-campo" data-solo="fuerza" hidden><span>Ejercicio</span><select class="f-entrada" name="ejercicioId">${d.ejercicios
           .filter((e) => e.principal)
           .concat(d.ejercicios.filter((e) => !e.principal))
           .map((e) => `<option value="${e.id}">${escapar(e.nombre)}</option>`)
           .join('')}</select></label>
         <div class="f-rejilla-2">
           <label class="f-campo"><span>Condición</span><select class="f-entrada" name="comparador"><option value="<">Menos de</option><option value=">">Más de</option></select></label>
           <label class="f-campo"><span>Valor</span><input class="f-entrada" name="valor" type="text" inputmode="decimal" autocomplete="off" step="any" required></label>
         </div>
         <label class="f-campo"><span>Recompensa (opcional)</span><input class="f-entrada" name="recompensa" placeholder="Zapatillas nuevas"></label>
         <button type="submit" class="f-boton f-boton--azul">Crear hito</button>
       </form>`,
      { titulo: 'Nuevo hito' },
    );
  }

  function hojaMedidas() {
    const d = ctx.datos;
    ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Medidas de hoy</h2></div>
       <form class="f-columna" data-form="medidas">
         <div class="f-rejilla-2">${d.tiposMedida.map((t) => `<label class="f-campo"><span>${escapar(t)}</span><div class="f-con-unidad" data-unidad="${unidadLongitud(u())}"><input class="f-entrada" name="${escapar(t)}" type="text" inputmode="decimal" autocomplete="off" step="0.1"></div></label>`).join('')}</div>
         <p class="f-tenue">Rellena solo las que hayas medido. Mide siempre en el mismo punto y a la misma hora.</p>
         <button type="submit" class="f-boton f-boton--azul">Guardar medidas</button>
       </form>`,
      { titulo: 'Medidas' },
    );
  }

  const acciones = {
    'nuevo-peso': () => {
      setTimeout(() => document.querySelector('[data-peso-hoy]')?.focus(), 60);
    },
    'resumen-visto': (el) => ctx.guardar({ ...ctx.datos, resumenVisto: el.dataset.lunes }),
    'aceptar-tdee': (el) => {
      const valor = Number(el.dataset.valor);
      ctx.guardar({ ...ctx.datos, perfil: { ...ctx.datos.perfil, mantenimientoReal: valor } });
      ctx.tostada(`Objetivo recalculado con un mantenimiento de ${num(valor)} kcal.`);
    },
    'ver-aviso': (el) => ctx.guardar(verAviso(ctx.datos, el.dataset.id)),
    'hito-nuevo': () => hojaHito(),
    'hito-sugerido': (el) => {
      const valor = Number(el.dataset.valor);
      ctx.guardar(anadirHito(ctx.datos, { tipo: 'peso', comparador: el.dataset.comparador, valor, automatico: true }));
      ctx.tostada(`Hito añadido: ${el.dataset.comparador === '<' ? 'menos de' : 'más de'} ${P(valor)} ${unidadPeso(u())}. Ponle premio editándolo.`);
    },
    'hito-borrar': (el) => {
      const antes = ctx.datos;
      ctx.guardar(borrarHito(ctx.datos, el.dataset.id));
      ctx.tostada('Hito borrado', { accion: () => ctx.guardar(antes) });
    },
    'medidas-nuevas': () => hojaMedidas(),
    foto: (el) => {
      const id = el.dataset.id;
      if (elegidas.has(id)) elegidas.delete(id);
      else {
        if (elegidas.size >= 2) elegidas.delete([...elegidas][0]);
        elegidas.add(id);
      }
      ctx.repintar();
    },
    'fotos-comparar': () => {
      const [a, b] = [...elegidas].map((id) => fotos.find((f) => f.id === id)).sort((x, y) => (x.fecha < y.fecha ? -1 : 1));
      ctx.hojas.abrir(
        `<div class="f-hoja__titulo"><h2>Antes y ahora</h2></div>
         <div class="f-comparar"><figure><img src="${a.url}" alt=""><figcaption>${escapar(fechaLarga(a.fecha))}</figcaption></figure><figure><img src="${b.url}" alt=""><figcaption>${escapar(fechaLarga(b.fecha))}</figcaption></figure></div>`,
        { clase: 'f-hoja--alta', titulo: 'Comparar fotos' },
      );
    },
    'fotos-borrar': async () => {
      for (const id of elegidas) {
        await borrarFoto(id);
        const f = fotos.find((x) => x.id === id);
        if (f) URL.revokeObjectURL(f.url);
      }
      fotos = fotos.filter((f) => !elegidas.has(f.id));
      elegidas.clear();
      ctx.repintar();
    },
    'pesos-lista': () => {
      // Por días; en cada día, primero el que cuenta y luego los secundarios.
      const porDia = [...pesajesPorFecha(ctx.datos)].sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 60);
      const fila = (p, principal) => {
        const extra = [Number.isFinite(p.grasa) ? `${num(p.grasa, 1)} % grasa` : '', Number.isFinite(p.magra) ? `${P(p.magra)} ${unidadPeso(u())} magra` : ''].filter(Boolean).join(' · ');
        return `<div class="f-item${principal ? '' : ' f-item--secundario'}">
          <span class="f-item__texto"><span class="f-item__nombre">${P(p.kg, 2)} ${unidadPeso(u())}${p.fuente ? `<span class="f-origen" title="Llegó de ${escapar(nombreFuente(p.fuente))}">${ic('salud', 11)}${escapar(nombreFuente(p.fuente))}</span>` : ''}</span>
          <span class="f-item__detalle">${principal ? escapar(nombreDia(p.fecha, ctx.hoy())) : 'Secundario'}${p.hora ? ` · ${p.hora}` : ''}${extra ? ` · ${extra}` : ''}</span></span>
          <button type="button" class="f-icono-boton" style="border:0;background:none" data-a="peso-borrar" data-id="${p.id}" aria-label="Borrar">${ic('basura', 15)}</button></div>`;
      };
      ctx.hojas.abrir(
        `<div class="f-hoja__titulo"><h2>Pesos apuntados</h2></div>
         <p class="f-tenue">Si un día hay varios pesajes de la báscula, cuenta el primero antes de las 12:00 (o el primero del día). El que apuntas a mano manda siempre.</p>
         <div class="f-lista">${porDia
           .map(([, lista]) => {
             const principal = pesoDelDia(lista);
             return [principal, ...lista.filter((p) => p !== principal).sort((a, b) => (a.momento ?? 0) - (b.momento ?? 0))].map((p) => fila(p, p === principal)).join('');
           })
           .join('')}</div>`,
        { clase: 'f-hoja--alta', titulo: 'Pesos' },
      );
    },
    'peso-borrar': (el) => {
      ctx.guardar(borrarPeso(ctx.datos, el.dataset.id), { pintar: false });
      el.closest('.f-item')?.remove();
      ctx.repintar();
    },
  };

  const cambios = {
    'hito-tipo': (el) => {
      for (const c of el.form.querySelectorAll('[data-solo]')) c.hidden = c.dataset.solo !== el.value;
      el.form.elements.comparador.value = el.value === 'fuerza' ? '>' : '<';
    },
    'foto-nueva': async (el) => {
      const archivo = el.files?.[0];
      el.value = '';
      if (!archivo) return;
      try {
        const r = await fotoReducida(archivo, 1280, 0.85);
        const blob = await (await fetch(r.url)).blob();
        const foto = { id: `f${Date.now().toString(36)}`, fecha: ctx.hoy(), creada: Date.now(), blob };
        await guardarFoto(foto);
        fotos = [{ ...foto, url: URL.createObjectURL(blob) }, ...(fotos ?? [])];
        ctx.repintar();
        ctx.tostada('Foto guardada en este dispositivo.');
      } catch (error) {
        ctx.tostada(`No he podido guardar la foto: ${error.message}`);
      }
    },
  };

  const formularios = {
    peso: (form) => {
      const v = Number(String(form.elements.kg.value).replace(',', '.'));
      if (!(v > 0)) return;
      const kg = aKg(v, u());
      if (kg < 25 || kg > 400) return ctx.tostada('Ese peso no parece correcto.');
      const antes = new Set(ctx.datos.hitos.filter((h) => h.cumplido).map((h) => h.id));
      const datos = apuntarPeso(ctx.datos, ctx.hoy(), kg);
      const nuevos = datos.hitos.filter((h) => h.cumplido && !antes.has(h.id));
      ctx.guardar(datos);
      ctx.tostada(nuevos.length ? `🏆 ¡Hito cumplido! ${nuevos.map((h) => h.recompensa).filter(Boolean).join(', ') || textoHito(nuevos[0])}` : `${num(v, 2)} ${unidadPeso(u())} apuntado`, { ms: 5000 });
    },
    hito: (form) => {
      const tipo = form.elements.tipo.value;
      const valorBruto = Number(String(form.elements.valor.value).replace(',', '.'));
      if (!(valorBruto > 0)) return;
      const valor = tipo === 'peso' ? aKg(valorBruto, u()) : tipo === 'medida' ? aCm(valorBruto, u()) : valorBruto;
      ctx.hojas.cerrar();
      ctx.guardar(
        anadirHito(ctx.datos, {
          tipo,
          valor: Math.round(valor * 10) / 10,
          comparador: form.elements.comparador.value,
          medida: tipo === 'medida' ? form.elements.medida.value : undefined,
          ejercicioId: tipo === 'fuerza' ? form.elements.ejercicioId.value : undefined,
          recompensa: form.elements.recompensa.value.trim(),
        }),
      );
    },
    medidas: (form) => {
      let datos = ctx.datos;
      let n = 0;
      for (const t of ctx.datos.tiposMedida) {
        const v = Number(String(form.elements[t]?.value ?? '').replace(',', '.'));
        if (v > 0) {
          datos = apuntarMedida(datos, ctx.hoy(), t, aCm(v, u()));
          n++;
        }
      }
      if (!n) return;
      ctx.hojas.cerrar();
      ctx.guardar(datos);
      ctx.tostada(`${n} ${n === 1 ? 'medida guardada' : 'medidas guardadas'}`);
    },
  };

  return { html, despues, acciones, cambios, formularios };
}
