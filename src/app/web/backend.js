import { normalizarAjustes, aplicarCambios } from '../../compartido/ajustes.js';
import { ClienteGmail } from '../../compartido/gmail.js';
import { Recordatorios } from '../../compartido/recordatorios.js';
import { Memoria } from '../../compartido/memoria.js';
import { ClienteCalendario, PERMISO_CALENDARIO } from '../../compartido/calendario.js';
import { Conversaciones, nuevoIdConversacion } from '../../compartido/conversaciones.js';
import { leerSecreto, guardarSecreto, borrarSecreto } from './secretos.js';

// Versión web (PWA): el mismo contrato que window.asistente en Electron,
// pero todo ocurre en el navegador. Claude se llama directamente desde aquí
// con la clave del propio usuario, y Gmail con Google Identity Services.

const CLAVE_AJUSTES = 'kitsune.ajustes';
const CLAVE_EMAIL = 'kitsune.correo.email';
const CLAVE_RECORDATORIOS = 'kitsune.recordatorios';
const CLAVE_ALCANCES = 'kitsune.google.alcances';
const PERMISOS = `https://www.googleapis.com/auth/gmail.modify ${PERMISO_CALENDARIO}`;
const OPCIONES_CLAUDE = { dangerouslyAllowBrowser: true };

function leerLocal(clave) {
  try {
    return JSON.parse(localStorage.getItem(clave));
  } catch {
    return null;
  }
}

function guardarLocal(clave, valor) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, JSON.stringify(valor));
  } catch {
    // Almacenamiento bloqueado: los cambios duran hasta que se cierre la app.
  }
}

let promesaGoogle = null;
function cargarGoogle() {
  promesaGoogle ??= new Promise((resolver, rechazar) => {
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => resolver(window.google.accounts.oauth2);
    script.onerror = () => {
      promesaGoogle = null;
      rechazar(new Error('No se pudo cargar el inicio de sesión de Google. Revisa la conexión.'));
    };
    document.head.append(script);
  });
  return promesaGoogle;
}

function errorReconectar() {
  const error = new Error('La sesión de Gmail ha caducado. Toca "Reconectar" para seguir.');
  error.reconectar = true;
  return error;
}

