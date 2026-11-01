// La revisión de cada minuto (Cron Trigger): avisa de los recordatorios que
// vencen, ejecuta las automatizaciones por horario, mira el correo nuevo y
// las citas que se acercan. Cada paso falla por separado: si Google no
// responde, los recordatorios llegan igual.
import { Nucleo } from './nucleo.js';
import { partesLocales, desdeLocal, horaLocal, fechaLegible, enSilencio, aMinutos } from './tiempo.js';
import { coincideCorreo, coincideCita, duracion } from '../../src/compartido/automatizaciones.js';
import { extraerEvento } from './ia.js';
import { tocaAlerta, alertaEmpleo, hayCola, prepararSiguiente } from './empleo.js';
import { aviso } from '../../src/compartido/notificaciones.js';

// Pestañas de Gmail de las que no se avisa si «solo lo principal» está activo.
const CATEGORIAS_SECUNDARIAS = /^CATEGORY_(PROMOTIONS|SOCIAL|FORUMS)$/;
const remitente = (m) => m.de?.nombre || m.de?.email || 'alguien';

export async function revisar(env, ahora = Date.now()) {
  const n = new Nucleo(env, ahora);
  const a = await n.ajustes();
  if (!a.dueno) return;
  const zona = await n.zona();
  const local = partesLocales(ahora, zona);
  const avisos = await n.avisos();
  const activas = (await n.automatizaciones()).filter((x) => x.activa);
  const conGoogle = Boolean(a.google && !a.google.caducado);

  // Alertas de empleo: el minuto que toca solo se hace esto (el resto, al siguiente).
  if (await tocaAlerta(n, local)) {
    try {
      await alertaEmpleo(n);
    } catch (error) {
      await fallo(n, error);
    }
    return;
  }
  const pasos = [() => recordatorios(n), () => horarios(n, activas, local, zona, conGoogle)];
  if (conGoogle) {
    if (!a.ultimoCorreo || ahora - a.ultimoCorreo >= avisos.correoCadaMin * 60_000 - 5_000) {
      pasos.push(() => correos(n, activas, local, avisos, zona));
    }
    pasos.push(() => citas(n, activas, avisos, zona));
  }
  for (const paso of pasos) {
    try {
      await paso();
    } catch (error) {
      await fallo(n, error);
    }
  }
  // Candidaturas en cola tras la alerta: una por minuto, después de lo demás
  // (así los recordatorios y el correo no esperan aunque haya diez en cola).
  if (await hayCola(n)) {
    try {
      await prepararSiguiente(n);
    } catch (error) {
      await fallo(n, error);
    }
  }
  // Limpieza una vez por hora.
  if (local.minutos % 60 === 0) {
    await n.db.batch([
      n.db.prepare('DELETE FROM avisados WHERE cuando < ?').bind(ahora - 14 * 86_400_000),
      n.db.prepare('DELETE FROM recordatorios WHERE avisado = 1 AND cuando < ?').bind(ahora - 2 * 86_400_000),
      n.db.prepare('DELETE FROM pendientes WHERE caduca < ?').bind(ahora),
      n.db.prepare('DELETE FROM registro WHERE id <= (SELECT id FROM registro ORDER BY id DESC LIMIT 1 OFFSET 200)'),
      n.db.prepare('DELETE FROM registro_ia WHERE cuando < ?').bind(ahora - 14 * 86_400_000),
      n.db.prepare('DELETE FROM registro_ia WHERE id <= (SELECT id FROM registro_ia ORDER BY id DESC LIMIT 1 OFFSET 500)'),
    ]);
  }
}

async function fallo(n, error) {
  if (error?.caducado) {
    // Una sola vez: avisar de que hay que volver a conectar Google.
    const clave = 'google-caducado';
    if (!(await n.avisados([clave])).has(clave)) {
      await n.marcar([clave]);
      await n.registrar('error', 'Google ha retirado el permiso: vuelve a conectar la cuenta en Kitsune.');
      await n.notificar({ ...aviso('vuelve a conectar Google', 'Ve a Ajustes para seguir recibiendo avisos de correo y agenda.'), url: './?ajustes', etiqueta: 'google' });
    }
    return;
  }
  await n.registrar('error', error?.message ?? String(error));
}

