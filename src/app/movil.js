import { icono } from './iconos.js';

// Disposición de móvil de la versión web (la PWA). Al abrir la app solo está
// el zorro, grande en el centro; al tocarlo se encoge (se vuelve una cría),
// se va abajo a la derecha y el diálogo le sale de la boca, casi a pantalla
// completa, con los apartados en una barra inferior. Tocarlo otra vez (o la X)
// lo cierra por el mismo camino. Hay además una hoja «Más» para lo que no cabe
// en la barra, y la app se ajusta al teclado. En Electron y en pantallas
// anchas no cambia nada.

const MOVIL = '(max-width: 600px)';
// Curva de las hojas de iOS: arranca rápida y se posa sin rebote.
const CURVA = 'cubic-bezier(0.32, 0.72, 0, 1)';
const DURACION = 560;

const ENTRADAS_MAS = [
  { vista: 'memoria', icono: 'memoria', titulo: 'Memoria', detalle: 'Lo que Kitsune recuerda de ti' },
  { vista: 'historial', icono: 'historial', titulo: 'Historial', detalle: 'Tus conversaciones guardadas' },
  { vista: 'ajustes', icono: 'ajustes', titulo: 'Ajustes', detalle: 'IA, Google, voz y aspecto' },
];

const enApp = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const esIphone = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const reducido = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

