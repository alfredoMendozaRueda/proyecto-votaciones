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

function respuestaPara(texto) {
  const t = texto.toLowerCase();
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
  const oyentes = { claude: [], nuevo: [], alternar: [], ajustes: [] };
  let ajustes = {
    atajo: 'Control+Alt+K',
    paleta: 'carmesi',
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
  };
  let cancelado = false;

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
      reiniciar: async () => {},
      alEvento: (f) => escuchar('claude', f),
      async enviar(texto) {
        cancelado = false;
        const { herramienta, texto: respuesta } = respuestaPara(texto);
        emitir({ tipo: 'pensando' });
        await espera(700);
        if (herramienta) {
          emitir({ tipo: 'herramienta', nombre: herramienta });
          await espera(1100);
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
        emitir({ tipo: 'fin' });
      },
      async redactarRespuesta(id) {
        await espera(1200);
        const correo = correos.find((c) => c.id === id);
        return `Hola, ${correo.de.nombre.split(' ')[0]}:\n\nGracias por tu mensaje. Me parece bien; lo confirmo para el lunes.\n\nUn saludo.`;
      },
    },
    correo: {
      estado: async () => ({ conectado: true, email: 'tu.cuenta@gmail.com', configurado: true }),
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
    ventana: {
      alAlternar: (f) => escuchar('alternar', f),
      alAbrirAjustes: (f) => escuchar('ajustes', f),
      ocultar: () => {},
      ratonDentro: () => {},
      abrirEnlace: async (url) => window.open(url, '_blank', 'noopener'),
    },
    // Controles solo del modo de ejemplo (atajo simulado y correo entrante).
    simular: {
      alternar: (accion) => oyentes.alternar.forEach((f) => f(accion)),
      abrirAjustes: () => oyentes.ajustes.forEach((f) => f()),
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
