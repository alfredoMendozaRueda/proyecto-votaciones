import { normalizarAjustes, aplicarCambios } from '../../compartido/ajustes.js';
import { ClienteGmail } from '../../compartido/gmail.js';
import { leerSecreto, guardarSecreto, borrarSecreto } from './secretos.js';

// Versión web (PWA): el mismo contrato que window.asistente en Electron,
// pero todo ocurre en el navegador. Claude se llama directamente desde aquí
// con la clave del propio usuario, y Gmail con Google Identity Services.

const CLAVE_AJUSTES = 'kitsune.ajustes';
const CLAVE_EMAIL = 'kitsune.correo.email';
const PERMISOS = 'https://www.googleapis.com/auth/gmail.modify';
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
  const oyentes = { claude: [], nuevo: [] };
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

  const gmail = new ClienteGmail({
    token: async () => {
      const vigente = await tokenGuardado();
      if (!vigente) throw errorReconectar();
      return vigente.acceso;
    },
    invalidar: () => {
      token = null;
      borrarSecreto('googleToken');
    },
  });

  async function estadoCorreo() {
    const email = leerLocal(CLAVE_EMAIL);
    const vigente = email ? await tokenGuardado() : null;
    return { conectado: Boolean(email), email, configurado: Boolean(ajustes.googleClientId), necesitaReconectar: Boolean(email && !vigente) };
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
    const perfil = await gmail.perfil();
    guardarLocal(CLAVE_EMAIL, perfil.emailAddress);
    if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    programarCorreo();
    return estadoCorreo();
  }

  async function desconectar() {
    const vigente = await tokenGuardado();
    if (vigente) cargarGoogle().then((o) => o.revoke(vigente.acceso, () => {})).catch(() => {});
    token = null;
    await borrarSecreto('googleToken');
    guardarLocal(CLAVE_EMAIL, null);
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

  // ---------- Claude ----------

  let conversacion = null;
  async function obtenerConversacion() {
    if (!conversacion) {
      // El SDK se carga solo cuando hace falta: la app abre antes.
      const { ConversacionClaude } = await import('../../compartido/claude.js');
      conversacion = new ConversacionClaude({
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
    }
    return conversacion;
  }

  if (leerLocal(CLAVE_EMAIL)) programarCorreo();

  return {
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
      reiniciar: async () => conversacion?.reiniciar(),
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
    ventana: {
      alAlternar: () => () => {},
      alAbrirAjustes: () => () => {},
      ocultar: () => {},
      ratonDentro: () => {},
      abrirEnlace: async (url) => {
        if (/^https?:|^mailto:/i.test(url)) window.open(url, '_blank', 'noopener');
      },
    },
  };
}
