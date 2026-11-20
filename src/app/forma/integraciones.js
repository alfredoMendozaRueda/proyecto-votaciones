// Perfil → Integraciones: Apple Salud por un Atajo del iPhone. Tokens personales
// (se ven una sola vez), última sincronización con lo que llegó, recoger ahora
// y la guía para montar el Atajo sin depender de nadie.
import { nombreFuente } from '../../compartido/forma/salud.js';
import { fechaCorta } from '../../compartido/forma/fechas.js';
import { horasYMinutos } from '../../compartido/forma/semanas.js';
import { ic, escapar, num } from './ui.js';

const EJEMPLO = {
  pasos_hoy: 4321,
  pasos_ayer: 11234,
  peso_kg: 77.55,
  grasa_pct: 22.9,
  masa_magra_kg: 59.8,
  fecha_peso: '2026-11-20T08:12:00+01:00',
  sueno_horas: 7.4,
};

export function haceCuanto(ms, ahora = Date.now()) {
  if (!Number.isFinite(ms)) return 'nunca';
  const min = Math.max(0, Math.round((ahora - ms) / 60_000));
  if (min < 1) return 'ahora mismo';
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? 'hace 1 día' : `hace ${d} días`;
}

export function crearIntegraciones(ctx) {
  const local = () => (ctx.estado.local.salud ??= { cargando: false, estado: null, error: null, revocar: null });

  async function cargar() {
    const s = local();
    if (s.cargando || !ctx.api.forma.salud) return;
    s.cargando = true;
    try {
      s.estado = await ctx.api.forma.salud.estado();
      s.error = null;
    } catch (e) {
      s.error = e.message;
    } finally {
      s.cargando = false;
      repintarPanel();
    }
  }

  function repintarPanel() {
    const viejo = document.querySelector('[data-panel="integraciones"]');
    if (viejo) viejo.outerHTML = panel({ cargar: false });
  }

  function textoUltima(u, usoServidor) {
    if (!u && !usoServidor) return '<p class="f-tenue">Aún no ha llegado nada. Cuando el Atajo mande datos, los verás aquí.</p>';
    const cuando = Math.max(u?.recibido ?? 0, usoServidor ?? 0);
    const partes = [];
    if (u?.dias?.length) {
      partes.push(
        u.dias
          .map((d) => [Number.isFinite(d.pasos) ? `${escapar(fechaCorta(d.fecha))}: <b>${num(d.pasos)}</b> pasos` : '', Number.isFinite(d.sueno) ? `sueño <b>${escapar(horasYMinutos(d.sueno))}</b>` : ''].filter(Boolean).join(', '))
          .join(' · '),
      );
    }
    if (u?.pesaje) {
      const p = u.pesaje;
      const extra = [Number.isFinite(p.grasa) ? `${num(p.grasa, 1)} % grasa` : '', Number.isFinite(p.magra) ? `${num(p.magra, 1)} kg magra` : ''].filter(Boolean).join(', ');
      partes.push(`pesaje <b>${num(p.kg, 2)} kg</b>${p.hora ? ` a las ${p.hora}` : ''}${extra ? ` (${extra})` : ''}${u.resultado === 'duplicado' ? ' · ya lo tenías' : ''}`);
    }
    const pendiente = usoServidor && (!u || usoServidor > u.recibido + 5_000);
    return `<p class="f-explica" data-ultima>Última sincronización: <b style="color:var(--f-texto)">${haceCuanto(cuando)}</b>${u ? ` · ${escapar(nombreFuente(u.fuente))}` : ''}.</p>
      ${partes.length ? `<p class="f-tenue">Recibido: ${partes.join(' · ')}.</p>` : ''}
      ${pendiente ? '<p class="f-tenue">Hay datos nuevos en el servidor: se recogen solos al abrir Forma.</p>' : ''}`;
  }

  function filaToken(t) {
    const confirmar = local().revocar === t.id;
    return `<div class="f-item${t.revocado ? ' f-item--secundario' : ''}">
      <span class="f-item__texto"><span class="f-item__nombre">${ic('llave', 13)} ${escapar(t.nombre)}${t.revocado ? '<span class="f-marca-estimado">revocado</span>' : ''}</span>
      <span class="f-item__detalle">Creado el ${escapar(fechaCorta(new Date(t.creado_en).toISOString().slice(0, 10)))} · último uso: ${t.ultimo_uso_en ? haceCuanto(t.ultimo_uso_en) : 'nunca'}</span></span>
      ${t.revocado ? '' : `<button type="button" class="f-boton f-boton--chico${confirmar ? ' f-boton--peligro' : ''}" data-a="int-revocar" data-id="${escapar(t.id)}">${confirmar ? '¿Revocar?' : 'Revocar'}</button>`}
    </div>`;
  }

  // Forma → Apple Salud: interruptor (apagado por defecto) con su aviso de privacidad.
  function bloqueExportar() {
    const int = ctx.datos.integracion ?? {};
    const on = Boolean(int.exportar);
    const subidos = int.subidos ?? [];
    const dias = subidos.filter((x) => x.startsWith('comida:')).length;
    const entrenos = subidos.filter((x) => x.startsWith('entreno:')).length;
    return `<div class="f-int-exportar" data-exportar>
      <label class="f-check"><input type="checkbox" data-cambio="int-exportar" ${on ? 'checked' : ''}><span><b style="color:var(--f-texto)">Escribir en Apple Salud</b> mis comidas (kcal y macros de cada día ya cerrado) y mis entrenos terminados.</span></label>
      <p class="f-tenue">${ic('info', 12)} Para que el Atajo pueda leerlos, esos totales viajan <b>sin cifrar</b> a tu servidor y se borran en cuanto los recoge (o a los 30 días). El resto de Forma sigue cifrado.</p>
      ${on ? `<p class="f-tenue">Enviados hasta ahora: ${dias} día${dias === 1 ? '' : 's'} de comida y ${entrenos} entreno${entrenos === 1 ? '' : 's'}.</p><button type="button" class="f-boton f-boton--fantasma" data-a="int-guia-salida">${ic('info', 16)}Cómo configurar el Atajo «Forma → Salud»</button>` : ''}
    </div>`;
  }

  function hojaGuiaSalida() {
    const base = (local().estado?.url ?? 'https://<tu-servidor>.workers.dev/integraciones/salud').replace(/\/salud$/, '/salud/salida');
    const ejemplo = JSON.stringify(
      {
        comidas: [{ fecha: '2026-11-19', fecha_hora: '2026-11-19T20:00:00.000Z', kcal: 2150, proteina_g: 162, hidratos_g: 210, grasa_g: 68, fibra_g: 31 }],
        entrenos: [{ nombre: 'Pecho y tríceps', tipo: 'fuerza', inicio: '2026-11-19T17:05:00.000Z', fin: '2026-11-19T18:10:00.000Z', minutos: 65, kcal: 310 }],
        total: 2,
      },
      null,
      2,
    );
    const paso = (n, html) => `<li class="f-guia__paso"><span class="f-guia__n">${n}</span><div>${html}</div></li>`;
    ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Atajo «Forma → Salud»</h2></div>
       <p class="f-explica">Lee lo que Forma ha dejado listo y lo escribe en Salud. Cada día y cada entreno se entrega <b style="color:var(--f-texto)">una sola vez</b>: aunque lo ejecutes muchas veces, no se duplica nada.</p>
       <span class="f-etiqueta">Dirección (GET)</span>
       <code class="f-codigo">${escapar(base)}</code>
       <button type="button" class="f-boton" data-a="int-copiar" data-texto="${escapar(base)}" data-que="Dirección copiada">${ic('copiar', 16)}Copiar dirección</button>
       <span class="f-etiqueta">Respuesta</span>
       <pre class="f-codigo">${escapar(ejemplo)}</pre>
       <span class="f-etiqueta">Pasos en Atajos</span>
       <ol class="f-guia">
         ${paso(1, `<b>Obtener contenido de URL</b>: la dirección de arriba, método <i>GET</i>, cabecera <code>Authorization</code> = <code>Bearer forma_…</code> (el mismo token).`)}
         ${paso(2, '<b>Obtener valor del diccionario</b> <code>comidas</code> → <b>Repetir con cada elemento</b>:')}
         ${paso('2a', '<b>Registrar muestra de salud</b>: <i>Energía alimentaria</i> = <code>kcal</code> (kcal), fecha = <code>fecha_hora</code>.')}
         ${paso('2b', 'Igual con <i>Proteína</i> = <code>proteina_g</code>, <i>Hidratos de carbono</i> = <code>hidratos_g</code>, <i>Grasa total</i> = <code>grasa_g</code> y <i>Fibra</i> = <code>fibra_g</code> (en gramos).')}
         ${paso(3, '<b>Obtener valor del diccionario</b> <code>entrenos</code> → <b>Repetir con cada elemento</b>: <b>Registrar entrenamiento</b> si tu iPhone tiene esa acción (tipo «Entrenamiento de fuerza» o «Cardio», inicio = <code>inicio</code>, fin = <code>fin</code>, energía = <code>kcal</code>). Si no la tiene, <b>Registrar muestra de salud</b> → <i>Energía activa</i> = <code>kcal</code> con fecha = <code>inicio</code>.')}
         ${paso(4, 'Ponlo al final de «Sincronizar Forma» o como atajo aparte con su automatización a las 22:30.')}
       </ol>
       <p class="f-tenue">Lo de cada día se manda cuando el día ya ha terminado (al abrir Forma al día siguiente); lo que corrijas después de enviarlo ya no se actualiza en Salud.</p>`,
      { clase: 'f-hoja--alta', titulo: 'Forma → Salud' },
    );
  }

  function panel({ cargar: debeCargar = true } = {}) {
    const s = local();
    if (debeCargar && !s.estado && !s.cargando && !s.error) setTimeout(cargar, 0);
    const u = ctx.datos.integracion?.ultima ?? null;
    const e = s.estado;
    const uso = e?.tokens?.reduce((m, t) => Math.max(m, t.ultimo_uso_en ?? 0), 0) || null;
    let cuerpo;
    if (!ctx.api.forma.salud) cuerpo = '<p class="f-tenue">Disponible en la app del iPhone y en la de Windows.</p>';
    else if (s.error) cuerpo = `<p class="f-tenue">No he podido hablar con el servidor: ${escapar(s.error)}</p><button type="button" class="f-boton" data-a="int-recargar">Reintentar</button>`;
    else if (!e) cuerpo = '<p class="f-tenue">Cargando…</p>';
    else if (!e.vinculado) {
      cuerpo = `${textoUltima(u, null)}<p class="f-explica">Para recibir datos del iPhone hace falta el servidor de avisos de Kitsune: conéctalo en <b style="color:var(--f-texto)">Kitsune → Ajustes → Avisos</b> y vuelve aquí.</p>`;
    } else {
      const activos = e.tokens.filter((t) => !t.revocado);
      cuerpo = `${textoUltima(u, uso)}
        ${e.llaveDistinta ? '<p class="f-tenue">Ojo: el último token se generó en otro dispositivo con otra llave. Si no te llegan datos, genera un token nuevo aquí.</p>' : ''}
        <div class="f-lista" style="margin:0 -16px">${e.tokens.length ? e.tokens.map(filaToken).join('') : '<p class="f-tenue" style="padding:0 16px">Todavía no tienes ningún token.</p>'}</div>
        ${bloqueExportar()}
        <div class="f-rejilla-2">
          <button type="button" class="f-boton f-boton--azul" data-a="int-generar">${ic('llave', 16)}Generar token</button>
          <button type="button" class="f-boton" data-a="int-recoger" ${activos.length ? '' : 'disabled'}>${ic('descargar', 16)}Recoger ahora</button>
        </div>`;
    }
    return `<section class="f-panel f-columna" data-panel="integraciones">
      <div class="f-etiqueta"><span>Integraciones</span><b>${ic('salud', 12)} Apple Salud</b></div>
      <p class="f-explica">Tus <b style="color:var(--f-texto)">pasos</b> y los <b style="color:var(--f-texto)">pesajes de la báscula</b> (peso, % de grasa y masa magra) llegan solos con un Atajo del iPhone. Viajan cifrados: el servidor los guarda sin poder leerlos hasta que Forma los recoge.</p>
      ${cuerpo}
      <button type="button" class="f-boton f-boton--fantasma" data-a="int-guia">${ic('info', 16)}Cómo configurar el Atajo</button>
    </section>`;
  }

  function hojaGenerar() {
    ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Nuevo token</h2></div>
       <p class="f-explica">El Atajo lo manda en cada envío. Solo sirve para entregar datos de salud: no da acceso a nada más. Lo verás <b style="color:var(--f-texto)">una sola vez</b>.</p>
       <form class="f-columna" data-form="int-generar">
         <label class="f-campo"><span>Nombre</span><input class="f-entrada" name="nombre" maxlength="40" value="Atajo iPhone" autocomplete="off"></label>
         <button type="submit" class="f-boton f-boton--azul">Generar</button>
       </form>`,
      { titulo: 'Nuevo token' },
    );
  }

  function hojaToken(t, url) {
    ctx.hojas.cerrarTodas();
    ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Tu token</h2></div>
       <p class="f-explica"><b style="color:var(--f-texto)">Cópialo ahora:</b> no se puede volver a ver. Si lo pierdes, revócalo y genera otro.</p>
       <code class="f-codigo" data-token>${escapar(t.token)}</code>
       <button type="button" class="f-boton f-boton--azul" data-a="int-copiar" data-texto="${escapar(t.token)}" data-que="Token copiado">${ic('copiar', 16)}Copiar token</button>
       <span class="f-etiqueta">Dirección del Atajo</span>
       <code class="f-codigo">${escapar(url)}</code>
       <button type="button" class="f-boton" data-a="int-copiar" data-texto="${escapar(url)}" data-que="Dirección copiada">${ic('copiar', 16)}Copiar dirección</button>
       <button type="button" class="f-boton f-boton--fantasma" data-a="int-guia">${ic('info', 16)}Cómo configurar el Atajo</button>`,
      { titulo: 'Tu token', alCerrar: () => repintarPanel() },
    );
  }

  function hojaGuia() {
    const url = local().estado?.url ?? 'https://<tu-servidor>.workers.dev/integraciones/salud';
    const json = JSON.stringify(EJEMPLO, null, 2);
    const paso = (n, html) => `<li class="f-guia__paso"><span class="f-guia__n">${n}</span><div>${html}</div></li>`;
    ctx.hojas.abrir(
      `<div class="f-hoja__titulo"><h2>Cómo configurar el Atajo</h2></div>
       <p class="f-explica">Un Atajo de la app <b style="color:var(--f-texto)">Atajos</b> lee tus pasos y tu último pesaje de Salud y se los manda a tu servidor de Kitsune. Necesitas un token (Perfil → Integraciones → Generar token).</p>

       <span class="f-etiqueta">Dirección (POST)</span>
       <code class="f-codigo">${escapar(url)}</code>
       <button type="button" class="f-boton" data-a="int-copiar" data-texto="${escapar(url)}" data-que="Dirección copiada">${ic('copiar', 16)}Copiar dirección</button>

       <span class="f-etiqueta">Cabeceras</span>
       <code class="f-codigo">Authorization: Bearer forma_…tu token…
Content-Type: application/json</code>
       <p class="f-tenue">Con el cuerpo en JSON, Atajos pone el Content-Type solo.</p>

       <span class="f-etiqueta">Cuerpo JSON (sencillo)</span>
       <pre class="f-codigo">${escapar(json)}</pre>
       <button type="button" class="f-boton" data-a="int-copiar" data-texto="${escapar(json)}" data-que="Ejemplo copiado">${ic('copiar', 16)}Copiar ejemplo</button>
       <ul class="f-tenue f-guia__notas">
         <li><b>pasos_hoy</b> y <b>pasos_ayer</b>: el TOTAL de cada día; el servidor pone las fechas. Mandar lo mismo dos veces no duplica nada: se reemplaza.</li>
         <li><b>peso_kg</b> (30 a 300), <b>grasa_pct</b> (3 a 60; si llega como fracción, 0,229, se pasa a 22,9 %), <b>masa_magra_kg</b> y <b>fecha_peso</b>. Si un día no te pesas y van vacíos, se guardan los pasos igual.</li>
         <li><b>sueno_horas</b>: lo que dormiste la última noche (cuenta para hoy). Vale en horas («7,4»), en minutos («444») o como «7 h 24 min».</li>
         <li>Los números pueden ir como número o como texto, con coma decimal («77,55» o «77,55 kg»).</li>
         <li><b>fecha_peso</b> vale tal cual la escribe el iPhone («20 nov 2026, 8:12») o en ISO 8601; sin zona, se entiende en la de tu perfil (${escapar(ctx.datos.perfil?.zona ?? 'Europe/Madrid')}).</li>
         <li>Respuesta: <code>{"pasos_guardados": 2, "pesaje": "guardado"}</code> (o <code>"duplicado"</code>, <code>"no_enviado"</code>). Si algo no vale, 400 con el campo y el motivo, y no se guarda nada.</li>
         <li>Como mucho 60 envíos por hora y token. También vale el formato completo con <code>dias</code> (lista de fecha y pasos) y <code>pesaje</code>.</li>
       </ul>

       <span class="f-etiqueta">Crear el Atajo en el iPhone (a mano)</span>
       <ol class="f-guia">
         ${paso(1, '<b>Fecha</b> (fecha actual) → <b>Ajustar fecha</b>: <i>Obtener inicio del día</i>. Guárdalo con <b>Establecer variable</b> como <code>inicio_hoy</code>. Otra <b>Ajustar fecha</b>: <i>restar 1 día</i> a <code>inicio_hoy</code> → <code>inicio_ayer</code>.')}
         ${paso(2, '<b>Buscar muestras de salud</b>: tipo <i>Pasos</i>, filtro <i>Fecha de inicio es posterior a</i> <code>inicio_hoy</code>. Después <b>Calcular estadísticas</b> → <i>Suma</i> → variable <code>pasos_hoy</code>.')}
         ${paso(3, 'Igual con dos filtros: <i>Fecha de inicio es posterior a</i> <code>inicio_ayer</code> y <i>es anterior a</i> <code>inicio_hoy</code> → <i>Suma</i> → <code>pasos_ayer</code>.')}
         ${paso(4, '<b>Buscar muestras de salud</b>: tipo <i>Peso</i>, <i>Fecha de inicio está en los últimos 1 días</i>, ordenar por <i>Fecha de inicio</i>, <i>más reciente primero</i>, límite <i>1</i> → variable <code>peso</code>.')}
         ${paso(5, 'Igual con <i>Porcentaje de grasa corporal</i> → <code>grasa</code> y con <i>Masa corporal magra</i> → <code>magra</code>.')}
         ${paso('5b', '<b>Sueño</b> (opcional): <b>Buscar muestras de salud</b> de tipo <i>Análisis del sueño</i>, <i>Fecha de inicio está en las últimas 18 horas</i> y valor <i>Dormido</i> (o los tipos de sueño: núcleo, profundo y REM). Saca su <i>Duración</i> con <b>Obtener detalles</b>, súmala con <b>Calcular estadísticas</b> → <i>Suma</i> y mándala como <code>sueno_horas</code> (o <code>sueno</code> en minutos).')}
         ${paso(6, `<b>Obtener contenido de URL</b>: <code>${escapar(url)}</code>, método <i>POST</i>, cabecera <code>Authorization</code> = <code>Bearer forma_…</code>. Cuerpo <i>JSON</i> con <code>pasos_hoy</code>, <code>pasos_ayer</code>, <code>peso_kg</code> (variable <code>peso</code> → toca y elige <i>Valor</i>), <code>grasa_pct</code> (<code>grasa</code> → <i>Valor</i>), <code>masa_magra_kg</code> (<code>magra</code> → <i>Valor</i>) y <code>fecha_peso</code> (<code>peso</code> → <i>Fecha de inicio</i>) y, si quieres, <code>sueno_horas</code>.`)}
         ${paso(7, '<b>Mostrar notificación</b> con el <i>Contenido de la URL</i>, para ver la respuesta.')}
         ${paso(8, '<b>Automatizaciones</b> (pestaña Automatización): <i>App → Renpho Health → Se cierra</i> (sincroniza el peso justo después de pesarte) y <i>Hora del día → 22:30 → Diariamente</i>. En las dos, <i>Ejecutar inmediatamente</i>.')}
       </ol>
       <p class="f-tenue">iOS no deja leer Salud con el iPhone bloqueado: por eso el Atajo manda también los pasos de ayer. Forma recoge lo que llega cada vez que la abres.</p>`,
      { clase: 'f-hoja--alta', titulo: 'Atajo de Apple Salud' },
    );
  }

  const acciones = {
    'int-recargar': () => {
      local().error = null;
      local().estado = null;
      repintarPanel();
      cargar();
    },
    'int-generar': () => hojaGenerar(),
    'int-guia': () => hojaGuia(),
    'int-guia-salida': () => hojaGuiaSalida(),
    'int-recoger': async (el) => {
      el.disabled = true;
      const r = await ctx.recogerSalud({ avisar: true, siempre: true });
      if (r && !r.recogidas) ctx.tostada('No hay nada nuevo de Apple Salud.');
      local().estado = null;
      cargar();
    },
    'int-revocar': async (el) => {
      const s = local();
      if (s.revocar !== el.dataset.id) {
        s.revocar = el.dataset.id;
        repintarPanel();
        setTimeout(() => {
          if (s.revocar === el.dataset.id) {
            s.revocar = null;
            repintarPanel();
          }
        }, 4000);
        return;
      }
      s.revocar = null;
      try {
        await ctx.api.forma.salud.revocar(el.dataset.id);
        ctx.tostada('Token revocado: el Atajo que lo use dejará de funcionar.');
      } catch (e) {
        ctx.tostada(`No se ha podido revocar: ${e.message}`);
      }
      s.estado = null;
      cargar();
    },
    'int-copiar': async (el) => {
      try {
        await navigator.clipboard.writeText(el.dataset.texto);
        ctx.tostada(el.dataset.que || 'Copiado');
      } catch {
        ctx.tostada('No he podido copiar: mantén pulsado el texto para copiarlo.');
      }
    },
  };

  const cambios = {
    'int-exportar': async (el) => {
      const exportar = el.checked;
      const integracion = { ...ctx.datos.integracion };
      if (exportar) integracion.exportar = true;
      else delete integracion.exportar;
      await ctx.guardar({ ...ctx.datos, integracion }, { pintar: false });
      if (exportar) {
        const r = await ctx.exportarSalud({ siempre: true });
        ctx.tostada(r?.enviados ? `Listo: ${r.enviados} cosas esperan al Atajo «Forma → Salud».` : 'Activado: lo nuevo irá saliendo hacia Apple Salud.');
      } else {
        await ctx.api.forma.salud?.vaciarSalida?.().catch(() => {});
        ctx.tostada('Desactivado: lo que no había recogido el Atajo se ha borrado del servidor.');
      }
      repintarPanel();
    },
  };

  const formularios = {
    'int-generar': async (form) => {
      const boton = form.querySelector('[type="submit"]');
      boton.disabled = true;
      try {
        const t = await ctx.api.forma.salud.crearToken(form.elements.nombre.value.trim() || 'Atajo iPhone');
        // La llave del buzón se acaba de guardar: se recargan los datos.
        await ctx.recargar();
        local().estado = null;
        cargar();
        hojaToken(t, local().estado?.url ?? (await ctx.api.forma.salud.estado().then((e) => e.url).catch(() => '')));
      } catch (e) {
        boton.disabled = false;
        ctx.tostada(`No se ha podido generar: ${e.message}`);
      }
    },
  };

  return { panel, acciones, cambios, formularios };
}
