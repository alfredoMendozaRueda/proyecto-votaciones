// Modo de ejemplo: misma interfaz que window.asistente (el puente de Electron),
// con correos y respuestas inventados. Se usa al abrir la app en un navegador.
import { PLANTILLAS, normalizarAutomatizacion } from '../compartido/automatizaciones.js';
import { crearPeticion, COLECCIONES_SINCRO } from '../compartido/sincro.js';

const MINUTO = 60 * 1000;
const HORA = 60 * MINUTO;
const DIA = 24 * HORA;
const ahora = Date.now();

const espera = (ms) => new Promise((r) => setTimeout(r, ms));

const CORREOS = [
  {
    id: 'demo01',
    de: { nombre: 'Lucía Ortega', email: 'lucia.ortega@reformasortega.es' },
    asunto: 'Presupuesto de la reforma de la cocina',
    fecha: ahora - 38 * MINUTO,
    noLeido: true,
    destacado: false,
    extracto: 'Te adjunto el desglose que hablamos el martes. El total queda en 8.460 €, con la encimera de cuarzo incluida…',
    html: `<p>Hola,</p>
<p>Te adjunto el desglose que hablamos el martes. El total queda en <b>8.460 €</b>, con la encimera de cuarzo incluida.</p>
<table style="border-collapse:collapse;margin:12px 0;font-size:14px">
<tr><td style="padding:4px 16px 4px 0">Muebles y montaje</td><td style="text-align:right">4.920 €</td></tr>
<tr><td style="padding:4px 16px 4px 0">Encimera de cuarzo</td><td style="text-align:right">1.780 €</td></tr>
<tr><td style="padding:4px 16px 4px 0">Fontanería y electricidad</td><td style="text-align:right">1.160 €</td></tr>
<tr><td style="padding:4px 16px 4px 0">Retirada de escombros</td><td style="text-align:right">600 €</td></tr>
</table>
<p>Si te parece bien, podríamos empezar el <b>lunes 17</b>. Necesitaría que me confirmes antes del viernes para reservar al fontanero.</p>
<p>Un saludo,<br>Lucía<br><span style="color:#777">Reformas Ortega · 612 48 93 27</span></p>`,
    adjuntos: [{ nombre: 'presupuesto-cocina.pdf', tipo: 'application/pdf', tamano: 184320 }],
  },
  {
    id: 'demo02',
    de: { nombre: 'Marcos Velasco', email: 'marcos.velasco@estudiolumen.com' },
    asunto: 'Re: Entrega del informe trimestral',
    fecha: ahora - 2 * HORA - 12 * MINUTO,
    noLeido: true,
    destacado: true,
    extracto: 'Lo he revisado y está casi listo. Solo faltaría actualizar la gráfica de ventas con los datos de septiembre…',
    texto: `Lo he revisado y está casi listo. Solo faltaría actualizar la gráfica de ventas con los datos de septiembre y revisar el resumen de la primera página, que se repite un poco.

¿Te da tiempo a tenerlo para el jueves a las 12? Así lo presento en la reunión de las 13:00.

Gracias,
Marcos`,
  },
  {
    id: 'demo03',
    de: { nombre: 'Trenes Ibéricos', email: 'billetes@trenesibericos.es' },
    asunto: 'Tu billete Madrid → Valencia, 14 de noviembre',
    fecha: ahora - 5 * HORA,
    noLeido: true,
    destacado: false,
    extracto: 'Localizador K7M2QX · Salida 08:35 desde Madrid Atocha · Coche 6, plaza 11A…',
    html: `<div style="font-family:Arial,sans-serif;max-width:520px">
<h2 style="color:#8f1a20;margin:0 0 8px">Tu viaje está confirmado</h2>
<p style="margin:0 0 12px">Localizador <b>K7M2QX</b></p>
<table style="width:100%;border-collapse:collapse;font-size:14px">
<tr><td style="padding:6px 0;color:#666">Salida</td><td>14 nov · 08:35 · Madrid Atocha</td></tr>
<tr><td style="padding:6px 0;color:#666">Llegada</td><td>14 nov · 10:21 · Valencia Joaquín Sorolla</td></tr>
<tr><td style="padding:6px 0;color:#666">Asiento</td><td>Coche 6, plaza 11A (ventanilla)</td></tr>
</table>
<p style="margin-top:14px"><img src="https://ejemplo.invalid/qr-billete.png" alt="Código QR del billete" width="120" height="120"></p>
</div>`,
  },
  {
    id: 'demo10',
    de: { nombre: 'Librería Hoja Roja', email: 'boletin@hojaroja.es' },
    asunto: 'Novedades de noviembre: 20 % en novela japonesa',
    fecha: ahora - 9 * HORA,
    noLeido: false,
    destacado: false,
    extracto: 'Este mes, «La casa de los zorros» de Aiko Mori y una selección de clásicos con descuento…',
    // Boletín maquetado a 640 px, como la mayoría: sirve para ver que se ajusta al móvil.
    html: `<table width="640" cellpadding="0" cellspacing="0" style="width:640px;background:#fff;font-family:Georgia,serif">
<tr><td colspan="2" style="background:#8f1a20;color:#fff;padding:22px 28px;font-size:26px">Hoja Roja · Noviembre</td></tr>
<tr><td width="300" style="padding:20px 28px;vertical-align:top"><h3 style="margin:0 0 8px">La casa de los zorros</h3><p style="margin:0">La nueva novela de Aiko Mori: una familia, un santuario en las montañas de Nara y nueve colas que nadie debería ver.</p></td>
<td width="340" style="padding:20px 28px 20px 0;vertical-align:top"><img src="https://ejemplo.invalid/portada.jpg" width="300" height="200" alt="Portada de La casa de los zorros" style="display:block;width:300px"></td></tr>
<tr><td colspan="2" style="padding:0 28px 22px"><p>Hasta el 30 de noviembre, <b>20 % de descuento</b> en novela japonesa con el código <b>KITSUNE20</b>.</p>
<p style="font-size:12px;color:#777">¿No quieres recibir más correos? Date de baja en https://hojaroja.es/boletin/baja?usuario=tu.cuenta%40gmail.com&amp;lista=novedades-noviembre</p></td></tr>
</table>`,
  },
  {
    id: 'demo04',
    de: { nombre: 'Inés Prieto', email: 'ines.prieto@gmail.com' },
    asunto: 'Fotos del viaje a Kioto',
    fecha: ahora - 1 * DIA - 3 * HORA,
    noLeido: false,
    destacado: true,
    extracto: '¡Por fin las he subido! Mira la del santuario de Fushimi Inari, la de los mil torii rojos…',
    texto: `¡Por fin las he subido! Mira la del santuario de Fushimi Inari, la de los mil torii rojos. Me acordé de ti por los zorros de piedra que hay por todo el camino 🦊

Te paso el álbum completo este fin de semana.

Inés`,
  },
  {
    id: 'demo05',
    de: { nombre: 'Forja', email: 'avisos@forja.dev' },
    asunto: 'Nuevo comentario en tu pull request #12',
    fecha: ahora - 1 * DIA - 7 * HORA,
    noLeido: false,
    destacado: false,
    extracto: 'alba-dev comentó: "El shader del pelo va genial en mi portátil, ¿probamos con 16 capas?"',
    texto: `alba-dev comentó en "Pelo por capas para el kitsune":

"El shader del pelo va genial en mi portátil, ¿probamos con 16 capas?"`,
  },
  {
    id: 'demo06',
    de: { nombre: 'Mamá', email: 'carmen.rueda@gmail.com' },
    asunto: 'Cena del domingo',
    fecha: ahora - 2 * DIA,
    noLeido: false,
    destacado: true,
    extracto: 'Al final somos ocho. ¿Puedes traer tú el postre? La tarta de queso de la última vez triunfó…',
    texto: `Al final somos ocho. ¿Puedes traer tú el postre? La tarta de queso de la última vez triunfó.

Besos`,
  },
  {
    id: 'demo07',
    de: { nombre: 'Librería Alcaná', email: 'pedidos@libreriaalcana.es' },
    asunto: 'Tu pedido ha salido del almacén',
    fecha: ahora - 3 * DIA,
    noLeido: false,
    destacado: false,
    extracto: 'Pedido 48213 · "Cuentos de zorros del Japón antiguo" llegará entre el jueves y el viernes…',
    texto: `Pedido 48213

"Cuentos de zorros del Japón antiguo" llegará entre el jueves y el viernes. Te avisaremos cuando esté en reparto.`,
  },
  {
    id: 'demo08',
    de: { nombre: 'Comunidad Calle Olmo 14', email: 'administracion@fincasolmo.es' },
    asunto: 'Convocatoria de junta extraordinaria',
    fecha: ahora - 6 * DIA,
    noLeido: false,
    destacado: false,
    extracto: 'Se convoca junta extraordinaria el miércoles 20 a las 19:30 en el portal para tratar la sustitución del ascensor…',
    texto: `Se convoca junta extraordinaria el miércoles 20 a las 19:30 en el portal para tratar la sustitución del ascensor.

Orden del día:
1. Presupuestos recibidos.
2. Votación de la derrama.
3. Ruegos y preguntas.`,
  },
];

