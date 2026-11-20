// Perfil: tu plan explicado, editar los datos (con recálculo), fijar objetivos
// a mano, momentos del día, suplementos, medidas, gimnasio (barra, discos,
// descanso), IA, integraciones (Apple Salud), atajos del iPhone, exportar y borrar.
import { calcularPlan, deKg, unidadPeso, OBJETIVOS, TRABAJOS } from '../../compartido/forma/calculos.js';
import { perfilActual } from '../../compartido/forma/diario.js';
import { normalizarForma, id as nuevoId, ejercicio } from '../../compartido/forma/datos.js';
import { edadEn, fechaLarga } from '../../compartido/forma/fechas.js';
import { quitarAjuste } from '../../compartido/forma/semanas.js';
import { ic, escapar, num } from './ui.js';
import { listarFotos, borrarFoto } from './fotos.js';

const NOMBRES = { kcal: 'Kcal', proteina: 'Proteína', grasa: 'Grasa', hidratos: 'Hidratos', fibra: 'Fibra', agua: 'Agua' };
const UNIDAD = { kcal: 'kcal', proteina: 'g', grasa: 'g', hidratos: 'g', fibra: 'g', agua: 'ml' };

export function vistaPerfil(ctx) {
  function html() {
    const d = ctx.datos;
    const p = d.perfil;
    const hoy = ctx.hoy();
    const plan = calcularPlan(perfilActual(d, hoy), { bloqueados: d.bloqueados, hoy });
    const base = calcularPlan(perfilActual(d, hoy), { hoy });
    const obj = OBJETIVOS.find((o) => o.id === p.objetivo)?.nombre;
    return `<div class="f-vista">
      <h1 class="f-titulo">Perfil</h1>
      <section class="f-panel f-visor">
        <div class="f-etiqueta"><span>Tu plan</span><b>${escapar(obj)} · ${escapar(p.ritmo)}</b></div>
        <div class="f-resultado" style="margin-top:12px">
          <div><span>Basal</span><b>${num(plan.basal)}</b><small>kcal · ${escapar(plan.formula)}</small></div>
          <div><span>Mantenimiento</span><b>${num(plan.mantenimiento)}</b><small>${p.mantenimientoReal ? 'ajustado con tus datos' : 'kcal de media'}</small></div>
          ${plan.ciclo ? `<div><span>Entreno</span><b>${num(plan.entreno.kcal)}</b><small>kcal</small></div><div><span>Descanso</span><b>${num(plan.descanso.kcal)}</b><small>kcal</small></div>` : `<div class="ancho"><span>Objetivo diario</span><b>${num(plan.descanso.kcal)} kcal</b><small>P ${num(plan.descanso.proteina)} g · H ${num(plan.descanso.hidratos)} g · G ${num(plan.descanso.grasa)} g · fibra ${num(plan.descanso.fibra)} g</small></div>`}
        </div>
        ${plan.estimacion ? `<p class="f-tenue" style="margin-top:12px">Llegarías a ${num(deKg(p.pesoObjetivo, p.unidades), 1)} ${unidadPeso(p.unidades)} hacia el ${escapar(fechaLarga(plan.estimacion.fecha))}.</p>` : ''}
        ${plan.avisos.map((a) => `<p class="f-tenue" style="color:var(--f-aviso);margin-top:8px">${escapar(a)}</p>`).join('')}
        <div class="f-fila" style="margin-top:12px">
          <button type="button" class="f-boton f-boton--azul" style="flex:1" data-a="perfil-editar" data-paso="0">${ic('lapiz', 15)}Editar datos</button>
          <button type="button" class="f-boton" data-a="perfil-editar" data-paso="3">Ver el cálculo</button>
        </div>
      </section>

      <section class="f-panel f-panel--plano">
        <div class="f-etiqueta" style="padding:14px 14px 6px"><span>Objetivos a mano</span><b>${Object.keys(d.bloqueados).length ? `${Object.keys(d.bloqueados).length} fijados` : 'todo calculado'}</b></div>
        ${['kcal', 'proteina', 'grasa', 'hidratos', 'fibra', 'agua']
          .map((k) => {
            const fijo = Number.isFinite(d.bloqueados[k]);
            const valor = fijo ? d.bloqueados[k] : base.descanso[k];
            return `<div class="f-ajuste"><span class="f-ajuste__texto"><strong>${NOMBRES[k]}</strong><small>${fijo ? 'Fijado: no se recalcula' : 'Calculado'}</small></span>
              <div class="f-con-unidad" data-unidad="${UNIDAD[k]}" style="width:130px"><input class="f-entrada" type="number" inputmode="numeric" value="${Math.round(valor)}" data-cambio="bloquear" data-k="${k}" aria-label="${NOMBRES[k]}"></div>
              <button type="button" class="f-candado" data-a="desbloquear" data-k="${k}" aria-pressed="${fijo}" title="${fijo ? 'Quitar y volver al cálculo' : 'Calculado'}">${fijo ? '🔒' : 'auto'}</button></div>`;
          })
          .join('')}
        <div class="f-ajuste"><span class="f-ajuste__texto"><strong>Proteína por kg</strong><small>1,8–2,2 en déficit · 1,6–2 en mantenimiento o volumen</small></span>
          <div class="f-con-unidad" data-unidad="g/kg" style="width:130px"><input class="f-entrada" type="text" inputmode="decimal" autocomplete="off" step="0.1" value="${p.proteinaPorKg ?? 2}" data-cambio="perfil-num" data-k="proteinaPorKg"></div></div>
        <div class="f-ajuste"><span class="f-ajuste__texto"><strong>Grasa</strong><small>Porcentaje de las kcal (mínimo 0,7 g/kg)</small></span>
          <div class="f-con-unidad" data-unidad="%" style="width:130px"><input class="f-entrada" type="number" inputmode="numeric" value="${p.grasaPct ?? 25}" data-cambio="perfil-num" data-k="grasaPct"></div></div>
        <div class="f-ajuste"><span class="f-ajuste__texto"><strong>Calorías</strong><small>${p.modoKcal === 'ciclo' ? 'Más los días de entreno' : 'Las mismas todos los días'}</small></span>
          <div class="f-segmento" style="width:170px"><button type="button" data-a="modo-kcal" data-v="fijas" aria-pressed="${p.modoKcal !== 'ciclo'}">Fijas</button><button type="button" data-a="modo-kcal" data-v="ciclo" aria-pressed="${p.modoKcal === 'ciclo'}">Ciclo</button></div></div>
        ${p.ajusteKcal ? `<div class="f-ajuste" data-ajuste-kcal><span class="f-ajuste__texto"><strong>Ajuste por tu ritmo: ${p.ajusteKcal > 0 ? '+' : '−'}${num(Math.abs(p.ajusteKcal))} kcal/día</strong><small>${d.historialKcal.length ? `Último cambio el ${escapar(fechaLarga(d.historialKcal.at(-1).fecha))}, desde el resumen semanal` : 'Desde el resumen semanal'}</small></span><button type="button" class="f-boton f-boton--chico" data-a="quitar-ajuste">Quitar</button></div>` : ''}
        ${p.mantenimientoReal ? `<div class="f-ajuste"><span class="f-ajuste__texto"><strong>Mantenimiento ajustado</strong><small>${num(p.mantenimientoReal)} kcal, de tus datos reales</small></span><button type="button" class="f-boton f-boton--chico" data-a="quitar-real">Quitar</button></div>` : ''}
      </section>

      <section class="f-panel f-panel--plano">
        <div class="f-etiqueta" style="padding:14px 14px 6px"><span>Comidas del día</span><button type="button" class="f-enlace" data-a="momento-nuevo">${ic('mas', 14)}</button></div>
        ${d.momentos
          .map(
            (m, i) => `<div class="f-ajuste"><input class="f-entrada" style="flex:1" value="${escapar(m.nombre)}" data-cambio="momento" data-i="${i}" data-k="nombre" aria-label="Nombre"><input class="f-entrada" style="width:110px" type="time" value="${m.hora}" data-cambio="momento" data-i="${i}" data-k="hora" aria-label="Hora">
            <button type="button" class="f-icono-boton" data-a="momento-quitar" data-i="${i}" aria-label="Quitar" ${d.momentos.length <= 1 ? 'disabled' : ''}>${ic('cerrar', 14)}</button></div>`,
          )
          .join('')}
      </section>

      <section class="f-panel f-columna">
        <div class="f-etiqueta"><span>Suplementos</span></div>
        <div class="f-chips">${d.suplementos.map((s) => `<button type="button" class="f-chip" data-a="suplemento-quitar" data-id="${s.id}" aria-pressed="true">${escapar(s.nombre)} ${ic('cerrar', 12)}</button>`).join('')}</div>
        <form class="f-fila" data-form="suplemento"><input class="f-entrada" name="nombre" placeholder="Creatina 5 g, vitamina D…"><button type="submit" class="f-boton">Añadir</button></form>
        <div class="f-etiqueta" style="margin-top:6px"><span>Medidas que sigues</span></div>
        <div class="f-chips">${d.tiposMedida.map((t, i) => `<button type="button" class="f-chip" data-a="medida-quitar" data-i="${i}" aria-pressed="true">${escapar(t)} ${ic('cerrar', 12)}</button>`).join('')}</div>
        <form class="f-fila" data-form="tipo-medida"><input class="f-entrada" name="nombre" placeholder="Gemelo, cuello…"><button type="submit" class="f-boton">Añadir</button></form>
      </section>

      <section class="f-panel f-columna">
        <div class="f-etiqueta"><span>Gimnasio</span></div>
        <div class="f-rejilla-2">
          <label class="f-campo"><span>Barra</span><div class="f-con-unidad" data-unidad="kg"><input class="f-entrada" type="text" inputmode="decimal" autocomplete="off" step="0.5" value="${d.ajustes.barra}" data-cambio="ajuste" data-k="barra"></div></label>
          <label class="f-campo"><span>Descanso entre series</span><div class="f-con-unidad" data-unidad="s"><input class="f-entrada" type="number" inputmode="numeric" step="15" value="${d.ajustes.descanso}" data-cambio="ajuste" data-k="descanso"></div></label>
        </div>
        <span class="f-tenue">Discos que tienes (toca para quitar o poner)</span>
        <div class="f-chips">${[25, 20, 15, 10, 5, 2.5, 2, 1.25, 1, 0.5].map((x) => `<button type="button" class="f-chip" data-a="disco" data-kg="${x}" aria-pressed="${d.ajustes.discos.includes(x)}">${num(x, 2)} kg</button>`).join('')}</div>
        <span class="f-tenue">Ejercicios principales (asesor de descarga): ${escapar(
          d.ejercicios
            .filter((e) => e.principal)
            .map((e) => ejercicio(d, e.id).nombre)
            .join(', ') || 'ninguno',
        )}</span>
      </section>

      <section class="f-panel f-columna">
        <div class="f-etiqueta"><span>Avisos e IA</span></div>
        <div class="f-rejilla-2">
          <label class="f-campo"><span>Avisarme si voy bajo de proteína a las</span><input class="f-entrada" type="time" value="${d.ajustes.avisoProteina}" data-cambio="ajuste" data-k="avisoProteina"></label>
          <label class="f-campo"><span>Usos de la IA al día</span><input class="f-entrada" type="number" inputmode="numeric" value="${d.ajustes.limiteIA}" data-cambio="ajuste" data-k="limiteIA"></label>
        </div>
        <p class="f-tenue">Hoy llevas ${d.usosIA[ctx.hoy()] ?? 0} usos. La IA usa las claves de Kitsune (Ajustes → IA); las fotos necesitan la de OpenAI o la de Claude. Sin IA, todo lo demás funciona igual.</p>
      </section>

      <section class="f-panel f-columna" data-panel="ajustes-resumen">
        <div class="f-etiqueta"><span>Resumen semanal e hitos</span></div>
        <p class="f-explica">Cada semana (lunes a domingo) se guarda un resumen con tu peso, comidas, entrenos y el avance hacia tus hitos. Lo ves en Progreso → Semanas.</p>
        <div class="f-rejilla-2">
          <label class="f-campo"><span>Se genera el</span><select class="f-entrada" data-cambio="ajuste-resumen" data-k="resumenDia">${['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']
            .map((n, i) => `<option value="${i + 1}" ${d.ajustes.resumenDia === i + 1 ? 'selected' : ''}>${i + 1 === 7 ? 'domingo' : `${n} siguiente`}</option>`)
            .join('')}</select></label>
          <label class="f-campo"><span>A las</span><input class="f-entrada" type="time" value="${d.ajustes.resumenHora}" data-cambio="ajuste-resumen" data-k="resumenHora"></label>
        </div>
        <label class="f-check"><input type="checkbox" data-cambio="ajuste-resumen" data-k="resumenAviso" ${d.ajustes.resumenAviso ? 'checked' : ''}><span>Avisarme con una notificación (con el servidor de avisos conectado)</span></label>
        <label class="f-check"><input type="checkbox" data-cambio="ajuste-resumen" data-k="resumenIA" ${d.ajustes.resumenIA ? 'checked' : ''}><span>Que el texto lo escriba la IA (solo recibe las cifras de la semana, nunca tus comidas)</span></label>
        <span class="f-etiqueta">Días que entrenas</span>
        <div class="f-chips">${['L', 'M', 'X', 'J', 'V', 'S', 'D']
          .map((n, i) => `<button type="button" class="f-chip" data-a="perfil-dia-entreno" data-dia="${i + 1}" aria-pressed="${d.ajustes.diasEntrenoSemana.includes(i + 1)}" aria-label="${['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'][i]}">${n}</button>`)
          .join('')}</div>
        <p class="f-tenue">${d.ajustes.diasEntrenoSemana.length ? `${d.ajustes.diasEntrenoSemana.length} sesiones planificadas a la semana. Si cambias un entreno de día, cuenta igual.` : `Sin marcar: se planifican los ${p.diasEntreno ?? 0} días de tu perfil.`}</p>
        <button type="button" class="f-boton" data-a="sem-hitos">${ic('trofeo', 16)}Hitos y recompensas</button>
      </section>

      <section class="f-panel f-columna">
        <div class="f-etiqueta"><span>Mis alimentos</span><b>${d.alimentos.length}</b></div>
        <p class="f-explica">Todos los que has buscado, escaneado, creado o importado. Corrígelos, márcalos como favoritos o trae muchos de golpe desde el JSON que te prepare una IA.</p>
        <div class="f-rejilla-2">
          <button type="button" class="f-boton" data-a="mis-alimentos">${ic('plato', 16)}Ver y editar</button>
          <button type="button" class="f-boton" data-a="importar">${ic('importar', 16)}Importar JSON</button>
        </div>
      </section>

      ${ctx.panelIntegraciones?.() ?? ''}

      <section class="f-panel f-columna">
        <div class="f-etiqueta"><span>Atajos en el iPhone</span></div>
        <p class="f-explica">En la app <b style="color:var(--f-texto)">Atajos</b> → Nuevo atajo → «Abrir URL» con una de estas direcciones, y añádelo a la pantalla de inicio. En Android, mantén pulsado el icono de Kitsune.</p>
        ${[
          ['agua', 'Sumar 250 ml de agua'],
          ['escaner', 'Abrir el escáner'],
          ['anadir', 'Añadir comida'],
          ['peso', 'Apuntar peso'],
        ]
          .map(([a, t]) => `<button type="button" class="f-ajuste" style="border:1px solid var(--f-linea);border-radius:10px" data-a="copiar-atajo" data-url="${escapar(urlAtajo(a))}"><span class="f-ajuste__texto"><strong>${t}</strong><small>${escapar(urlAtajo(a))}</small></span>${ic('copiar', 16)}</button>`)
          .join('')}
      </section>

      <section class="f-panel f-columna">
        <div class="f-etiqueta"><span>Tus datos</span></div>
        <p class="f-tenue">Edad ${edadEn(p.nacimiento, hoy)} · ${escapar(TRABAJOS.find((t) => t.id === p.trabajo)?.nombre ?? '')} · zona ${escapar(p.zona)} · desde el ${escapar(fechaLarga(p.creado ?? hoy))}. ${d.registros.length} comidas, ${d.pesos.length} pesos y ${d.sesiones.length} entrenos, cifrados y sincronizados con tus dispositivos.</p>
        <p class="f-tenue">Los productos buscados o escaneados vienen de <a href="https://world.openfoodfacts.org" target="_blank" rel="noopener" style="color:var(--f-azul-2)">Open Food Facts</a>, una base de datos abierta (licencia ODbL).</p>
        <button type="button" class="f-boton" data-a="exportar">${ic('descargar', 16)}Exportar todo (CSV + JSON)</button>
        <button type="button" class="f-boton f-boton--peligro" data-a="borrar-todo">${ic('basura', 16)}Borrar todos los datos de Forma</button>
      </section>

      <button type="button" class="f-boton f-boton--ancho" data-a="salir">${ic('zorro', 16)}Volver a Kitsune</button>
    </div>`;
  }

  function urlAtajo(accion) {
    const base = `${location.origin}${location.pathname}`.replace(/index\.html$/, '');
    return `${base}?forma=${accion}`;
  }

  const csv = (filas) =>
    filas
      .map((f) =>
        f
          .map((v) => {
            const t = v === undefined || v === null ? '' : String(v);
            return /[",;\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
          })
          .join(';'),
      )
      .join('\n');

  async function exportar() {
    const d = ctx.datos;
    const { zipSync, strToU8 } = await import('fflate');
    const nombreEj = (eid) => ejercicio(d, eid).nombre;
    const archivos = {
      // Sin la llave privada del buzón de Apple Salud: no sale de tus dispositivos.
      'forma.json': strToU8(JSON.stringify({ ...d, activa: undefined, integracion: { ultima: d.integracion?.ultima } }, null, 2)),
      'comidas.csv': strToU8(csv([['fecha', 'momento', 'alimento', 'gramos', 'kcal', 'proteina', 'hidratos', 'grasa', 'fibra', 'estimado'], ...d.registros.map((r) => [r.fecha, r.momento, r.nombre, r.gramos, r.kcal, r.proteina, r.hidratos, r.grasa, r.fibra, r.estimado ? 'sí' : ''])])),
      'pesos.csv': strToU8(csv([['fecha', 'hora', 'kg', 'grasa_pct', 'masa_magra_kg', 'origen'], ...d.pesos.map((p) => [p.fecha, p.hora, p.kg, p.grasa, p.magra, p.fuente ?? 'manual'])])),
      'pasos.csv': strToU8(csv([['fecha', 'pasos', 'origen'], ...Object.entries(d.dias).filter(([, v]) => Number.isFinite(v.pasos)).sort(([a], [b]) => (a < b ? -1 : 1)).map(([f, v]) => [f, v.pasos, v.pasosFuente])])),
      'medidas.csv': strToU8(csv([['fecha', 'medida', 'cm'], ...d.medidas.map((m) => [m.fecha, m.tipo, m.cm])])),
      'entrenos.csv': strToU8(csv([['fecha', 'sesion', 'ejercicio', 'kg', 'reps', 'rir', 'calentamiento'], ...d.sesiones.flatMap((s) => s.series.map((x) => [s.fecha, s.nombre, nombreEj(x.ejercicioId), x.kg, x.reps, x.rir, x.calentamiento ? 'sí' : '']))])),
      'alimentos.csv': strToU8(csv([['nombre', 'marca', 'unidad', 'racion', 'kcal_100', 'proteina_100', 'hidratos_100', 'grasa_100', 'fibra_100', 'codigo', 'origen'], ...d.alimentos.map((a) => [a.nombre, a.marca, a.unidad, a.racion, a.por100.kcal, a.por100.proteina, a.por100.hidratos, a.por100.grasa, a.por100.fibra, a.codigo, a.origen])])),
    };
    const zip = zipSync(archivos, { level: 6 });
    const nombre = `forma-${ctx.hoy()}.zip`;
    const archivo = new File([zip], nombre, { type: 'application/zip' });
    if (navigator.canShare?.({ files: [archivo] }) && matchMedia('(pointer: coarse)').matches) {
      try {
        await navigator.share({ files: [archivo], title: 'Datos de Forma' });
        return;
      } catch (e) {
        if (e?.name === 'AbortError') return;
      }
    }
    const url = URL.createObjectURL(archivo);
    const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  const cambiarPerfil = (cambio) => ctx.guardar({ ...ctx.datos, perfil: { ...ctx.datos.perfil, ...cambio } }, { pintar: false });

  const acciones = {
    'perfil-editar': (el) => ctx.editarPerfil(Number(el.dataset.paso) || 0),
    desbloquear: (el) => {
      const b = { ...ctx.datos.bloqueados };
      if (!(el.dataset.k in b)) return ctx.tostada('Escribe un valor para fijarlo a mano.');
      delete b[el.dataset.k];
      ctx.guardar({ ...ctx.datos, bloqueados: b }, { pintar: false });
      ctx.repintar();
    },
    'modo-kcal': (el) => {
      cambiarPerfil({ modoKcal: el.dataset.v });
      ctx.repintar();
    },
    'quitar-ajuste': () => {
      const antes = ctx.datos;
      ctx.guardar(quitarAjuste(ctx.datos, ctx.hoy()), { pintar: false });
      ctx.repintar();
      ctx.tostada('Ajuste quitado: vuelves al objetivo calculado.', { accion: () => ctx.guardar(antes) });
    },
    'quitar-real': () => {
      const { mantenimientoReal: _m, ...resto } = ctx.datos.perfil;
      ctx.guardar({ ...ctx.datos, perfil: resto }, { pintar: false });
      ctx.repintar();
    },
    'momento-nuevo': () => {
      ctx.guardar({ ...ctx.datos, momentos: [...ctx.datos.momentos, { id: nuevoId('m'), nombre: 'Postentreno', hora: '20:00' }] }, { pintar: false });
      ctx.repintar();
    },
    'momento-quitar': (el) => {
      const momentos = ctx.datos.momentos.filter((_, i) => i !== Number(el.dataset.i));
      ctx.guardar({ ...ctx.datos, momentos }, { pintar: false });
      ctx.repintar();
    },
    'suplemento-quitar': (el) => {
      ctx.guardar({ ...ctx.datos, suplementos: ctx.datos.suplementos.filter((s) => s.id !== el.dataset.id) }, { pintar: false });
      ctx.repintar();
    },
    'medida-quitar': (el) => {
      ctx.guardar({ ...ctx.datos, tiposMedida: ctx.datos.tiposMedida.filter((_, i) => i !== Number(el.dataset.i)) }, { pintar: false });
      ctx.repintar();
    },
    disco: (el) => {
      const kg = Number(el.dataset.kg);
      const discos = ctx.datos.ajustes.discos.includes(kg) ? ctx.datos.ajustes.discos.filter((x) => x !== kg) : [...ctx.datos.ajustes.discos, kg].sort((a, b) => b - a);
      ctx.guardar({ ...ctx.datos, ajustes: { ...ctx.datos.ajustes, discos } }, { pintar: false });
      ctx.repintar();
    },
    'perfil-dia-entreno': (el) => {
      const dia = Number(el.dataset.dia);
      const dias = ctx.datos.ajustes.diasEntrenoSemana;
      const nuevos = dias.includes(dia) ? dias.filter((x) => x !== dia) : [...dias, dia].sort();
      ctx.guardar({ ...ctx.datos, ajustes: { ...ctx.datos.ajustes, diasEntrenoSemana: nuevos } }, { pintar: false });
      ctx.repintar();
    },
    'copiar-atajo': async (el) => {
      try {
        await navigator.clipboard.writeText(el.dataset.url);
        ctx.tostada('Dirección copiada. Pégala en «Abrir URL» en Atajos.');
      } catch {
        ctx.tostada(el.dataset.url, { ms: 8000 });
      }
    },
    exportar: () => exportar().catch((e) => ctx.tostada(`No se ha podido exportar: ${e.message}`)),
    'borrar-todo': () => {
      ctx.hojas.abrir(
        `<div class="f-hoja__titulo"><h2>¿Borrar todo Forma?</h2></div>
         <p class="f-explica">Se borran tu perfil, comidas, alimentos, pesos, medidas, hitos y entrenos de todos tus dispositivos sincronizados, y las fotos de este. Kitsune no se toca. Exporta antes si quieres conservarlos.</p>
         <div class="f-fila"><button type="button" class="f-boton" data-cerrar-hoja style="flex:1">Cancelar</button><button type="button" class="f-boton f-boton--peligro" style="flex:1" data-a="borrar-si">Borrar todo</button></div>`,
      );
    },
    'borrar-si': async () => {
      ctx.hojas.cerrarTodas();
      for (const f of await listarFotos()) await borrarFoto(f.id).catch(() => {});
      ctx.estado.local = {};
      ctx.estado.vista = 'diario';
      ctx.guardar(normalizarForma({}));
      ctx.tostada('Datos de Forma borrados.');
    },
  };

  const cambios = {
    bloquear: (el) => {
      const v = Number(el.value);
      const b = { ...ctx.datos.bloqueados };
      if (v > 0) b[el.dataset.k] = v;
      else delete b[el.dataset.k];
      ctx.guardar({ ...ctx.datos, bloqueados: b }, { pintar: false });
      ctx.repintar();
    },
    'perfil-num': (el) => {
      const v = Number(String(el.value).replace(',', '.'));
      if (!(v > 0)) return;
      cambiarPerfil({ [el.dataset.k]: v });
      ctx.repintar();
    },
    momento: (el) => {
      const momentos = ctx.datos.momentos.map((m, i) => (i === Number(el.dataset.i) ? { ...m, [el.dataset.k]: el.value || m[el.dataset.k] } : m));
      ctx.guardar({ ...ctx.datos, momentos }, { pintar: false });
    },
    'ajuste-resumen': (el) => {
      const k = el.dataset.k;
      const v = el.type === 'checkbox' ? el.checked : k === 'resumenDia' ? Number(el.value) : el.value;
      if (k === 'resumenHora' && !/^\d{2}:\d{2}$/.test(v)) return;
      ctx.guardar({ ...ctx.datos, ajustes: { ...ctx.datos.ajustes, [k]: v } }, { pintar: false });
      if (k !== 'resumenIA') ctx.sincronizarAvisoResumen?.();
    },
    ajuste: (el) => {
      const k = el.dataset.k;
      const v = k === 'avisoProteina' ? el.value : Number(el.value);
      if (k !== 'avisoProteina' && !(v >= 0)) return;
      ctx.guardar({ ...ctx.datos, ajustes: { ...ctx.datos.ajustes, [k]: v } }, { pintar: false });
    },
  };

  const formularios = {
    suplemento: (form) => {
      const nombre = form.elements.nombre.value.trim();
      if (!nombre) return;
      ctx.guardar({ ...ctx.datos, suplementos: [...ctx.datos.suplementos, { id: nuevoId('u'), nombre }] }, { pintar: false });
      ctx.repintar();
    },
    'tipo-medida': (form) => {
      const nombre = form.elements.nombre.value.trim();
      if (!nombre || ctx.datos.tiposMedida.includes(nombre)) return;
      ctx.guardar({ ...ctx.datos, tiposMedida: [...ctx.datos.tiposMedida, nombre] }, { pintar: false });
      ctx.repintar();
    },
  };

  return { html, acciones, cambios, formularios };
}
