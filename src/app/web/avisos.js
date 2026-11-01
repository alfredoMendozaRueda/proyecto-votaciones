// Avisos con la app cerrada (versión web): vincular este navegador con el
// servidor de Kitsune, activar las notificaciones push, mandar los
// recordatorios y gestionar las automatizaciones.
import { ClienteServidor, URL_VALIDA, paqueteRecordatorios } from '../../compartido/servidor.js';
import { URL_SERVIDOR } from '../../compartido/nube.js';

const CLAVE_PUSH = 'kitsune.push';
const ESPERA_VINCULO = 15 * 60 * 1000;

const esIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const instalada = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const zona = () => Intl.DateTimeFormat().resolvedOptions().timeZone;

function nombreDispositivo() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/Android/.test(ua)) return 'Android';
  if (/Mac/.test(ua)) return 'Mac';
  if (/Windows/.test(ua)) return 'Navegador de Windows';
  return 'Navegador';
}

function aleatorio() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function deBase64Url(texto) {
  const normal = texto.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normal + '='.repeat((4 - (normal.length % 4)) % 4)), (c) => c.charCodeAt(0));
}

const leerPush = () => {
  try {
    return localStorage.getItem(CLAVE_PUSH) === '1';
  } catch {
    return false;
  }
};
const guardarPush = (activo) => {
  try {
    if (activo) localStorage.setItem(CLAVE_PUSH, '1');
    else localStorage.removeItem(CLAVE_PUSH);
  } catch {
    // Sin almacenamiento: se vuelve a preguntar al servidor la próxima vez.
  }
};