const NUEVO = {
  id: 'demo09',
  de: { nombre: 'Lucía Ortega', email: 'lucia.ortega@reformasortega.es' },
  asunto: 'Una cosa más sobre la cocina',
  noLeido: true,
  destacado: false,
  extracto: 'Se me olvidó comentarte: el fontanero solo puede el lunes por la mañana, ¿te viene bien a las 9?',
  texto: 'Se me olvidó comentarte: el fontanero solo puede el lunes por la mañana, ¿te viene bien a las 9?\n\nLucía',
};

// "Recuérdame llamar a Lucía mañana a las 10" → mañana a las 10:00 (o en una hora si no se entiende).
function recordatorioDe(texto) {
  const t = texto.toLowerCase();
  const cuando = new Date();
  const hora = t.match(/a las (\d{1,2})(?::(\d{2}))?/);
  const enHoras = t.match(/en (una|\d+) horas?/);
  if (enHoras) cuando.setTime(Date.now() + (enHoras[1] === 'una' ? 1 : Number(enHoras[1])) * HORA);
  else if (hora) {
    if (/mañana/.test(t)) cuando.setDate(cuando.getDate() + 1);
    cuando.setHours(Number(hora[1]), Number(hora[2] ?? 0), 0, 0);
    if (cuando < new Date()) cuando.setDate(cuando.getDate() + 1);
  } else cuando.setTime(Date.now() + HORA);
  const que = texto
    .replace(/^.*?recu[eé]rdame\s*(que\s*)?/i, '')
    .replace(/\s*(mañana\s*)?(a las \d{1,2}(:\d{2})?|en (una|\d+) horas?)\s*$/i, '')
    .trim();
  return { texto: que ? que[0].toUpperCase() + que.slice(1) : 'Lo que me pediste', cuando: cuando.getTime() };
}

// Agenda de ejemplo, relativa a hoy.
function eventosDeEjemplo() {
  const dia = (desplazamiento, h = 0, m = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + desplazamiento);
    d.setHours(h, m, 0, 0);
    return d.getTime();
  };
  return [
    { id: 'ev1', titulo: 'Dentista', inicio: dia(0, 17, 30), fin: dia(0, 18, 15), todoElDia: false, lugar: 'Clínica Sonrisas' },
    { id: 'ev2', titulo: 'Llamada con Lucía (obra)', inicio: dia(1, 10), fin: dia(1, 10, 30), todoElDia: false, lugar: '' },
    { id: 'ev3', titulo: 'Reunión con Marcos · informe', inicio: dia(2, 13), fin: dia(2, 14), todoElDia: false, lugar: 'Estudio Lumen' },
    { id: 'ev4', titulo: 'Cumpleaños de Ana', inicio: dia(4), fin: dia(5), todoElDia: true, lugar: '' },
    { id: 'ev5', titulo: 'Clase de fotografía', inicio: dia(6, 19), fin: dia(6, 21), todoElDia: false, lugar: 'Centro cultural' },
  ];
}

// Conversaciones de ejemplo para el historial.
const CONVERSACIONES = [
  {
    id: 'cdemo1',
    titulo: '¿Qué llevo para el viaje a Valencia?',
    resumen: 'Para dos días en noviembre: chaqueta ligera, paraguas plegable y el cargador del móvil.',
    actualizada: ahora - 3 * HORA,
    mensajes: [
      { rol: 'usuario', texto: '¿Qué llevo para el viaje a Valencia?' },
      { rol: 'kitsune', texto: 'Para dos días en noviembre: **chaqueta ligera**, paraguas plegable y el cargador del móvil. El tren sale a las 08:35 de Atocha.' },
    ],
  },
  {
    id: 'cdemo2',
    titulo: 'Ideas para el cumpleaños de Ana',
    resumen: 'Un álbum con las fotos de Kioto, una clase de cerámica para dos o una cena japonesa.',
    actualizada: ahora - 1 * DIA - 2 * HORA,
    mensajes: [
      { rol: 'usuario', texto: 'Ideas para el cumpleaños de Ana' },
      { rol: 'kitsune', texto: 'Tres ideas: un **álbum con las fotos de Kioto**, una clase de cerámica para dos o una cena japonesa.' },
    ],
  },
  {
    id: 'cdemo3',
    titulo: 'Resume el correo de Marcos',
    resumen: 'Pide actualizar la gráfica de ventas con septiembre y revisar el resumen para el jueves a las 12.',
    actualizada: ahora - 4 * DIA,
    mensajes: [
      { rol: 'usuario', texto: 'Resume el correo de Marcos' },
      { rol: 'kitsune', texto: 'Pide actualizar la gráfica de ventas con septiembre y revisar el resumen para el **jueves a las 12**.' },
    ],
  },
];

