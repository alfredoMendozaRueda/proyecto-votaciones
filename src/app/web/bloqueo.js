// Bloqueo con Face ID (solo la app web/iPhone). Usa una llave de acceso
// (WebAuthn, autenticador del propio dispositivo): al abrir Kitsune, o al
// volver tras un rato, hay que pasar Face ID (o el código del iPhone).
//
// Es una pantalla de privacidad para quien coja el móvil desbloqueado: los
// datos ya van cifrados en el dispositivo, y esto evita que se vean tu correo,
// tu agenda o tus candidaturas sin tu cara. Si un día no puedes desbloquear,
// la salida de emergencia borra los datos de Kitsune de este dispositivo.

const CLAVE = 'kitsune.bloqueo';
export const OPCIONES_TRAS = [
  [0, 'Al instante'],
  [1, 'Tras 1 minuto'],
  [5, 'Tras 5 minutos'],
  [15, 'Tras 15 minutos'],
];

const aBase64Url = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deBase64Url = (texto) => {
  const normal = texto.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(normal + '='.repeat((4 - (normal.length % 4)) % 4)), (c) => c.charCodeAt(0));
};
const esIOS = () => /iP(hone|ad|od)/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const nombreBiometria = () => (esIOS() ? 'Face ID' : 'tu huella o tu cara');

export function leerBloqueo() {
  try {
    const b = JSON.parse(localStorage.getItem(CLAVE));
    return b?.id ? { id: b.id, tras: OPCIONES_TRAS.some(([v]) => v === b.tras) ? b.tras : 1 } : null;
  } catch {
    return null;
  }
}

function guardarBloqueo(valor) {
  try {
    if (valor) localStorage.setItem(CLAVE, JSON.stringify(valor));
    else localStorage.removeItem(CLAVE);
  } catch {
    // Sin almacenamiento no hay bloqueo.
  }
}

export async function bloqueoDisponible() {
  try {
    return Boolean(window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()));
  } catch {
    return false;
  }
}

// Crea la llave de acceso (pide Face ID una vez) y activa el bloqueo.
export async function activarBloqueo(tras = 1) {
  const credencial = await navigator.credentials.create({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rp: { name: 'Kitsune', id: location.hostname },
      user: { id: crypto.getRandomValues(new Uint8Array(16)), name: 'Kitsune', displayName: 'Bloqueo de Kitsune' },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7 },
        { type: 'public-key', alg: -257 },
      ],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      attestation: 'none',
      timeout: 60_000,
    },
  });
  if (!credencial) throw new Error('No se ha creado la llave.');
  guardarBloqueo({ id: aBase64Url(credencial.rawId), tras });
}

export function cambiarTras(tras) {
  const b = leerBloqueo();
  if (b) guardarBloqueo({ ...b, tras });
}

export function desactivarBloqueo() {
  guardarBloqueo(null);
}

// Face ID: vale si la llave es la nuestra y el dispositivo ha verificado a la persona.
export async function comprobarIdentidad() {
  const b = leerBloqueo();
  if (!b) return true;
  const respuesta = await navigator.credentials.get({
    publicKey: {
      challenge: crypto.getRandomValues(new Uint8Array(32)),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: deBase64Url(b.id), transports: ['internal', 'hybrid'] }],
      userVerification: 'required',
      timeout: 60_000,
    },
  });
  if (!respuesta || aBase64Url(respuesta.rawId) !== b.id) return false;
  const datos = new Uint8Array(respuesta.response.authenticatorData);
  // Byte 32 = flags: 0x01 presencia, 0x04 verificación (Face ID / código).
  return (datos[32] & 0x05) === 0x05;
}

// Borra todo lo de Kitsune en este dispositivo (salida de emergencia).
async function borrarTodo() {
  try {
    localStorage.clear();
    sessionStorage.clear();
  } catch {
    // Seguimos con lo demás.
  }
  const bases = (await indexedDB.databases?.().catch(() => [])) ?? [{ name: 'kitsune' }];
  await Promise.all(
    (bases.length ? bases : [{ name: 'kitsune' }]).map(
      (b) =>
        new Promise((ok) => {
          const p = indexedDB.deleteDatabase(b.name);
          p.onsuccess = p.onerror = p.onblocked = () => ok();
        }),
    ),
  );
  const registro = await navigator.serviceWorker?.getRegistration().catch(() => null);
  await (await registro?.pushManager?.getSubscription().catch(() => null))?.unsubscribe().catch(() => {});
}

// Pantalla de bloqueo: al abrir y al volver tras «tras» minutos fuera.
export function prepararBloqueo() {
  let capa = null;
  let fuera = null;
  let comprobando = false;

  function mostrar() {
    if (!leerBloqueo() || capa) return;
    capa = document.createElement('div');
    capa.className = 'bloqueo';
    capa.setAttribute('role', 'dialog');
    capa.setAttribute('aria-modal', 'true');
    capa.setAttribute('aria-label', 'Kitsune está bloqueado');
    capa.innerHTML = `
      <div class="bloqueo__caja">
        <div class="bloqueo__sello" aria-hidden="true">狐</div>
        <h2>Kitsune está bloqueado</h2>
        <p>Usa ${nombreBiometria()} para entrar.</p>
        <button type="button" class="boton boton--primario bloqueo__abrir">Desbloquear</button>
        <p class="bloqueo__mensaje" role="alert"></p>
        <details class="bloqueo__ayuda">
          <summary>¿No puedes desbloquear?</summary>
          <p>Si la llave de acceso se borró o no funciona, puedes borrar los datos de Kitsune en este dispositivo (claves, conexión con Google, conversaciones, CV…). Después vuelves a conectarlo todo.</p>
          <button type="button" class="boton bloqueo__borrar">Borrar los datos de Kitsune aquí</button>
        </details>
      </div>`;
    document.body.append(capa);
    document.documentElement.classList.add('bloqueada');
    const mensaje = capa.querySelector('.bloqueo__mensaje');
    capa.querySelector('.bloqueo__abrir').addEventListener('click', async () => {
      if (comprobando) return;
      comprobando = true;
      mensaje.textContent = '';
      try {
        if (await comprobarIdentidad()) quitar();
        else mensaje.textContent = 'No se ha podido comprobar que eres tú.';
      } catch (error) {
        mensaje.textContent = error.name === 'NotAllowedError' ? 'Cancelado. Toca «Desbloquear» para intentarlo otra vez.' : `No se ha podido usar ${nombreBiometria()}.`;
      } finally {
        comprobando = false;
      }
    });
    const borrar = capa.querySelector('.bloqueo__borrar');
    borrar.addEventListener('click', async () => {
      if (borrar.dataset.confirmar !== 'si') {
        borrar.dataset.confirmar = 'si';
        borrar.textContent = '¿Seguro? Pulsa otra vez: se borra todo lo de Kitsune aquí';
        return;
      }
      borrar.disabled = true;
      await borrarTodo();
      location.reload();
    });
  }

  function quitar() {
    capa?.remove();
    capa = null;
    document.documentElement.classList.remove('bloqueada');
  }

  document.addEventListener('visibilitychange', () => {
    const b = leerBloqueo();
    if (!b) return;
    if (document.visibilityState === 'hidden') {
      fuera = Date.now();
      // «Al instante»: se tapa ya, así la vista previa del selector de apps no enseña nada.
      if (b.tras === 0) mostrar();
    } else if (fuera !== null && Date.now() - fuera >= b.tras * 60_000) {
      mostrar();
    }
  });

  mostrar();
  return { mostrar, bloqueada: () => Boolean(capa) };
}