// ---------- Recordatorios ----------

async function recordatorios(n) {
  const { results } = await n.db.prepare('SELECT id, texto FROM recordatorios WHERE avisado = 0 AND cuando <= ? ORDER BY cuando LIMIT 20').bind(n.ahora).all();
  for (const r of results) {
    await n.notificar({ ...aviso(r.texto), url: './?recordatorios', etiqueta: `r-${r.id}` });
    await n.db.prepare('UPDATE recordatorios SET avisado = 1 WHERE id = ?').bind(r.id).run();
  }
}

// ---------- Por horario ----------

async function horarios(n, activas, local, zona, conGoogle) {
  for (const auto of activas.filter((x) => x.cuando.tipo === 'horario')) {
    const objetivo = aMinutos(auto.cuando.hora);
    // Margen por si el cron se salta algún minuto.
    if (!auto.cuando.dias.includes(local.dia) || local.minutos < objetivo || local.minutos - objetivo > 20) continue;
    const clave = `h:${auto.id}:${local.fecha}`;
    if ((await n.avisados([clave])).has(clave)) continue;
    await n.marcar([clave]);
    const h = auto.hacer;
    if (h.resumen) {
      const { titulo, cuerpo } = await resumenDelDia(n, local, zona, conGoogle);
      await n.notificar({ ...aviso(titulo, cuerpo), url: './', etiqueta: 'resumen' });
    }
    if (h.notificar || h.recordatorio) {
      await n.notificar({ ...aviso(h.texto || auto.nombre, h.texto ? auto.nombre : ''), url: './', etiqueta: `h-${auto.id}` });
    }
    await n.registrar('automatizacion', `${auto.nombre}: hecho a las ${auto.cuando.hora}.`);
  }
}

export async function resumenDelDia(n, local, zona, conGoogle) {
  const finDelDia = desdeLocal(local.fecha, '23:59', zona);
  const partes = [];
  if (conGoogle) {
    const { gmail, calendario } = await n.google();
    const eventos = (await calendario.eventos({ desde: n.ahora, hasta: finDelDia, maximo: 10 })).filter((e) => !e.todoElDia || e.fin > n.ahora);
    partes.push(
      eventos.length
        ? `${eventos.length === 1 ? '1 cita' : `${eventos.length} citas`}: ${eventos
            .slice(0, 3)
            .map((e) => (e.todoElDia ? e.titulo : `${horaLocal(e.inicio, zona)} ${e.titulo}`))
            .join(', ')}${eventos.length > 3 ? '…' : ''}`
        : 'Sin citas hoy',
    );
    const { mensajes } = await gmail.listar({ filtro: 'no-leidos', consulta: 'newer_than:2d', maximo: 20 });
    if (mensajes.length) partes.push(`${mensajes.length === 20 ? 'más de 20' : mensajes.length} ${mensajes.length === 1 ? 'correo sin leer' : 'correos sin leer'}`);
  }
  const { results } = await n.db.prepare('SELECT COUNT(*) AS total FROM recordatorios WHERE avisado = 0 AND cuando <= ?').bind(finDelDia).all();
  const pendientes = results[0]?.total ?? 0;
  if (pendientes) partes.push(`${pendientes} ${pendientes === 1 ? 'recordatorio' : 'recordatorios'}`);
  const saludo = local.minutos < 13 * 60 ? 'Buenos días' : local.minutos < 20 * 60 ? 'Buenas tardes' : 'Buenas noches';
  return { titulo: `${saludo}, este es tu día`, cuerpo: partes.join(' · ') || 'Nada pendiente hoy.' };
}

// ---------- Correo nuevo ----------