// Tren del correo de ejemplo, para "añádelo a mi calendario".
function eventoTren() {
  const anio = new Date().getFullYear() + (new Date().getMonth() === 11 && new Date().getDate() > 14 ? 1 : 0);
  return { titulo: 'Tren Madrid → Valencia', inicio: new Date(anio, 10, 14, 8, 35).getTime(), fin: new Date(anio, 10, 14, 10, 21).getTime(), todoElDia: false, lugar: 'Madrid Atocha · coche 6, plaza 11A', descripcion: 'Localizador K7M2QX' };
}

function respuestaPara(texto) {
  const t = texto.toLowerCase();
  if (/^(resume|traduce|mejora|expl[ií]ca)/.test(t) && /<texto>/.test(t)) {
    const accion = t.slice(0, 6);
    return {
      texto:
        accion.startsWith('traduc')
          ? 'Here is the translation: *“Thanks for your message. I agree with the quote; let’s start on Monday the 17th.”*'
          : accion.startsWith('mejora')
            ? 'Gracias por tu mensaje. Me parece bien el presupuesto: empezamos el **lunes 17**. ¿Me pasas los datos para el adelanto?'
            : 'En resumen: **aceptas el presupuesto** y propones empezar el **lunes 17**; falta pedir los datos para el adelanto.',
    };
  }
  if (/recuerda que|acu[eé]rdate de que/.test(t)) {
    const dato = texto.replace(/^.*?(recuerda|acu[eé]rdate de) que\s*/i, '').replace(/[.!]+$/, '');
    return { herramienta: 'recordar', dato: dato[0].toUpperCase() + dato.slice(1), texto: 'Apuntado, lo tendré en cuenta.' };
  }
  if (/tiempo|llover|lluvia|noticias/.test(t)) {
    return {
      herramienta: 'web_search',
      fuentes: [
        { url: 'https://www.aemet.es/es/eltiempo/prediccion/municipios', titulo: 'AEMET · Predicción por municipios' },
        { url: 'https://www.eltiempo.es/', titulo: 'eltiempo.es' },
      ],
      texto: 'Mañana en Madrid: **soleado por la mañana** y nubes por la tarde, entre **9 °C y 18 °C**. Probabilidad de lluvia baja (10 %). Para el viaje a Valencia del día 14, de momento se espera buen tiempo.',
    };
  }
  if (/calendario|agenda/.test(t) && /a[ñn]ade|apunta|pon|crea/.test(t)) {
    return { herramienta: 'crear_evento', evento: eventoTren(), texto: 'Listo, ya está en tu calendario: **Tren Madrid → Valencia**, 14 de noviembre a las 08:35.', textoNo: 'De acuerdo, no lo añado.' };
  }
  if (/agenda|calendario|citas?/.test(t)) {
    return {
      herramienta: 'ver_agenda',
      texto: 'Esta semana tienes:\n\n- **Hoy 17:30** · Dentista (Clínica Sonrisas)\n- **Jueves 13:00** · Reunión con Marcos para el informe\n- **Sábado** · Cumpleaños de Ana (todo el día)',
    };
  }
  if (/recu[eé]rdame/.test(t)) {
    const recordatorio = recordatorioDe(texto);
    const hora = new Date(recordatorio.cuando).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return {
      herramienta: 'crear_recordatorio',
      recordatorio,
      texto: `Hecho: te aviso a las **${hora}** para «${recordatorio.texto.toLowerCase()}».`,
    };
  }
  if (/pulso/.test(t)) {
    return {
      herramienta: 'buscar_correos',
      texto:
        '**Tu pulso de hoy**\n\n' +
        '- **Urgente:** confirmar a Lucía el presupuesto de la cocina (8.460 €) **antes del viernes**.\n' +
        '- **Trabajo:** Marcos necesita la gráfica de ventas actualizada para el **jueves a las 12**.\n' +
        '- **Viaje:** tu tren a Valencia sale el 14 de noviembre a las 08:35 (coche 6, plaza 11A).\n' +
        '- **Recordatorios:** ninguno para hoy.\n\n' +
        'Te sugiero contestar a Lucía ahora: son dos minutos y desbloquea la obra. ¿Te preparo la respuesta?',
    };
  }
  if (/sin leer|no le[ií]d|nuevo|correo/.test(t) && !/respon|redact|contesta/.test(t)) {
    return {
      herramienta: 'buscar_correos',
      texto:
        'Tienes **3 correos sin leer**:\n\n' +
        '- **Lucía Ortega** · presupuesto de la reforma de la cocina: 8.460 € en total. Quiere que confirmes **antes del viernes** para empezar el lunes 17.\n' +
        '- **Marcos Velasco** · pide actualizar la gráfica de ventas del informe para el **jueves a las 12**.\n' +
        '- **Trenes Ibéricos** · tu billete a Valencia del 14 de noviembre, salida 08:35, coche 6, plaza 11A.\n\n' +
        'Lo más urgente es lo de Lucía. ¿Quieres que te prepare una respuesta?',
    };
  }
  if (/respon|redact|contesta|s[ií]/.test(t)) {
    return {
      herramienta: 'leer_correo',
      texto:
        'Aquí tienes un borrador para Lucía:\n\n' +
        '> Hola, Lucía:\n> Me parece bien el presupuesto. Confirmamos el inicio para el **lunes 17**. ' +
        '¿Me pasas los datos para el adelanto?\n> Un saludo.\n\n' +
        'Puedes enviarlo desde la pestaña **Correo**, en el botón Responder.',
    };
  }
  if (/hola|buenas|qu[ié]n eres/.test(t)) {
    return { texto: 'Hola, soy Kitsune. Puedo responderte preguntas, revisar tu correo y ayudarte a redactar respuestas. ¿Por dónde empezamos?' };
  }
  return {
    texto:
      'Buena pregunta. En esta vista de ejemplo mis respuestas están preparadas de antemano; ' +
      'en la aplicación real te contesta Claude directamente. Prueba a preguntarme **«¿tengo correos sin leer?»**.',
  };
}

