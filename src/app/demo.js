// Modo de ejemplo: misma interfaz que window.asistente (el puente de Electron),
// con correos y respuestas inventados. Se usa al abrir la app en un navegador.

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
    estilo: 'realista',
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
    googleClientId: '123456789-kitsune.apps.googleusercontent.com',
    pulsoDiario: true,
    proveedor: 'groq',
    modeloGroq: 'openai/gpt-oss-120b',
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
      estado: async () => ({ configurado: true }),
      guardarClave: async () => ({ configurado: true }),
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
              emitir({ tipo: 'confirmar', id, accion: { tipo: 'evento', ...evento } });
            });
            confirmaciones.delete(id);
            if (acepta) {
              eventos.push({ id: `ev${Date.now()}`, ...evento });
              emitir({ tipo: 'evento', evento: { id: 'edemo', ...evento } });
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
      async enviar() {
        await espera(600);
        return {};
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