async function correos(n, activas, local, avisos, zona) {
  const { gmail } = await n.google();
  const { mensajes } = await gmail.listar({ filtro: 'no-leidos', consulta: 'newer_than:1d', maximo: 20 });
  await n.poner('ultimoCorreo', n.ahora);
  const claves = mensajes.map((m) => `m:${m.id}`);
  const vistos = await n.avisados(claves);
  // La primera vez solo se toma nota de lo que ya había: nada de avalanchas.
  if (!(await n.ajustes()).correoBase) {
    await n.marcar(claves);
    await n.poner('correoBase', true);
    return;
  }
  const nuevos = mensajes.filter((m) => !vistos.has(`m:${m.id}`)).sort((x, y) => x.fecha - y.fecha);
  if (!nuevos.length) return;
  await n.marcar(nuevos.map((m) => `m:${m.id}`));

  const reglas = activas.filter((x) => x.cuando.tipo === 'correo');
  const sinRegla = [];
  for (const m of nuevos) {
    const suyas = reglas.filter((r) => coincideCorreo(r, m));
    if (!suyas.length) sinRegla.push(m);
    for (const r of suyas) {
      try {
        await ejecutarEnCorreo(n, r, m, gmail, zona);
      } catch (error) {
        await n.registrar('error', `${r.nombre}: ${error.message}`);
      }
    }
  }

  // Aviso general de lo que no ha recogido ninguna automatización.
  if (!avisos.correo || enSilencio(local.minutos, avisos.silencio)) return;
  const avisar = sinRegla.filter((m) => !avisos.soloPrincipal || !(m.etiquetas ?? []).some((e) => CATEGORIAS_SECUNDARIAS.test(e)));
  if (avisar.length > 3) {
    const nombres = [...new Set(avisar.map(remitente))].slice(0, 4).join(', ');
    await n.notificar({ ...aviso(`${avisar.length} correos nuevos`, `De ${nombres}`), url: './?correo', etiqueta: 'correo' });
  } else {
    for (const m of avisar) await n.notificar({ ...aviso(m.asunto || '(sin asunto)', `De ${remitente(m)}`), url: './?correo', etiqueta: `m-${m.id}` });
  }
}

