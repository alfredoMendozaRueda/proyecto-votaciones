// Sincronización entre dispositivos (iPhone y Windows). El servidor solo
// guarda y reparte datos cifrados: la llave la tienen los dispositivos, y un
// dispositivo nuevo la recibe de otro ya unido (sobre cifrado con ECDH) cuando
// lo apruebas allí comparando el mismo código en las dos pantallas.
import { aleatorio } from './cifrado.js';
import { aviso } from '../../src/compartido/notificaciones.js';

const SOLICITUD_MIN = 15;
const MAX_DOC = 1_500_000;
const MAX_LOTE = 100;
const MAX_RESPUESTA = 1_500_000;
const ID_DOC = /^[a-z]{3,20}\/[A-Za-z0-9:_.-]{1,100}$/;
const B64 = /^[A-Za-z0-9_-]+$/;

export async function rutaSincro(n, d, m, ruta, { json, ErrorHttp, cuerpo, url }) {
  const activa = async () => {
    const s = (await n.ajustes()).sincro;
    if (!s) throw new ErrorHttp(409, 'La sincronización no está activada.');
    return s;
  };
  const vigentes = n.ahora - SOLICITUD_MIN * 60_000;

  if (m === 'GET' && ruta === '/sincro') {
    const s = (await n.ajustes()).sincro ?? null;
    const { results } = await n.db
      .prepare('SELECT id, dispositivo, nombre, publica, creado FROM sincro_solicitudes WHERE sobre IS NULL AND creado > ? ORDER BY creado')
      .bind(vigentes)
      .all();
    const v = await n.db.prepare('SELECT MAX(version) AS v FROM sincro').first();
    return json({
      activa: Boolean(s),
      comprobante: s?.comprobante ?? null,
      desde: s?.desde ?? null,
      version: v?.v ?? 0,
      solicitudes: results.filter((r) => r.dispositivo !== d.id).map(({ id, nombre, publica, creado }) => ({ id, nombre, publica, creado })),
    });
  }

  if (m === 'POST' && ruta === '/sincro/activar') {
    const { comprobante } = await cuerpo();
    if (typeof comprobante !== 'string' || comprobante.length > 300 || !B64.test(comprobante)) throw new ErrorHttp(400, 'Comprobante no válido.');
    if ((await n.ajustes()).sincro) throw new ErrorHttp(409, 'La sincronización ya está activada en otro dispositivo: únete a ella.');
    await n.poner('sincro', { comprobante, desde: n.ahora, por: d.nombre });
    return json({ ok: true });
  }

  if (m === 'POST' && ruta === '/sincro/solicitudes') {
    await activa();
    const { publica } = await cuerpo();
    if (typeof publica !== 'string' || publica.length > 120 || !B64.test(publica)) throw new ErrorHttp(400, 'Llave pública no válida.');
    const id = `s${aleatorio(9)}`;
    await n.db.batch([
      n.db.prepare('DELETE FROM sincro_solicitudes WHERE dispositivo = ? OR creado <= ?').bind(d.id, vigentes),
      n.db.prepare('INSERT INTO sincro_solicitudes (id, dispositivo, nombre, publica, creado) VALUES (?, ?, ?, ?, ?)').bind(id, d.id, d.nombre, publica, n.ahora),
    ]);
    await n.notificar({ ...aviso(`${d.nombre} quiere sincronizar`, 'Abre Kitsune en este dispositivo para aprobarlo.'), url: './?sincro', etiqueta: 'sincro' }, { excepto: d.id });
    return json({ id });
  }

  const solicitud = ruta.match(/^\/sincro\/solicitudes\/(s[0-9A-Za-z_-]{4,40})(\/aprobar)?$/);
  if (solicitud) {
    const fila = await n.db.prepare('SELECT * FROM sincro_solicitudes WHERE id = ?').bind(solicitud[1]).first();
    if (m === 'GET' && !solicitud[2]) {
      if (!fila || fila.dispositivo !== d.id) return json({ rechazada: true });
      if (fila.creado <= vigentes) return json({ caducada: true });
      return json({ sobre: fila.sobre ? JSON.parse(fila.sobre) : null });
    }
    if (m === 'POST' && solicitud[2]) {
      await activa();
      if (!fila || fila.sobre || fila.creado <= vigentes) throw new ErrorHttp(404, 'Esa petición ya no está pendiente.');
      if (fila.dispositivo === d.id) throw new ErrorHttp(400, 'Apruébalo desde otro dispositivo.');
      const { sobre } = await cuerpo();
      if (!sobre || typeof sobre.publica !== 'string' || typeof sobre.datos !== 'string' || !B64.test(sobre.publica) || !B64.test(sobre.datos) || sobre.datos.length > 400) {
        throw new ErrorHttp(400, 'Sobre no válido.');
      }
      await n.db.prepare('UPDATE sincro_solicitudes SET sobre = ? WHERE id = ?').bind(JSON.stringify({ publica: sobre.publica, datos: sobre.datos }), fila.id).run();
      await n.registrar('dispositivo', `Sincronización: ${d.nombre} ha dado acceso a ${fila.nombre}.`).catch(() => {});
      return json({ ok: true });
    }
    if (m === 'DELETE' && !solicitud[2]) {
      await n.db.prepare('DELETE FROM sincro_solicitudes WHERE id = ?').bind(solicitud[1]).run();
      return json({ ok: true });
    }
  }

  if (m === 'GET' && ruta === '/sincro/cambios') {
    await activa();
    const desde = Math.max(0, Number(url.searchParams.get('desde')) || 0);
    const { results } = await n.db.prepare('SELECT id, version, cambiado, datos FROM sincro WHERE version > ? ORDER BY version LIMIT 200').bind(desde).all();
    const cambios = [];
    let total = 0;
    for (const r of results) {
      total += (r.datos?.length ?? 0) + 100;
      if (cambios.length && total > MAX_RESPUESTA) break;
      cambios.push(r);
    }
    return json({ cambios, hayMas: cambios.length < results.length || results.length === 200 });
  }

  if (m === 'POST' && ruta === '/sincro/cambios') {
    await activa();
    const { cambios } = await cuerpo();
    if (!Array.isArray(cambios) || !cambios.length || cambios.length > MAX_LOTE) throw new ErrorHttp(400, 'Lote no válido.');
    for (const c of cambios) {
      if (!c || !ID_DOC.test(c.id ?? '') || !Number.isFinite(c.cambiado)) throw new ErrorHttp(400, 'Cambio no válido.');
      if (c.datos !== null && (typeof c.datos !== 'string' || !B64.test(c.datos))) throw new ErrorHttp(400, 'Cambio no válido.');
      if (c.datos && c.datos.length > MAX_DOC) throw new ErrorHttp(413, 'Hay un dato demasiado grande para sincronizar.');
    }
    const ids = [...new Set(cambios.map((c) => c.id))];
    const { results } = await n.db.prepare(`SELECT id, cambiado, version FROM sincro WHERE id IN (${ids.map(() => '?').join(',')})`).bind(...ids).all();
    const actuales = new Map(results.map((r) => [r.id, r]));
    const resultados = [];
    const sentencias = [];
    for (const c of cambios) {
      const actual = actuales.get(c.id);
      // Gana el cambio más reciente: si el servidor tiene uno posterior, se queda.
      if (actual && actual.cambiado > c.cambiado) {
        resultados.push({ id: c.id, rechazado: true, version: actual.version });
        continue;
      }
      const cambiado = Math.min(c.cambiado, n.ahora + 60_000);
      sentencias.push(
        n.db
          .prepare(
            'INSERT INTO sincro (id, version, cambiado, datos, dispositivo) VALUES (?, (SELECT COALESCE(MAX(version), 0) + 1 FROM sincro), ?, ?, ?) ' +
              'ON CONFLICT(id) DO UPDATE SET version = excluded.version, cambiado = excluded.cambiado, datos = excluded.datos, dispositivo = excluded.dispositivo',
          )
          .bind(c.id, cambiado, c.datos, d.id),
      );
      actuales.set(c.id, { id: c.id, cambiado });
      resultados.push({ id: c.id, ok: true });
    }
    if (sentencias.length) await n.db.batch(sentencias);
    return json({ resultados });
  }

  // Empezar de cero: borra la copia cifrada del servidor (los dispositivos conservan sus datos).
  if (m === 'POST' && ruta === '/sincro/borrar') {
    await n.db.batch([n.db.prepare('DELETE FROM sincro'), n.db.prepare('DELETE FROM sincro_solicitudes')]);
    await n.quitar('sincro');
    await n.registrar('dispositivo', `Sincronización borrada del servidor desde ${d.nombre}.`).catch(() => {});
    return json({ ok: true });
  }
  return null;
}