export function prepararMovil({ escena, dialogo, zorro, kitsune, mostrarVista, obtenerVista, nuevaConversacion, vibrar, alAbrir }) {
  const consulta = matchMedia(MOVIL);
  const raiz = document.documentElement;
  const botonMas = document.getElementById('pestana-mas');
  let instalacion = null;

  // ---------- El zorro: grande y solo, o cría en la esquina con el diálogo ----------

  // Dónde acaba el zorro al abrir (lo coloca el CSS) y la invitación a tocarlo.
  const hueco = document.createElement('div');
  hueco.className = 'zorro-hueco';
  hueco.setAttribute('aria-hidden', 'true');
  const pista = document.createElement('p');
  pista.className = 'pista-zorro';
  pista.textContent = 'Toca a Kitsune';
  escena.append(hueco, pista);

  function aplicarModo() {
    raiz.classList.toggle('movil', consulta.matches);
    if (!consulta.matches) {
      delete escena.dataset.modo;
      kitsune.setBebe(false);
      return;
    }
    escena.dataset.modo = dialogo.hidden ? 'solo' : 'abierto';
    kitsune.setBebe(!dialogo.hidden);
  }
  consulta.addEventListener('change', aplicarModo);
  aplicarModo();

  let animacion = null;
  let enCurso = Promise.resolve();

  // FLIP inverso: el contenedor conserva su tamaño grande mientras se mueve y
  // encoge con transform (nítido y sin redimensionar el lienzo cada fotograma);
  // al terminar se coloca en su sitio con su tamaño real.
  function moverZorro(desde, hasta, alReves = false) {
    animacion?.cancel();
    const s = hasta.width / desde.width;
    const destino = `translate(${hasta.left - desde.left}px, ${hasta.top - desde.top}px) scale(${s})`;
    const fotogramas = alReves ? [{ transform: destino }, { transform: 'none' }] : [{ transform: 'none' }, { transform: destino }];
    animacion = zorro.animate(fotogramas, { duration: reducido() ? 1 : DURACION, easing: CURVA, fill: 'forwards' });
    return animacion.finished.catch(() => {});
  }

  function abrir() {
    if (escena.dataset.modo === 'abierto' || escena.dataset.modo === 'abriendo') return enCurso;
    enCurso = enCurso.then(async () => {
      const grande = zorro.getBoundingClientRect();
      const pequeno = hueco.getBoundingClientRect();
      escena.dataset.modo = 'abriendo';
      dialogo.classList.remove('cerrandose');
      dialogo.hidden = false;
      kitsune.setBebe(true);
      vibrar(10);
      // El diálogo sale de la boca: el zorro la abre mientras tanto.
      setTimeout(() => kitsune.pulsoHabla(30), 120);
      setTimeout(() => kitsune.pulsoHabla(20), 300);
      alAbrir?.();
      await moverZorro(grande, pequeno);
      escena.dataset.modo = 'abierto';
      animacion?.cancel();
    });
    return enCurso;
  }

  function cerrar() {
    if (escena.dataset.modo !== 'abierto' && escena.dataset.modo !== 'abriendo') return enCurso;
    enCurso = enCurso.then(async () => {
      cerrarHoja({ devolverFoco: false });
      // Primero el diálogo vuelve a la boca; luego el zorro crece hasta el centro.
      dialogo.classList.add('cerrandose');
      kitsune.pulsoHabla(20);
      await esperar(reducido() ? 0 : 200);
      const pequeno = zorro.getBoundingClientRect();
      escena.dataset.modo = 'cerrando';
      dialogo.hidden = true;
      dialogo.classList.remove('cerrandose');
      kitsune.setBebe(false);
      const grande = zorro.getBoundingClientRect();
      await moverZorro(grande, pequeno, true);
      escena.dataset.modo = 'solo';
      animacion?.cancel();
    });
    return enCurso;
  }

  // ---------- Teclado: la app ocupa solo lo que queda visible ----------

  // En el iPhone el teclado tapa la página en vez de encogerla: se sigue el
  // viewport visual y la escena se ajusta a él.
  const vv = window.visualViewport;
  if (vv) {
    const ajustar = () => {
      raiz.style.setProperty('--vv-alto', `${Math.round(vv.height)}px`);
      raiz.style.setProperty('--vv-arriba', `${Math.round(vv.offsetTop)}px`);
    };
    vv.addEventListener('resize', ajustar);
    vv.addEventListener('scroll', ajustar);
    ajustar();
  }

  // ---------- Hoja «Más» ----------

  const fondo = document.createElement('div');
  fondo.className = 'hoja-fondo';
  fondo.hidden = true;
  const hoja = document.createElement('section');
  hoja.className = 'hoja';
  hoja.id = 'hoja-mas';
  hoja.hidden = true;
  hoja.setAttribute('role', 'dialog');
  hoja.setAttribute('aria-modal', 'true');
  hoja.setAttribute('aria-labelledby', 'hoja-mas-titulo');
  hoja.innerHTML = `
    <div class="hoja__asa" aria-hidden="true"></div>
    <h2 class="hoja__titulo" id="hoja-mas-titulo">Más</h2>
    <ul class="hoja__lista">
      ${ENTRADAS_MAS.map(
        (e) => `<li><button type="button" class="hoja__entrada" data-vista="${e.vista}">
          <span class="hoja__icono">${icono(e.icono, 20)}</span>
          <span class="hoja__texto"><span>${e.titulo}</span><small>${e.detalle}</small></span>
        </button></li>`,
      ).join('')}
      <li><button type="button" class="hoja__entrada" data-accion="nueva">
        <span class="hoja__icono">${icono('conversacion', 20)}</span>
        <span class="hoja__texto"><span>Nueva conversación</span><small>La actual queda en el historial</small></span>
      </button></li>
      <li hidden data-instalar><button type="button" class="hoja__entrada" data-accion="instalar">
        <span class="hoja__icono">${icono('instalar', 20)}</span>
        <span class="hoja__texto"><span>Instalar Kitsune</span><small>Como una app, con su icono y sin barra del navegador</small></span>
      </button></li>
    </ul>
    <p class="hoja__ayuda" hidden data-ayuda-iphone>
      En el iPhone: pulsa ${icono('compartir', 16)} <strong>Compartir</strong> en Safari y luego <strong>Añadir a pantalla de inicio</strong>.
    </p>`;
  document.body.append(fondo, hoja);
  botonMas.querySelector('.apartado__icono').innerHTML = icono('mas', 20);

  let abierta = false;
  let foco = null;

  function abrirHoja() {
    if (abierta) return;
    abierta = true;
    foco = document.activeElement;
    // Instalar: Android ofrece el aviso del navegador; en el iPhone se explica cómo.
    const iphoneSinInstalar = esIphone() && !enApp();
    hoja.querySelector('[data-instalar]').hidden = !instalacion && !iphoneSinInstalar;
    hoja.querySelector('[data-ayuda-iphone]').hidden = true;
    fondo.hidden = false;
    hoja.hidden = false;
    // Mientras la hoja está abierta, lo de detrás no recibe foco ni toques.
    dialogo.inert = true;
    hoja.style.transform = '';
    hoja.classList.remove('cerrandose');
    fondo.classList.remove('cerrandose');
    botonMas.setAttribute('aria-expanded', 'true');
    vibrar(6);
    hoja.querySelector('.hoja__entrada').focus({ preventScroll: true });
  }

  function cerrarHoja({ devolverFoco = true } = {}) {
    if (!abierta) return;
    abierta = false;
    botonMas.setAttribute('aria-expanded', 'false');
    dialogo.inert = false;
    hoja.classList.add('cerrandose');
    fondo.classList.add('cerrandose');
    setTimeout(() => {
      if (abierta) return;
      hoja.hidden = true;
      fondo.hidden = true;
      hoja.style.transform = '';
    }, 220);
    if (devolverFoco) foco?.focus?.({ preventScroll: true });
  }

  botonMas.addEventListener('click', () => (abierta ? cerrarHoja() : abrirHoja()));
  fondo.addEventListener('click', () => cerrarHoja());
  hoja.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      cerrarHoja();
    }
    // El foco no sale de la hoja mientras está abierta.
    if (e.key === 'Tab') {
      const enfocables = [...hoja.querySelectorAll('button')].filter((b) => !b.closest('[hidden]'));
      const [primero, ultimo] = [enfocables[0], enfocables.at(-1)];
      if (e.shiftKey && document.activeElement === primero) {
        e.preventDefault();
        ultimo.focus();
      } else if (!e.shiftKey && document.activeElement === ultimo) {
        e.preventDefault();
        primero.focus();
      }
    }
  });

  hoja.addEventListener('click', async (e) => {
    const boton = e.target.closest('.hoja__entrada');
    if (!boton) return;
    if (boton.dataset.vista) {
      cerrarHoja({ devolverFoco: false });
      mostrarVista(boton.dataset.vista);
    } else if (boton.dataset.accion === 'nueva') {
      cerrarHoja({ devolverFoco: false });
      await nuevaConversacion();
    } else if (boton.dataset.accion === 'instalar') {
      if (instalacion) {
        instalacion.prompt();
        const { outcome } = await instalacion.userChoice.catch(() => ({}));
        if (outcome === 'accepted') instalacion = null;
        cerrarHoja();
      } else {
        hoja.querySelector('[data-ayuda-iphone]').hidden = false;
      }
    }
  });

  // Arrastrar la hoja hacia abajo la cierra: sigue al dedo 1:1 y, al soltar,
  // decide por la velocidad (un gesto rápido basta) o por la distancia.
  let arrastre = null;
  hoja.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.hoja__entrada') && e.pointerType === 'mouse') return;
    arrastre = { inicio: e.clientY, y: 0, muestras: [{ y: e.clientY, t: e.timeStamp }], id: e.pointerId, activo: false };
  });
  hoja.addEventListener('pointermove', (e) => {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    const dy = e.clientY - arrastre.inicio;
    // Un pequeño umbral antes de decidir que es un arrastre y no un toque.
    if (!arrastre.activo) {
      if (dy < 8) return;
      arrastre.activo = true;
      hoja.setPointerCapture(e.pointerId);
      hoja.classList.add('arrastrando');
    }
    arrastre.y = Math.max(0, dy);
    arrastre.muestras = [...arrastre.muestras.slice(-4), { y: e.clientY, t: e.timeStamp }];
    hoja.style.transform = `translateY(${arrastre.y}px)`;
  });
  const soltar = (e) => {
    if (!arrastre || e.pointerId !== arrastre.id) return;
    const { activo, y, muestras } = arrastre;
    arrastre = null;
    hoja.classList.remove('arrastrando');
    if (!activo) return;
    // El clic que sigue a un arrastre no debe abrir la entrada sobre la que acabó.
    hoja.dataset.arrastrado = '1';
    setTimeout(() => delete hoja.dataset.arrastrado, 0);
    const [a, b] = [muestras[0], muestras.at(-1)];
    const velocidad = b.t > a.t ? ((b.y - a.y) / (b.t - a.t)) * 1000 : 0; // px/s
    // Dónde acabaría con la inercia del gesto (como el desplazamiento del sistema).
    const proyectado = y + (velocidad / 1000) * (0.998 / (1 - 0.998));
    if (proyectado > hoja.offsetHeight * 0.45 || velocidad > 900) cerrarHoja();
    else hoja.style.transform = '';
  };
  hoja.addEventListener('pointerup', soltar);
  hoja.addEventListener('pointercancel', soltar);
  // Si hubo arrastre, el toque no cuenta como clic en una entrada.
  hoja.addEventListener('click', (e) => hoja.dataset.arrastrado && e.stopPropagation(), true);

  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    instalacion = e;
  });
  window.addEventListener('appinstalled', () => (instalacion = null));

  // «Más» se marca cuando se está en uno de sus apartados.
  function alCambiarVista(nombre) {
    const dentro = ENTRADAS_MAS.some((e) => e.vista === nombre);
    botonMas.classList.toggle('activo', dentro);
    escena.dataset.vista = nombre;
    if (abierta) cerrarHoja({ devolverFoco: false });
  }
  alCambiarVista(obtenerVista());

  return {
    activo: () => consulta.matches,
    abierto: () => escena.dataset.modo === 'abierto' || escena.dataset.modo === 'abriendo',
    abrir,
    cerrar,
    alternar: () => (escena.dataset.modo === 'abierto' || escena.dataset.modo === 'abriendo' ? cerrar() : abrir()),
    alCambiarVista,
    abrirHoja,
    cerrarHoja,
  };
}