async function ejecutarEnCorreo(n, r, m, gmail, zona) {
  const h = r.hacer;
  const hecho = [];
  let evento = null;
  if (h.evento) {
    evento = await eventoDesdeCorreo(n, m, gmail, zona);
    hecho.push(evento ? `añadido «${evento.titulo}» a la agenda (${fechaLegible(evento.ms, zona)})` : 'sin evento con fecha que añadir');
  }
  if (h.recordatorio) {
    const id = `s${n.ahora.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
    const texto = `${h.texto || 'Revisar'}: ${m.asunto}`.slice(0, 200);
    await n.db.prepare('INSERT INTO recordatorios (id, texto, cuando, avisado, origen) VALUES (?, ?, ?, 0, ?)').bind(id, texto, n.ahora + h.recordatorio * 60_000, 'servidor').run();
    hecho.push(`recordatorio en ${duracion(h.recordatorio)}`);
  }
  if (h.leido || h.archivar) {
    await gmail.modificar(m.id, { ...(h.leido ? { leido: true } : {}), ...(h.archivar ? { archivar: true } : {}) });
    hecho.push([h.leido && 'marcado como leído', h.archivar && 'archivado'].filter(Boolean).join(' y '));
  }
  if (h.notificar) {
    await n.notificar({
      ...aviso(
        h.texto || m.asunto || '(sin asunto)',
        evento ? `${evento.titulo} · añadido a tu agenda para el ${fechaLegible(evento.ms, zona)}` : h.texto ? m.asunto : `De ${remitente(m)}`,
      ),
      url: evento ? './?agenda' : './?correo',
      etiqueta: `m-${m.id}`,
    });
    hecho.push('aviso enviado');
  }
  await n.registrar('automatizacion', `${r.nombre} · «${m.asunto}»: ${hecho.join(', ') || 'nada que hacer'}.`);
}

// Lee el correo entero, saca el evento con la IA y lo crea en el calendario.
async function eventoDesdeCorreo(n, m, gmail, zona) {
  // Sacar la cita de un correo es tarea de fondo: en Ahorro y Eficiente, con Groq.
  const ia = await n.iaServidor('fondo');
  if (!ia) throw new Error('Para crear eventos desde el correo, activa «Usar mi clave de Groq» o «de OpenAI» en el servidor (Ajustes → Avisos).');
  const completo = await gmail.leer(m.id);
  const usos = [];
  const extraido = await extraerEvento({ ...ia, correo: completo, zona, ahora: n.ahora, alUso: (m, u) => usos.push([m, u]) });
  await n.anotarConsumo(usos).catch(() => {});
  if (!extraido) return null;
  const { calendario } = await n.google();
  const todoElDia = extraido.inicio.length === 10;
  const siguienteDia = (fecha) => new Date(Date.parse(`${fecha}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const inicioMs = todoElDia ? desdeLocal(extraido.inicio, '00:00', zona) : desdeLocal(extraido.inicio.slice(0, 10), extraido.inicio.slice(11), zona);
  const finTexto = extraido.fin ?? (todoElDia ? extraido.inicio : null);
  const cuerpo = {
    summary: extraido.titulo,
    ...(extraido.lugar ? { location: extraido.lugar } : {}),
    description: `Añadido por Kitsune desde el correo «${m.asunto}» de ${remitente(m)}.`,
    start: todoElDia ? { date: extraido.inicio } : { dateTime: `${extraido.inicio}:00`, timeZone: zona },
    end: todoElDia
      ? { date: siguienteDia(finTexto) }
      : { dateTime: finTexto ? `${finTexto}:00` : new Date(inicioMs + 3_600_000).toISOString(), timeZone: zona },
  };
  await calendario.api('', { method: 'POST', body: JSON.stringify(cuerpo) });
  return { titulo: extraido.titulo, ms: inicioMs };
}

// ---------- Citas que se acercan ----------

async function citas(n, activas, avisos, zona) {
  const reglas = activas.filter((x) => x.cuando.tipo === 'cita');
  const margen = Math.max(avisos.citas || 0, ...reglas.map((r) => r.cuando.minutos));
  if (!margen) return;
  const { calendario } = await n.google();
  const eventos = (await calendario.eventos({ desde: n.ahora, hasta: n.ahora + (margen + 1) * 60_000, maximo: 20 })).filter((e) => !e.todoElDia);
  const candidatos = [];
  for (const e of eventos) {
    const faltan = e.inicio - n.ahora;
    const base = `e:${e.id}:${e.inicio}`;
    if (avisos.citas && faltan <= avisos.citas * 60_000) candidatos.push({ clave: `${base}:b`, e, faltan, texto: '' });
    for (const r of reglas) {
      if (coincideCita(r, e) && faltan <= r.cuando.minutos * 60_000) candidatos.push({ clave: `${base}:${r.id}`, e, faltan, texto: r.hacer.texto, regla: r });
    }
  }
  const vistos = await n.avisados(candidatos.map((c) => c.clave));
  const pendientes = candidatos.filter((c) => !vistos.has(c.clave));
  await n.marcar(pendientes.map((c) => c.clave));
  for (const c of pendientes) {
    const minutos = Math.max(1, Math.round(c.faltan / 60_000));
    await n.notificar({
      ...aviso(
        c.texto || c.e.titulo,
        [c.texto && c.e.titulo, `a las ${horaLocal(c.e.inicio, zona)} (en ${minutos} min)`, c.e.lugar].filter(Boolean).join(' · '),
      ),
      url: './?agenda',
      etiqueta: `e-${c.e.id}`,
    });
    if (c.regla) await n.registrar('automatizacion', `${c.regla.nombre}: aviso de «${c.e.titulo}».`);
  }
}