export function crearDemo() {
  const correos = CORREOS.map((c) => ({ ...c }));
  const oyentes = { claude: [], nuevo: [], alternar: [], ajustes: [], aviso: [], cita: [], texto: [] };
  let ajustes = {
    atajo: 'Control+Alt+K',
    paleta: 'carmesi',
    estilo: 'ilustracion',
    tamano: 'mediano',
    posicion: 'izquierda',
    calidadPelo: 'auto',
    fuegos: true,
    seguirCursor: true,
    iniciarConWindows: true,
    dormirTrasMin: 5,
    voz: false,
    modelo: 'claude-opus-5-5',
    personalidad: 'Tutéame y sé directo. Si algo es urgente, dímelo primero.',
    correoCadaMin: 5,
    avisarCorreo: true,
    fotosRemitentes: true,
    googleClientId: '123456789-kitsune.apps.googleusercontent.com',
    pulsoDiario: true,
    proveedor: 'openai',
    modoIA: 'eficiente',
    modeloGroq: 'openai/gpt-oss-120b',
    modeloOpenAI: 'gpt-6-luna',
    usarMemoria: true,
    busquedaWeb: true,
    avisarCitas: true,
    ofrecerPortapapeles: true,
  };
  let cancelado = false;
  let recordatorios = [
    { id: 'rdemo-a', texto: 'Confirmar a Lucía el presupuesto', cuando: (() => { const d = new Date(); d.setHours(d.getHours() + 2, 0, 0, 0); return d.getTime(); })(), avisado: false },
    { id: 'rdemo-b', texto: 'Comprar el regalo de Ana', cuando: (() => { const d = new Date(); d.setDate(d.getDate() + 2); d.setHours(18, 0, 0, 0); return d.getTime(); })(), avisado: false },
  ];
  let numRecordatorio = 0;
  let memoria = [
    { id: 'mdemo1', texto: 'Su hermana se llama Ana y cumple años el sábado', creado: ahora - 3 * DIA },
    { id: 'mdemo2', texto: 'Le interesan la fotografía y los viajes a Japón', creado: ahora - DIA },
  ];
  let numMemoria = 2;
  const confirmaciones = new Map();
  let eventos = eventosDeEjemplo();
  let conversaciones = CONVERSACIONES.map((c) => ({ ...c, creada: c.actualizada }));
  let conversacionActual = 'cdemo-actual';

  const emitir = (evento) => oyentes.claude.forEach((f) => f(evento));
  const escuchar = (lista, f) => {
    oyentes[lista].push(f);
    return () => (oyentes[lista] = oyentes[lista].filter((x) => x !== f));
  };

  const api = {
    demo: true,
    plataforma: 'demo',
    ajustes: {
      obtener: async () => ({ ...ajustes }),
      guardar: async (cambios) => {
        ajustes = { ...ajustes, ...cambios };
        return { ...ajustes };
      },
    },
    claude: {
      estado: async () => ({ proveedor: ajustes.proveedor, configurado: true, claves: { claude: true, groq: true, openai: true } }),
      guardarClave: async () => ({ proveedor: ajustes.proveedor, configurado: true, claves: { claude: true, groq: true, openai: true } }),
      cancelar: async () => {
        cancelado = true;
      },
      reiniciar: async () => {
        conversacionActual = `cdemo${Date.now()}`;
      },
      mensajes: async () => [],
      confirmar: async (id, acepta) => confirmaciones.get(id)?.(acepta),
      alEvento: (f) => escuchar('claude', f),
      async enviar(texto) {
        cancelado = false;
        const { herramienta, texto: textoSi, textoNo, recordatorio, dato, evento, fuentes } = respuestaPara(texto);
        let respuesta = textoSi;
        emitir({ tipo: 'pensando' });
        await espera(700);
        if (herramienta) {
          emitir({ tipo: 'herramienta', nombre: herramienta });
          await espera(1100);
          if (recordatorio) {
            const nuevo = { id: `rdemo${++numRecordatorio}`, avisado: false, ...recordatorio };
            recordatorios.push(nuevo);
            emitir({ tipo: 'recordatorio', recordatorio: nuevo });
          }
          if (dato) {
            const nuevo = { id: `mdemo${++numMemoria}`, texto: dato, creado: Date.now() };
            memoria.push(nuevo);
            emitir({ tipo: 'memoria', dato: nuevo });
          }
          if (evento) {
            const id = `cdemo${Date.now()}`;
            const acepta = await new Promise((resolver) => {
              confirmaciones.set(id, resolver);
              const cuando = new Date(evento.inicio).toLocaleString('es-ES', { weekday: 'long', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
              const accion = { tipo: 'evento', icono: 'calendario', pregunta: '¿Lo añado a tu calendario?', titulo: evento.titulo, detalle: [cuando, evento.lugar].filter(Boolean).join(' · '), boton: 'Añadir', hecho: 'Añadido a tu calendario' };
              emitir({ tipo: 'confirmar', id, accion });
            });
            confirmaciones.delete(id);
            if (acepta) {
              eventos.push({ id: `ev${Date.now()}`, ...evento });
              emitir({ tipo: 'evento', evento: { id: 'edemo', ...evento } });
              emitir({ tipo: 'confirmado', id, ok: true });
            }
            else respuesta = textoNo;
          }
          emitir({ tipo: 'nuevo-bloque' });
          emitir({ tipo: 'pensando' });
          await espera(400);
        }
        for (const trozo of respuesta.match(/\S+\s*/g)) {
          if (cancelado) {
            emitir({ tipo: 'cancelado' });
            return;
          }
          emitir({ tipo: 'texto', delta: trozo });
          await espera(28);
        }
        if (fuentes) emitir({ tipo: 'fuentes', fuentes });
        emitir({ tipo: 'fin' });
      },
      async redactarRespuesta(id) {
        await espera(1200);
        const correo = correos.find((c) => c.id === id);
        return `Hola, ${correo.de.nombre.split(' ')[0]}:\n\nGracias por tu mensaje. Me parece bien; lo confirmo para el lunes.\n\nUn saludo.`;
      },
    },
    correo: {
      estado: async () => ({ conectado: true, email: 'tu.cuenta@gmail.com', configurado: true, calendario: true }),
      guardarSecretoCliente: async () => {},
      conectar: async () => ({ conectado: true, email: 'tu.cuenta@gmail.com', configurado: true }),
      desconectar: async () => ({ conectado: false, email: null, configurado: true }),
      async listar({ filtro = 'recibidos', consulta = '' } = {}) {
        await espera(250);
        const q = consulta.toLowerCase();
        const mensajes = correos
          .filter((c) => !c.archivado && !c.papelera)
          .filter((c) => (filtro === 'no-leidos' ? c.noLeido : filtro === 'destacados' ? c.destacado : true))
          .filter((c) => !q || `${c.de.nombre} ${c.asunto} ${c.extracto}`.toLowerCase().includes(q))
          .sort((a, b) => b.fecha - a.fecha)
          .map(({ html, texto, adjuntos, ...resumen }) => resumen);
        return { mensajes, siguiente: null };
      },
      async leer(id) {
        await espera(200);
        const c = correos.find((x) => x.id === id);
        return { para: 'tu.cuenta@gmail.com', cc: '', adjuntos: [], html: '', texto: '', ...c };
      },
      async modificar(id, { leido, destacado, archivar, papelera } = {}) {
        const c = correos.find((x) => x.id === id);
        if (leido !== undefined) c.noLeido = !leido;
        if (destacado !== undefined) c.destacado = destacado;
        if (archivar) c.archivado = true;
        if (papelera) c.papelera = true;
        return {};
      },
      async enviar({ adjuntos = [] } = {}) {
        await espera(600 + adjuntos.length * 200);
        return { id: 'demo-enviado', threadId: 'demo-hilo' };
      },
      alNuevo: (f) => escuchar('nuevo', f),
    },
    conversaciones: {
      listar: async () => ({ lista: conversaciones.map(({ mensajes, ...c }) => ({ ...c, mensajes: mensajes.length })), actual: conversacionActual }),
      async abrir(id) {
        const c = conversaciones.find((x) => x.id === id);
        if (!c) throw new Error('No se ha podido abrir esa conversación.');
        conversacionActual = id;
        return c.mensajes;
      },
      async borrar(id) {
        conversaciones = conversaciones.filter((c) => c.id !== id);
        return { borrada: id };
      },
      async borrarTodo() {
        conversaciones = [];
      },
    },
    memoria: {
      async recordar(texto) {
        const dato = { id: `mdemo${++numMemoria}`, texto: texto.trim(), creado: Date.now() };
        if (!dato.texto) throw new Error('No hay nada que recordar.');
        memoria.push(dato);
        return dato;
      },
      listar: async () => [...memoria],
      async olvidar(id) {
        memoria = memoria.filter((d) => d.id !== id);
        return { olvidado: id };
      },
      async olvidarTodo() {
        memoria = [];
      },
    },
    calendario: {
      estado: async () => ({ conectado: true, calendario: true }),
      async eventos(desde, hasta) {
        await espera(200);
        return eventos.filter((e) => e.fin > desde && e.inicio < hasta).sort((a, b) => a.inicio - b.inicio);
      },
      async crear(evento) {
        const nuevo = { id: `ev${Date.now()}`, ...evento };
        eventos.push(nuevo);
        return nuevo;
      },
      async borrar(id) {
        eventos = eventos.filter((e) => e.id !== id);
        return { borrado: id };
      },
      alCita: (f) => escuchar('cita', f),
    },
    recordatorios: {
      async crear({ texto, cuando }) {
        if (!texto?.trim()) throw new Error('El recordatorio necesita un texto.');
        if (!(cuando > Date.now() - 60_000)) throw new Error('Esa hora ya ha pasado.');
        const nuevo = { id: `rdemo${++numRecordatorio}`, texto: texto.trim(), cuando, avisado: false };
        recordatorios.push(nuevo);
        return nuevo;
      },
      listar: async () => recordatorios.filter((r) => !r.avisado).sort((a, b) => a.cuando - b.cuando),
      async borrar(id) {
        recordatorios = recordatorios.filter((r) => r.id !== id);
        return { borrado: id };
      },
      alAviso: (f) => escuchar('aviso', f),
    },
    // Servidor de avisos simulado: vinculado, con push y dos automatizaciones.
    // IA simulada para Empleo: respuestas fijas según la tarea.
    ia: {
      async transcribir(audio) {
        await new Promise((r) => setTimeout(r, 500));
        return audio?.byteLength ? 'Recuérdame mañana a las nueve llamar a Lucía' : '';
      },
      async tarea({ sistema, usuario }) {
        await new Promise((r) => setTimeout(r, 700));
        const r = respuestaEmpleoDemo(sistema, usuario);
        return { texto: typeof r === 'string' ? r : JSON.stringify(r), fuentes: [] };
      },
    },
    empleo: (() => {
      let guardado = null;
      return {
        leer: async () => (guardado ? JSON.parse(guardado) : null),
        guardar: async (datos) => {
          guardado = JSON.stringify(datos);
        },
      };
    })(),
    // Gasto de OpenAI de ejemplo.
    consumo: {
      async resumen() {
        const mes = new Date().toISOString().slice(0, 7);
        const anterior = new Date(new Date().setDate(0)).toISOString().slice(0, 7);
        const d = (usd, peticiones, entrada, cache, salida, busquedas) => ({ usd, peticiones, entrada, cache, salida, busquedas });
        const dispositivos = [
          { nombre: 'iPhone', yo: true, servidor: false, ...d(0.1384, 212, 1_240_000, 610_000, 64_000, 4) },
          { nombre: 'Windows (CASA)', yo: false, servidor: false, ...d(0.0517, 85, 470_000, 260_000, 21_000, 1) },
          { nombre: 'Servidor (alertas y automatizaciones)', yo: false, servidor: true, ...d(0.0121, 18, 96_000, 0, 5_000, 0) },
        ];
        const total = dispositivos.reduce((t, x) => Object.fromEntries(Object.keys(t).map((k) => [k, t[k] + x[k]])), d(0, 0, 0, 0, 0, 0));
        return { mes, total, dispositivos, historial: [{ mes: anterior, ...d(0.3912, 640, 3_900_000, 2_100_000, 180_000, 9) }] };
      },
    },
    // Sincronización simulada: al activarla, «Windows (CASA)» pide unirse.
    sincro: (() => {
      const e = { aqui: false, servidor: false, ultima: 0, solicitudes: [], colecciones: COLECCIONES_SINCRO.map(([c]) => c) };
      return {
        async resumen() {
          return { ...e, error: '', pendientes: 0, esperando: null, solicitudes: [...e.solicitudes] };
        },
        async activar() {
          await new Promise((r) => setTimeout(r, 500));
          Object.assign(e, { aqui: true, servidor: true, ultima: Date.now() });
          const { publica } = await crearPeticion();
          e.solicitudes = [{ id: 'sdemo', nombre: 'Windows (CASA)', publica, creado: Date.now() }];
        },
        async aprobar(id) {
          e.solicitudes = e.solicitudes.filter((x) => x.id !== id);
        },
        async rechazar(id) {
          e.solicitudes = e.solicitudes.filter((x) => x.id !== id);
        },
        async elegirColecciones(lista) {
          e.colecciones = lista;
        },
        async sincronizar() {
          e.ultima = Date.now();
        },
        async desactivar() {
          e.aqui = false;
        },
        async borrarServidor() {
          Object.assign(e, { aqui: false, servidor: false, solicitudes: [] });
        },
        solicitar: async () => ({ id: 'x', codigo: '000 000' }),
        esperar: async () => true,
        cancelarEspera: async () => {},
        alCambios: () => () => {},
      };
    })(),
    servidor: (() => {
      let alertaDemo = null;
      let ultimasDemo = null;
      let registroActivo = true;
      let registroDemo = [
        {
          id: 2, cuando: Date.now() - 2 * HORA + 40_000, origen: 'servidor', etiqueta: 'revisar CV y carta', sobre: 'alerta-preparada', proveedor: 'openai', modelo: 'gpt-6-luna', ms: 8400, ok: true,
          sistema: 'Eres un revisor exigente de candidaturas, con la cabeza fresca… "encaje" (0-100: cuánto encaja la persona REAL con la oferta, con el mismo criterio que la evaluación previa…)',
          usuario: '<cv_original>\nElena Martín Rubio · Frontend Engineer…\n</cv_original>\n<oferta>\nPlanificador de rutas para repartidores. Se valora experiencia con mapas (Mapbox o Leaflet)…\n</oferta>\n<evaluacion_previa>\nencaje 81 (Encaje fuerte); tecnica 86, experiencia 78, cultura 74, carrera 82\n</evaluacion_previa>',
          respuesta: '{"encaje": 62, "notas": ["Le doy 62 y no 81: la oferta pide experiencia con mapas (Mapbox o Leaflet) y tu CV no la menciona."], "carta": "Hola, equipo de Senda Rutas: …"}',
        },
        {
          id: 1, cuando: Date.now() - 2 * HORA, origen: 'servidor', etiqueta: 'puntuar ofertas', sobre: 'alerta-preparada demo-1 demo-2', proveedor: 'groq', modelo: 'openai/gpt-oss-20b', ms: 2100, ok: true,
          sistema: 'Eres técnico de selección y evalúas ofertas con el marco de ai-job-search…',
          usuario: '<perfil>Frontend Engineer · React, TypeScript…</perfil>\n<oferta id="alerta-preparada">Frontend (React) · Senda Rutas · Madrid…</oferta>',
          respuesta: '{"evaluaciones":[{"id":"alerta-preparada","puerta":"pasa","tecnica":86,"experiencia":78,"cultura":74,"carrera":82,"motivos":["React y TypeScript como en tus dos últimos puestos"]}]}',
        },
      ];
      // Una candidatura «preparada esta mañana» por el servidor, para ver cómo llega.
      let preparadasDemo = [
        {
          id: 'pdemo1',
          fecha: Date.now() - 2 * HORA,
          oferta: {
            ...OFERTA_ALERTA_DEMO,
            id: 'alerta-preparada',
            descripcion:
              'Planificador de rutas para repartidores. Buscamos frontend con React y TypeScript que cuide la accesibilidad. ' +
              'Si te interesa, envía tu CV a seleccion@senda-rutas.ejemplo.es indicando la referencia FE-24.',
          },
          cv: { ...PERFIL_DEMO, titular: 'Frontend Engineer · React y TypeScript' },
          carta:
            'Hola, equipo de Senda Rutas:\n\nOs escribo por la oferta de frontend (ref. FE-24). Llevo seis años con React y TypeScript y en Tranvía Software reduje un 38 % el tiempo de carga.\n\n' +
            'Un planificador de rutas se usa en la calle y con prisa: justo donde la accesibilidad y el rendimiento en móvil marcan la diferencia.\n\nUn saludo,\nElena Martín Rubio',
          palabrasClave: ['React', 'TypeScript', 'Accesibilidad'],
          terminosOferta: ['React', 'TypeScript', 'Accesibilidad'],
          notas: ['Le doy 62 y no 81: la oferta pide experiencia con mapas (Mapbox o Leaflet) y tu CV no la menciona.', 'Carta centrada en el uso en movilidad.', 'Añadida la referencia FE-24 que pide la oferta.'],
          encaje: 62,
          idioma: 'es',
          empresa: 'Senda Rutas (ejemplo): software de rutas para repartos de última milla, equipo pequeño en Madrid.',
        },
      ];
      let autos = PLANTILLAS.slice(0, 2).map((p, i) => normalizarAutomatizacion(p.automatizacion, `ademo${i}`));
      let avisos = { correo: true, soloPrincipal: true, correoCadaMin: 2, citas: 15, silencio: { activo: true, desde: '23:00', hasta: '08:00' } };
      let pushAqui = false;
      const registro = [
        { cuando: Date.now() - 40 * MINUTO, tipo: 'automatizacion', texto: 'Reservas a la agenda · «Confirmación de tu billete»: añadido «Tren Madrid → Valencia» a la agenda, aviso enviado.' },
        { cuando: Date.now() - 3 * HORA, tipo: 'aviso', texto: 'Kitsune te recordó: Llamar a Lucía.' },
      ];
      const estado = async () => ({
        configurado: true,
        integrado: true,
        vinculado: true,
        soportaPush: true,
        instalada: true,
        ios: false,
        puedeVincularConGoogle: true,
        email: 'tu.cuenta@gmail.com',
        google: true,
        groq: true,
        openai: false,
        avisos,
        pushAqui,
        dispositivos: [
          { id: 'd1', nombre: 'iPhone', push: pushAqui, yo: true },
          { id: 'd2', nombre: 'Windows (CASA)', push: false, yo: false },
        ],
      });
      return {
        empleo: {
          async buscar() {
            await new Promise((r) => setTimeout(r, 600));
            return { ofertas: OFERTAS_DEMO.map((o, i) => ({ ...o, id: `demo-${i}`, fuente: i === 1 ? 'freehire' : 'LinkedIn' })), errores: [] };
          },
          async alerta() {
            const enCola = preparadasDemo.filter((p) => p.fecha > Date.now()).length;
            return { alerta: alertaDemo, ultimas: ultimasDemo, groq: true, claves: { groq: true, openai: true }, modo: alertaDemo?.modo ?? ajustes.modoIA, gastado: 0.31, enCola };
          },
          preparadas: async () => ({ preparadas: preparadasDemo.filter((p) => p.fecha <= Date.now()) }),
          // Registro de la IA de ejemplo: la puntuación de la búsqueda y la revisión de la candidatura.
          async registroIA({ sobre = '' } = {}) {
            const todas = registroDemo.filter((e) => !sobre || ` ${e.sobre} `.includes(` ${sobre} `));
            return { activo: registroActivo, entradas: registroActivo ? todas : [] };
          },
          async borrarRegistroIA() {
            registroDemo = [];
            return { ok: true };
          },
          async activarRegistroIA(activo) {
            registroActivo = Boolean(activo);
            if (!activo) registroDemo = [];
            return { ok: true };
          },
          // «Buscar y preparar»: encuentra dos ofertas y deja lista la mejor al cabo de unos segundos.
          async ahora({ excluir = [] } = {}) {
            await new Promise((r) => setTimeout(r, 900));
            const ofertas = OFERTAS_DEMO.slice(0, 2).map((o, i) => ({ ...o, id: `ahora-${i}`, encaje: 82 - i * 9, veredicto: i ? 'encaje bueno' : 'encaje fuerte', puerta: 'pasa', motivos: ['React y TypeScript'], faltan: [] }));
            const mejor = ofertas.find((o) => !excluir.includes(o.url));
            if (mejor && !preparadasDemo.some((p) => p.oferta.url === mejor.url)) {
              preparadasDemo.push({ ...PREPARADA_DEMO(mejor), fecha: Date.now() + 15_000 });
            }
            ultimasDemo = { fecha: Date.now(), evaluadas: true, errores: [], ofertas };
            const enCola = preparadasDemo.filter((p) => p.fecha > Date.now()).length;
            return { ultimas: ultimasDemo, enCola, preparando: enCola, ia: true };
          },
          async recogerPreparadas(ids) {
            preparadasDemo = preparadasDemo.filter((p) => !ids.includes(p.id));
            return { ok: true };
          },
          async guardarAlerta(datos) {
            if (datos.activa && !String(datos.puestos ?? '').trim()) throw new Error('Di qué puesto buscar para las alertas.');
            alertaDemo = {
              activa: Boolean(datos.activa),
              puestos: datos.puestos ?? '',
              ubicacion: datos.ubicacion ?? '',
              modalidad: datos.modalidad ?? '',
              hora: datos.hora || '08:30',
              minEncaje: Number(datos.minEncaje ?? 60),
              preparar: Number(datos.preparar ?? 2),
              investigar: datos.investigar !== false,
              presupuesto: Number(datos.presupuesto ?? 1.5),
              modo: datos.modo ?? 'eficiente',
              conPerfil: true,
            };
            return { alerta: alertaDemo };
          },
          async probarAlerta() {
            await new Promise((r) => setTimeout(r, 600));
            ultimasDemo = {
              fecha: Date.now(),
              evaluadas: true,
              errores: [],
              ofertas: [{ ...OFERTA_ALERTA_DEMO, id: `alerta-${Date.now()}` }],
            };
            return { ultimas: ultimasDemo };
          },
          async detalle(url) {
            const o = OFERTAS_DEMO.find((x) => x.url === url) ?? OFERTAS_DEMO[0];
            return { ...o, descripcion: `${o.resumen}\nFunciones: desarrollar con React y TypeScript, cuidar el rendimiento y la accesibilidad, revisar código.\nRequisitos: ${o.requisitos.join(', ')}.\nSe valora: sistemas de diseño.` };
          },
        },
        estado,
        conectar: estado,
        canjear: estado,
        async activarPush() {
          pushAqui = true;
          return estado();
        },
        async desactivarPush() {
          pushAqui = false;
          return estado();
        },
        probar: async () => ({ ok: true }),
        resumen: async () => ({ titulo: 'Buenos días: tu día', cuerpo: '1 cita: 10:00 Dentista · 3 correos sin leer' }),
        crearCodigo: async () => ({ codigo: '482913', caduca: Date.now() + 10 * MINUTO }),
        async avisos(nuevos) {
          avisos = { ...avisos, ...nuevos };
          return avisos;
        },
        groq: async () => ({ ok: true }),
        openai: async () => ({ ok: true }),
        automatizaciones: {
          listar: async () => autos,
          async crear(datos) {
            const a = normalizarAutomatizacion(datos);
            autos.push(a);
            return a;
          },
          async actualizar(id, datos) {
            const a = normalizarAutomatizacion(datos, id);
            autos = autos.map((x) => (x.id === id ? a : x));
            return a;
          },
          async borrar(id) {
            autos = autos.filter((x) => x.id !== id);
            return { ok: true };
          },
        },
        registro: async () => registro,
        quitarDispositivo: async () => ({ ok: true }),
        desvincular: estado,
      };
    })(),
    ventana: {
      alAlternar: (f) => escuchar('alternar', f),
      alAbrirAjustes: (f) => escuchar('ajustes', f),
      alTexto: (f) => escuchar('texto', f),
      ocultar: () => {},
      ratonDentro: () => {},
      abrirEnlace: async (url) => window.open(url, '_blank', 'noopener'),
    },
    // Controles solo del modo de ejemplo (atajo simulado y correo entrante).
    simular: {
      alternar: (accion) => oyentes.alternar.forEach((f) => f(accion)),
      abrirAjustes: () => oyentes.ajustes.forEach((f) => f()),
      textoCopiado(
        texto = 'Hola, Lucía: gracias por el presupuesto, nos parece bien. Si os viene bien podemos empezar el lunes 17. ¿Nos pasas los datos para el adelanto? Un saludo.',
      ) {
        oyentes.texto.forEach((f) => f(texto));
      },
      cita() {
        const inicio = Date.now() + 15 * MINUTO;
        oyentes.cita.forEach((f) => f({ id: 'edemo-cita', titulo: 'Dentista', lugar: 'Clínica Sonrisas', inicio, fin: inicio + HORA, todoElDia: false }));
      },
      recordatorio(texto = 'Llamar a Lucía por la cocina') {
        oyentes.aviso.forEach((f) => f({ id: 'rdemo-aviso', texto, cuando: Date.now(), avisado: true }));
      },
      correoNuevo() {
        if (correos.some((c) => c.id === NUEVO.id)) return;
        const correo = { ...NUEVO, fecha: Date.now() };
        correos.push(correo);
        oyentes.nuevo.forEach((f) => f({ cantidad: 1, ultimo: correo }));
      },
    },
  };
  return api;
}


// ---------- Empleo (demostración) ----------

const PERFIL_DEMO = {
  nombre: 'Elena Martín Rubio',
  titular: 'Desarrolladora frontend',
  ubicacion: 'Madrid',
  email: 'elena.martin@ejemplo.es',
  telefono: '600 123 456',
  enlaces: ['linkedin.com/in/elena-martin-ejemplo'],
  resumen: 'Desarrolladora frontend con 6 años de experiencia en React y TypeScript, accesibilidad y rendimiento web.',
  experiencia: [
    { puesto: 'Desarrolladora frontend sénior', empresa: 'Tranvía Software', lugar: 'Madrid', inicio: '03/2022', fin: 'Actualidad', logros: ['Lideré la migración de la web de clientes a React 18 y Vite.', 'Reduje el tiempo de carga un 38 % con división de código y caché.', 'Mentora de 3 personas del equipo.'] },
    { puesto: 'Desarrolladora frontend', empresa: 'Estudio Lumen', lugar: 'Madrid', inicio: '09/2019', fin: '02/2022', logros: ['Construí el sistema de diseño en React usado por 4 productos.', 'Llevé la accesibilidad a nivel AA de las WCAG.'] },
  ],
  formacion: [{ titulo: 'Grado en Ingeniería Informática', centro: 'Universidad Politécnica de Madrid', inicio: '2014', fin: '2019' }],
  habilidades: ['React', 'TypeScript', 'Vite', 'Accesibilidad (WCAG)', 'Testing Library', 'CSS', 'Node.js', 'Figma'],
  idiomas: ['Español (nativo)', 'Inglés (C1)'],
  certificaciones: [],
  puestosObjetivo: ['Desarrolladora frontend sénior', 'Ingeniera frontend React', 'Frontend lead'],
  nivel: 'senior',
};

// Lo que trae la alerta diaria en el ejemplo.
const OFERTA_ALERTA_DEMO = {
  puesto: 'Ingeniera frontend (React + TypeScript)',
  empresa: 'Senda Rutas',
  ubicacion: 'Madrid',
  modalidad: 'híbrido',
  salario: '45.000–52.000 €',
  publicada: 'hoy',
  url: 'https://empleo.ejemplo.es/senda/frontend',
  fuente: 'LinkedIn',
  resumen: 'Planificador de rutas para repartidores. Equipo pequeño y producto propio.',
  requisitos: ['React', 'TypeScript', 'Accesibilidad'],
  encaje: 81,
  veredicto: 'encaje fuerte',
  puerta: 'pasa',
  dimensiones: { tecnica: 86, experiencia: 78, cultura: 74, carrera: 82 },
  motivos: ['React y TypeScript como en tus dos últimos puestos'],
  faltan: [],
};

// Una candidatura hecha por el servidor para una oferta de ejemplo.
const PREPARADA_DEMO = (oferta) => ({
  id: `pdemo-${oferta.id}`,
  oferta,
  cv: { ...PERFIL_DEMO, titular: `${oferta.puesto} · React y TypeScript` },
  carta: `Hola, equipo de ${oferta.empresa}:\n\nOs escribo por la oferta de ${oferta.puesto}. Llevo seis años con React y TypeScript y en Tranvía Software reduje un 38 % el tiempo de carga.\n\nUn saludo,\nElena Martín Rubio`,
  palabrasClave: ['React', 'TypeScript'],
  terminosOferta: oferta.requisitos ?? [],
  notas: ['Resumen adaptado a la oferta.'],
  encaje: oferta.encaje,
  idioma: 'es',
  empresa: '',
});

const OFERTAS_DEMO = [
  { puesto: 'Frontend Engineer sénior (React)', empresa: 'Brújula Labs', ubicacion: 'Madrid', modalidad: 'híbrido', salario: '48.000–55.000 €', publicada: 'hace 3 días', url: 'https://empleo.ejemplo.es/brujula/frontend-senior', fuente: 'ejemplo.es', resumen: 'Producto de rutas para logística. Equipo de 6 personas, React y TypeScript.', requisitos: ['5+ años con React', 'TypeScript', 'Testing'] },
  { puesto: 'Desarrollador/a frontend', empresa: 'Hoja Roja Digital', ubicacion: 'Remoto (España)', modalidad: 'remoto', salario: '40.000 €', publicada: 'hace 1 semana', url: 'https://empleo.ejemplo.es/hojaroja/frontend', fuente: 'ejemplo.es', resumen: 'Tienda online de libros. Vue y Nuxt, se valora React.', requisitos: ['Vue 3', 'Nuxt', 'SEO técnico'] },
  { puesto: 'Frontend Lead', empresa: 'Nube Clara', ubicacion: 'Madrid', modalidad: 'presencial', salario: '', publicada: 'hace 5 días', url: 'https://empleo.ejemplo.es/nubeclara/frontend-lead', fuente: 'ejemplo.es', resumen: 'Liderar un equipo de 5 en una plataforma de facturación.', requisitos: ['Liderazgo', 'React', 'Arquitectura frontend'] },
];

function respuestaEmpleoDemo(sistema, usuario) {
  if (/Analizas currículums/.test(sistema)) return PERFIL_DEMO;
  if (/buscador de empleo/.test(sistema)) {
    return { ofertas: [{ puesto: 'Desarrolladora web (React)', empresa: 'Estudio Faro', ubicacion: 'Madrid', modalidad: 'híbrido', publicada: 'hace 2 días', url: 'https://empleo.ejemplo.es/faro/react', fuente: 'web', resumen: 'Agencia de producto digital. React y Next.js.', requisitos: ['React', 'Next.js'] }] };
  }
  if (/Investiga en internet esta empresa/.test(sistema)) {
    return 'Brújula Labs (ejemplo) hace software de rutas para empresas de reparto: unas 60 personas en Madrid, producto propio en React y TypeScript, y acaban de abrir oficina en Lisboa.';
  }
  if (/Preparas entrevistas/.test(sistema)) {
    return {
      star: [
        { titulo: 'Migración a React 18', competencia: 'Liderazgo técnico', s: 'La web de clientes cargaba lenta y el código era difícil de mantener.', t: 'Liderar la migración sin parar las entregas.', a: 'Planifiqué la migración por partes, añadí división de código y caché, y acompañé al equipo.', r: 'La carga bajó un 38 % y el equipo entrega más rápido.', usarPara: ['Un reto técnico', 'Mejora de rendimiento'] },
        { titulo: 'Sistema de diseño', competencia: 'Colaboración', s: 'Cuatro productos con estilos distintos.', t: 'Unificar la interfaz.', a: 'Construí un sistema de diseño en React junto al equipo de diseño.', r: 'Lo usan los 4 productos y cumple WCAG AA.', usarPara: ['Trabajo en equipo'] },
      ],
      dificiles: [{ pregunta: 'No tienes experiencia con tests de extremo a extremo, ¿verdad?', respuesta: 'Uso Testing Library a diario; los E2E los he visto en revisión y es lo siguiente que quiero dominar: ya he empezado con Playwright.' }],
      paraPreguntar: ['¿Qué parte del producto de rutas os preocupa más ahora mismo?', '¿Cómo repartís el trabajo entre producto nuevo y mantenimiento?'],
      porQueEmpresa: 'Producto propio de rutas: el rendimiento en móvil importa de verdad, y es justo donde más he trabajado.',
    };
  }
  if (/técnico de selección/.test(sistema)) {
    const ids = [...usuario.matchAll(/<oferta id="([^"]+)"/g)].map((m) => m[1]);
    const notas = [
      ['pasa', '', [90, 85, 75, 85], ['6 años con React y TypeScript', 'Experiencia en rendimiento web'], ['Testing de extremo a extremo']],
      ['aviso', 'Se valora inglés fluido para reuniones con clientes', [55, 60, 65, 50], ['Frontend con experiencia', 'Remoto en España'], ['Piden Vue y Nuxt', 'SEO técnico']],
      ['pasa', '', [80, 65, 70, 80], ['Mentora en su equipo actual', 'React avanzado'], ['Liderazgo formal de un equipo']],
      ['pasa', '', [70, 70, 60, 55], ['React'], ['Next.js']],
    ];
    return {
      evaluaciones: ids.map((id, i) => {
        const [puerta, notaPuerta, [tecnica, experiencia, cultura, carrera], motivos, faltan] = notas[i % notas.length];
        return { id, puerta, notaPuerta, tecnica, experiencia, cultura, carrera, motivos, faltan };
      }),
    };
  }
  if (/Extrae los datos de la oferta/.test(sistema)) {
    return { ...OFERTAS_DEMO[0], descripcion: 'Buscamos una persona frontend sénior para nuestro producto de rutas. Funciones: desarrollar con React y TypeScript, cuidar el rendimiento y la accesibilidad, revisar código. Requisitos: 5+ años con React, TypeScript, testing. Se valora: experiencia en sistemas de diseño.' };
  }
  if (/revisor exigente/.test(sistema)) {
    const propuesta = JSON.parse(usuario.match(/<propuesta>\n([\s\S]*)\n<\/propuesta>/)[1]);
    return { ...propuesta, notas: ['Resumen más concreto para la oferta.', 'Quitada una cifra que no estaba en tu CV.', 'La carta menciona su producto de rutas y la nueva oficina de Lisboa.'], encaje: 87, terminosOferta: ['React', 'TypeScript', 'Testing', 'rendimiento', 'accesibilidad', 'Playwright'] };
  }
  if (/experto en selección/.test(sistema)) {
    return {
      cv: { ...PERFIL_DEMO, titular: 'Frontend Engineer sénior · React y TypeScript', resumen: 'Ingeniera frontend con 6 años construyendo productos en React y TypeScript, con foco en rendimiento (−38 % en tiempo de carga), accesibilidad AA y sistemas de diseño.' },
      carta: 'Hola, equipo de Brújula Labs:\n\nOs escribo por la oferta de Frontend Engineer sénior. Llevo seis años construyendo productos con React y TypeScript; en Tranvía Software lideré la migración a React 18 y reduje un 38 % el tiempo de carga.\n\nMe atrae vuestro producto de rutas porque el rendimiento en móvil es clave para quien lo usa en la calle, y es justo donde más he trabajado.\n\nMe encantaría contaros más en una entrevista.\n\nUn saludo,\nElena Martín Rubio',
      palabrasClave: ['React', 'TypeScript', 'Testing', 'rendimiento'],
      idioma: 'es',
    };
  }
  return {};
}