export function crearBackendWeb() {
  let ajustes = normalizarAjustes(leerLocal(CLAVE_AJUSTES) ?? {});
  const oyentes = { claude: [], nuevo: [], recordatorio: [], cita: [] };
  const emitir = (lista, dato) => oyentes[lista].forEach((f) => f(dato));
  const escuchar = (lista, f) => {
    oyentes[lista].push(f);
    return () => (oyentes[lista] = oyentes[lista].filter((x) => x !== f));
  };

  // ---------- Gmail ----------

  let token = null;
  async function tokenGuardado() {
    if (token && Date.now() < token.caduca) return token;
    const guardado = JSON.parse((await leerSecreto('googleToken')) ?? 'null');
    token = guardado && Date.now() < guardado.caduca ? guardado : null;
    return token;
  }

  const credenciales = {
    token: async () => {
      const vigente = await tokenGuardado();
      if (!vigente) throw errorReconectar();
      return vigente.acceso;
    },
    invalidar: () => {
      token = null;
      borrarSecreto('googleToken');
    },
  };
  const gmail = new ClienteGmail(credenciales);
  const calendario = new ClienteCalendario(credenciales);

  async function estadoCorreo() {
    const email = leerLocal(CLAVE_EMAIL);
    const vigente = email ? await tokenGuardado() : null;
    return {
      conectado: Boolean(email),
      email,
      configurado: Boolean(ajustes.googleClientId),
      necesitaReconectar: Boolean(email && !vigente),
      // Quien conectó antes de que Kitsune usara el calendario tiene que volver a conectar.
      calendario: Boolean(email && (leerLocal(CLAVE_ALCANCES) ?? '').includes(PERMISO_CALENDARIO)),
    };
  }

  // Debe llamarse desde un toque o clic: Google abre una ventana emergente.
  async function conectar() {
    if (!ajustes.googleClientId) throw new Error('Falta el ID de cliente de Google en Ajustes.');
    const oauth2 = await cargarGoogle();
    const yaConsintio = Boolean(leerLocal(CLAVE_EMAIL));
    const respuesta = await new Promise((resolver, rechazar) => {
      const cliente = oauth2.initTokenClient({
        client_id: ajustes.googleClientId,
        scope: PERMISOS,
        callback: (r) => (r.error ? rechazar(new Error(r.error_description || r.error)) : resolver(r)),
        error_callback: (e) =>
          rechazar(new Error(e.type === 'popup_closed' ? 'Se cerró la ventana de Google antes de terminar.' : 'No se pudo abrir el inicio de sesión de Google.')),
      });
      cliente.requestAccessToken({ prompt: yaConsintio ? '' : 'consent' });
    });
    token = { acceso: respuesta.access_token, caduca: Date.now() + (Number(respuesta.expires_in) - 60) * 1000 };
    await guardarSecreto('googleToken', JSON.stringify(token));
    guardarLocal(CLAVE_ALCANCES, respuesta.scope ?? '');
    const perfil = await gmail.perfil();
    guardarLocal(CLAVE_EMAIL, perfil.emailAddress);
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    programarCorreo();
    programarCitas();
    return estadoCorreo();
  }

  async function desconectar() {
    const vigente = await tokenGuardado();
    if (vigente) cargarGoogle().then((o) => o.revoke(vigente.acceso, () => {})).catch(() => {});
    token = null;
    await borrarSecreto('googleToken');
    guardarLocal(CLAVE_EMAIL, null);
    guardarLocal(CLAVE_ALCANCES, null);
    gmail.olvidarVistos();
    return estadoCorreo();
  }

  // Correo nuevo mientras la app está abierta. Sin servidor propio no hay
  // forma fiable de despertar a la app cerrada en el móvil.
  let temporizador = null;
  function programarCorreo() {
    clearInterval(temporizador);
    temporizador = setInterval(comprobarCorreo, ajustes.correoCadaMin * 60 * 1000);
    comprobarCorreo();
  }

  async function comprobarCorreo() {
    if (!leerLocal(CLAVE_EMAIL) || !(await tokenGuardado())) return;
    try {
      const nuevos = await gmail.nuevos();
      if (!nuevos.length) return;
      emitir('nuevo', { cantidad: nuevos.length, ultimo: nuevos[0] });
      if (ajustes.avisarCorreo && document.visibilityState !== 'visible' && 'Notification' in window && Notification.permission === 'granted') {
        const registro = await navigator.serviceWorker?.getRegistration();
        const [primero] = nuevos;
        const titulo = nuevos.length === 1 ? `Correo de ${primero.de.nombre}` : `${nuevos.length} correos nuevos`;
        if (registro) registro.showNotification(titulo, { body: primero.asunto, icon: 'iconos/icono-192.png', tag: 'kitsune-correo' });
      }
    } catch {
      // Sin conexión o sesión caducada: se reintenta en la siguiente comprobación.
    }
  }

  // Aviso unos minutos antes de cada cita, mientras la app está abierta.
  let temporizadorCitas = null;
  function programarCitas() {
    clearInterval(temporizadorCitas);
    temporizadorCitas = setInterval(comprobarCitas, 5 * 60 * 1000);
    comprobarCitas();
  }

  async function comprobarCitas() {
    const estado = await estadoCorreo();
    if (!estado.calendario || estado.necesitaReconectar || !ajustes.avisarCitas) return;
    try {
      for (const cita of await calendario.proximas(15)) {
        emitir('cita', cita);
        const hora = new Date(cita.inicio).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
        notificar(`A las ${hora}: ${cita.titulo}`, cita.lugar || 'Dentro de poco', `kitsune-cita-${cita.id}`);
      }
    } catch {
      // Sin conexión o sesión caducada: se reintenta en la siguiente comprobación.
    }
  }

  // ---------- Memoria ----------

  // Lo que el usuario pide recordar es personal: va cifrado, como las claves.
  const memoria = new Memoria({
    leer: async () => {
      try {
        return JSON.parse((await leerSecreto('memoria')) ?? '[]');
      } catch {
        return [];
      }
    },
    guardar: (lista) => guardarSecreto('memoria', JSON.stringify(lista)),
  });

  // ---------- Recordatorios ----------

  async function notificar(titulo, cuerpo, etiqueta) {
    if (document.visibilityState === 'visible' || !('Notification' in window) || Notification.permission !== 'granted') return;
    const registro = await navigator.serviceWorker?.getRegistration();
    registro?.showNotification(titulo, { body: cuerpo, icon: 'iconos/icono-192.png', tag: etiqueta });
  }

  // Sin servidor propio solo suenan con la app abierta (o en segundo plano
  // reciente); los vencidos con la app cerrada se avisan al abrirla.
  const recordatorios = new Recordatorios({
    leer: () => leerLocal(CLAVE_RECORDATORIOS) ?? [],
    guardar: (lista) => guardarLocal(CLAVE_RECORDATORIOS, lista),
    avisar: (r) => {
      emitir('recordatorio', r);
      notificar('Kitsune te recuerda', r.texto, `kitsune-${r.id}`);
    },
  });
  recordatorios.programar();

  // ---------- Claude ----------

  // Historial de conversaciones, cifrado: incluye lo que Claude leyó del correo.
  const leerJsonSecreto = async (nombre) => {
    try {
      return JSON.parse((await leerSecreto(nombre)) ?? 'null');
    } catch {
      return null;
    }
  };
  const conversaciones = new Conversaciones({
    leerIndice: async () => (await leerJsonSecreto('conversaciones')) ?? [],
    guardarIndice: (lista) => guardarSecreto('conversaciones', JSON.stringify(lista)),
    leer: (id) => leerJsonSecreto(`conv:${id}`),
    guardar: (id, datos) => guardarSecreto(`conv:${id}`, JSON.stringify(datos)),
    borrar: (id) => borrarSecreto(`conv:${id}`),
  });

  // Las versiones anteriores guardaban una sola conversación: pasa al historial.
  const migrada = (async () => {
    const antigua = await leerJsonSecreto('conversacion');
    if (antigua?.historial) await conversaciones.guardar(nuevoIdConversacion(), antigua.historial).catch(() => {});
    if (antigua) await borrarSecreto('conversacion');
  })();

  let conversacion = null;
  // Id y mensajes de la conversación en curso antes de cargar el SDK (al abrir la app).
  let pendiente = null;
  async function conversacionInicial() {
    await migrada;
    pendiente ??= (async () => {
      const ultima = await conversaciones.reciente();
      const datos = ultima && (await conversaciones.cargar(ultima.id));
      return datos ? { id: ultima.id, ...datos } : { id: nuevoIdConversacion(), historial: [], visibles: [] };
    })();
    return pendiente;
  }

  async function obtenerConversacion() {
    if (!conversacion) {
      // El SDK se carga solo cuando hace falta: la app abre antes.
      const { ConversacionClaude } = await import('../../compartido/claude.js');
      const inicial = await conversacionInicial();
      conversacion = new ConversacionClaude({
        recordatorios,
        memoria,
        calendario: {
          estado: async () => {
            const e = await estadoCorreo();
            return { conectado: e.calendario && !e.necesitaReconectar };
          },
          eventos: (opciones) => calendario.eventos(opciones),
          crear: (evento) => calendario.crear(evento),
        },
        alCambiarHistorial: (historial, id) => conversaciones.guardar(id, historial).catch(() => {}),
        obtenerClave: () => leerSecreto('claveClaude'),
        obtenerAjustes: () => ajustes,
        // Las herramientas de correo solo se ofrecen con una sesión de Gmail vigente.
        gmail: {
          estado: async () => {
            const e = await estadoCorreo();
            return { conectado: e.conectado && !e.necesitaReconectar, email: e.email };
          },
          listar: (o) => gmail.listar(o),
          leer: (id) => gmail.leer(id),
        },
        emitir: (evento) => emitir('claude', evento),
        opcionesCliente: OPCIONES_CLAUDE,
      });
      if (inicial.historial.length) conversacion.restaurar(inicial.historial, inicial.id);
      else conversacion.id = inicial.id;
    }
    return conversacion;
  }

  if (leerLocal(CLAVE_EMAIL)) {
    programarCorreo();
    programarCitas();
  }

  const api = {
    plataforma: 'web',
    ajustes: {
      obtener: async () => ({ ...ajustes }),
      async guardar(cambios) {
        ajustes = aplicarCambios(ajustes, cambios);
        guardarLocal(CLAVE_AJUSTES, ajustes);
        if ('correoCadaMin' in cambios && leerLocal(CLAVE_EMAIL)) programarCorreo();
        if (cambios.avisarCorreo && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
        return { ...ajustes };
      },
    },
    claude: {
      estado: async () => ({ configurado: Boolean(await leerSecreto('claveClaude')) }),
      async guardarClave(clave) {
        if (!clave) {
          await borrarSecreto('claveClaude');
          return { configurado: false };
        }
        const { ConversacionClaude, mensajeDeError } = await import('../../compartido/claude.js');
        try {
          await ConversacionClaude.probarClave(clave.trim(), ajustes.modelo, OPCIONES_CLAUDE);
        } catch (error) {
          throw new Error(mensajeDeError(error));
        }
        await guardarSecreto('claveClaude', clave.trim());
        return { configurado: true };
      },
      enviar: async (texto) => (await obtenerConversacion()).enviar(String(texto).trim().slice(0, 20000)),
      cancelar: async () => conversacion?.cancelar(),
      confirmar: async (id, acepta) => conversacion?.responderConfirmacion(id, acepta),
      // Nueva conversación: la anterior queda en el historial.
      async reiniciar() {
        if (conversacion) conversacion.reiniciar();
        else pendiente = Promise.resolve({ id: nuevoIdConversacion(), historial: [], visibles: [] });
      },
      // Sin cargar el SDK: lo guardado ya trae lo que se ve en el chat.
      mensajes: async () => (conversacion ? conversacion.mensajesVisibles() : (await conversacionInicial()).visibles),
      redactarRespuesta: async (id, indicaciones) => (await obtenerConversacion()).redactarRespuesta(await gmail.leer(id), indicaciones ?? ''),
      alEvento: (f) => escuchar('claude', f),
    },
    correo: {
      estado: estadoCorreo,
      guardarSecretoCliente: async () => {},
      conectar,
      desconectar,
      listar: (opciones) => gmail.listar(opciones),
      leer: (id) => gmail.leer(id),
      modificar: (id, cambios) => gmail.modificar(id, cambios),
      enviar: (datos) => gmail.enviar(datos),
      alNuevo: (f) => escuchar('nuevo', f),
    },
    conversaciones: {
      listar: async () => ({ lista: await conversaciones.listar(), actual: conversacion?.id ?? (await conversacionInicial()).id }),
      async abrir(id) {
        const datos = await conversaciones.cargar(id);
        if (!datos) throw new Error('No se ha podido abrir esa conversación.');
        const c = await obtenerConversacion();
        if (c.controlador) throw new Error('Espera a que termine la respuesta.');
        c.restaurar(datos.historial, id);
        return c.mensajesVisibles();
      },
      async borrar(id) {
        const actual = conversacion?.id ?? (await conversacionInicial()).id;
        if (id === actual) await api.claude.reiniciar();
        return conversaciones.borrar(id);
      },
      async borrarTodo() {
        await api.claude.reiniciar();
        await conversaciones.borrarTodo();
      },
    },
    memoria: {
      recordar: (texto) => memoria.recordar(texto),
      listar: () => memoria.listar(),
      olvidar: (id) => memoria.olvidar(id),
      olvidarTodo: () => memoria.olvidarTodo(),
    },
    calendario: {
      estado: async () => {
        const e = await estadoCorreo();
        return { conectado: e.conectado, calendario: e.calendario, necesitaReconectar: e.necesitaReconectar };
      },
      eventos: (desde, hasta) => calendario.eventos({ desde, hasta, maximo: 50 }),
      crear: (evento) => calendario.crear(evento),
      borrar: (id) => calendario.borrar(id),
      alCita: (f) => escuchar('cita', f),
    },
    recordatorios: {
      crear: (datos) => recordatorios.crear(datos),
      listar: () => recordatorios.listar(),
      borrar: (id) => recordatorios.borrar(id),
      alAviso: (f) => escuchar('recordatorio', f),
    },
    ventana: {
      alAlternar: () => () => {},
      alAbrirAjustes: () => () => {},
      // En el móvil el texto llega con "Compartir"; no hay portapapeles que mirar.
      alTexto: () => () => {},
      ocultar: () => {},
      ratonDentro: () => {},
      abrirEnlace: async (url) => {
        if (/^https?:|^mailto:/i.test(url)) window.open(url, '_blank', 'noopener');
      },
    },
  };
  return api;
}