export function crearAvisos({ leerSecreto, guardarSecreto, borrarSecreto, obtenerAjustes, leerRecordatorios }) {
  const url = () => (URL_VALIDA.test(obtenerAjustes().servidorUrl) ? obtenerAjustes().servidorUrl : URL_SERVIDOR);
  let token;
  const cargarToken = async () => (token === undefined ? (token = await leerSecreto('servidorToken')) : token);

  async function olvidar() {
    token = null;
    guardarPush(false);
    await borrarSecreto('servidorToken');
  }

  // Ejecuta algo contra el servidor; si dice que el dispositivo ya no vale, se olvida.
  async function usar(funcion) {
    if (!url()) throw new Error('El servidor de avisos no está configurado.');
    if (!(await cargarToken())) throw new Error('Conecta primero los avisos en Ajustes.');
    try {
      return await funcion(new ClienteServidor({ url: url(), token }));
    } catch (error) {
      if (error.desvinculado) await olvidar();
      throw error;
    }
  }

  async function guardarToken(nuevo) {
    token = nuevo;
    await guardarSecreto('servidorToken', nuevo);
    sincronizar();
    usar((c) => c.zona(zona())).catch(() => {});
  }

  // Los recordatorios que este dispositivo ya ha mandado al servidor.
  const CLAVE_ENVIADOS = 'kitsune.recordatorios.enviados';
  const leerEnviados = () => {
    try {
      return JSON.parse(localStorage.getItem(CLAVE_ENVIADOS)) ?? [];
    } catch {
      return [];
    }
  };
  const guardarEnviados = (ids) => {
    try {
      localStorage.setItem(CLAVE_ENVIADOS, JSON.stringify(ids));
    } catch {
      // Sin almacenamiento, el servidor solo recibe altas.
    }
  };

  let temporizador = null;
  function sincronizar() {
    clearTimeout(temporizador);
    temporizador = setTimeout(async () => {
      if (!url() || !(await cargarToken())) return;
      const { lista, borrados } = paqueteRecordatorios(leerRecordatorios(), leerEnviados());
      usar((c) => c.recordatorios(lista, borrados))
        .then(() => guardarEnviados(lista.map((r) => r.id)))
        .catch(() => {});
    }, 400);
  }

  async function suscripcionActual() {
    if (!('serviceWorker' in navigator)) return null;
    const registro = await navigator.serviceWorker.getRegistration();
    return registro?.pushManager?.getSubscription() ?? null;
  }

  const servidor = {
    async estado() {
      const base = {
        configurado: Boolean(url()),
        url: url(),
        integrado: Boolean(URL_SERVIDOR),
        soportaPush: 'PushManager' in window && 'serviceWorker' in navigator,
        instalada: instalada(),
        ios: esIOS(),
        puedeVincularConGoogle: true,
      };
      if (!base.configurado || !(await cargarToken())) return { ...base, vinculado: false };
      try {
        const e = await usar((c) => c.estado());
        const suscrita = Boolean(await suscripcionActual().catch(() => null));
        const pushAqui = suscrita && Boolean(e.dispositivos.find((d) => d.yo)?.push);
        guardarPush(pushAqui);
        return { ...base, vinculado: true, ...e, pushAqui };
      } catch (error) {
        return error.desvinculado ? { ...base, vinculado: false } : { ...base, vinculado: true, error: error.message };
      }
    },

    // Debe llamarse desde un toque: abre la página de Google sin esperas
    // (si no, Safari bloquea la ventana) y espera a que el servidor dé el token.
    conectar() {
      if (!url()) return Promise.reject(new Error('El servidor de avisos no está configurado.'));
      const estado = aleatorio();
      const cliente = new ClienteServidor({ url: url() });
      window.open(cliente.urlEntrar({ estado, nombre: nombreDispositivo(), zona: zona() }), '_blank');
      return new Promise((resolver, rechazar) => {
        const limite = Date.now() + ESPERA_VINCULO;
        let espera = null;
        const preguntar = async () => {
          clearTimeout(espera);
          try {
            const r = await cliente.recoger(estado);
            if (r.token) {
              document.removeEventListener('visibilitychange', alVolver);
              await guardarToken(r.token);
              return resolver(await servidor.estado());
            }
            if (r.error) throw new Error(r.error);
          } catch (error) {
            if (!/conexión/.test(error.message) || Date.now() > limite) {
              document.removeEventListener('visibilitychange', alVolver);
              return rechazar(error);
            }
          }
          if (Date.now() > limite) {
            document.removeEventListener('visibilitychange', alVolver);
            return rechazar(new Error('No ha llegado la confirmación de Google. Vuelve a intentarlo.'));
          }
          espera = setTimeout(preguntar, 2500);
        };
        // Al volver de Safari a la app se pregunta en el acto.
        const alVolver = () => document.visibilityState === 'visible' && preguntar();
        document.addEventListener('visibilitychange', alVolver);
        espera = setTimeout(preguntar, 2500);
      });
    },

    async canjear(codigo) {
      if (!url()) throw new Error('El servidor de avisos no está configurado.');
      const r = await new ClienteServidor({ url: url() }).canjear(String(codigo ?? '').trim(), nombreDispositivo());
      await guardarToken(r.token);
      return servidor.estado();
    },

    // Debe llamarse desde un toque: el permiso se pide antes de cualquier espera.
    async activarPush() {
      if (!('Notification' in window) || !('PushManager' in window) || !('serviceWorker' in navigator)) {
        throw new Error(
          esIOS() && !instalada()
            ? 'En el iPhone, primero instala Kitsune: en Safari, Compartir → «Añadir a pantalla de inicio», y ábrelo desde ese icono.'
            : 'Este navegador no admite notificaciones push.',
        );
      }
      const permiso = await Notification.requestPermission();
      if (permiso !== 'granted') {
        throw new Error(
          esIOS() ? 'Sin permiso. Actívalo en Ajustes del iPhone → Notificaciones → Kitsune.' : 'Sin permiso para notificaciones: actívalo en los ajustes del navegador.',
        );
      }
      const registro = await navigator.serviceWorker.ready;
      const { vapid } = await usar((c) => c.estado());
      const clave = deBase64Url(vapid);
      let suscripcion = await registro.pushManager.getSubscription();
      const actual = suscripcion?.options?.applicationServerKey;
      if (suscripcion && actual && new Uint8Array(actual).join() !== clave.join()) {
        await suscripcion.unsubscribe();
        suscripcion = null;
      }
      suscripcion ??= await registro.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: clave });
      await usar((c) => c.suscripcion(suscripcion.toJSON()));
      guardarPush(true);
      return servidor.estado();
    },

    async desactivarPush() {
      const suscripcion = await suscripcionActual().catch(() => null);
      await suscripcion?.unsubscribe().catch(() => {});
      await usar((c) => c.suscripcion(null)).catch(() => {});
      guardarPush(false);
      return servidor.estado();
    },

    probar: () => usar((c) => c.probar()),
    resumen: () => usar((c) => c.resumen()),
    crearCodigo: () => usar((c) => c.crearCodigo()),
    avisos: (avisos) => usar((c) => c.avisos(avisos)),
    async groq(activar) {
      if (!activar) return usar((c) => c.groq(null));
      const clave = await leerSecreto('claveGroq');
      if (!clave) throw new Error('Añade primero tu clave de Groq en Ajustes → Inteligencia artificial.');
      return usar((c) => c.groq(clave));
    },
    async openai(activar) {
      if (!activar) return usar((c) => c.openai(null));
      const clave = await leerSecreto('claveOpenAI');
      if (!clave) throw new Error('Añade primero tu clave de OpenAI en Ajustes → Inteligencia artificial.');
      return usar((c) => c.openai(clave));
    },
    automatizaciones: {
      listar: () => usar((c) => c.automatizaciones()),
      crear: (datos) => usar((c) => c.crearAutomatizacion(datos)),
      actualizar: (id, datos) => usar((c) => c.actualizarAutomatizacion(id, datos)),
      borrar: (id) => usar((c) => c.borrarAutomatizacion(id)),
    },
    registro: () => usar((c) => c.registro()),
    empleo: {
      buscar: (datos) => usar((c) => c.empleoBuscar(datos)),
      detalle: (url) => usar((c) => c.empleoDetalle(url)),
      alerta: () => usar((c) => c.empleoAlerta()),
      guardarAlerta: (datos) => usar((c) => c.guardarEmpleoAlerta(datos)),
      probarAlerta: () => usar((c) => c.probarEmpleoAlerta()),
    },
    transcribir: (audio, tipo) => usar((c) => c.transcribir(audio, tipo)),
    // Voz natural: MP3 de un trozo de texto.
    voz: (texto, voz) => usar((c) => c.voz(texto, voz)),
    quitarDispositivo: (id) => usar((c) => c.quitarDispositivo(id)),
    async desvincular() {
      const suscripcion = await suscripcionActual().catch(() => null);
      await suscripcion?.unsubscribe().catch(() => {});
      await usar((c) => c.desvincular()).catch(() => {});
      await olvidar();
      return servidor.estado();
    },
  };

  if (url()) cargarToken().then((t) => t && sincronizar());

  return {
    servidor,
    sincronizar,
    // Cliente con el token de este dispositivo (sincronización entre dispositivos).
    async cliente() {
      if (!url()) throw new Error('El servidor de avisos no está configurado.');
      if (!(await cargarToken())) throw new Error('Conecta primero los avisos en Ajustes.');
      return new ClienteServidor({ url: url(), token });
    },
    vinculado: async () => Boolean(url() && (await cargarToken())),
    // Con el push activo, los avisos los da el servidor: la app no los repite.
    pushActivo: leerPush,
    // Para el chat: solo con el servidor vinculado.
    automatizaciones: {
      disponible: async () => Boolean(url() && (await cargarToken())),
      listar: servidor.automatizaciones.listar,
      crear: servidor.automatizaciones.crear,
    },
  };
}
