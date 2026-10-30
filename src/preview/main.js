import { Kitsune, ESTADOS, ACCIONES } from '../kitsune/Kitsune.js';
import { PALETAS } from '../kitsune/paletas.js';

const INFO_ESTADOS = {
  reposo: { nombre: 'Reposo', desc: 'Respira, parpadea y balancea las colas mientras no lo usas.' },
  escuchar: { nombre: 'Escuchar', desc: 'Orejas alerta y cabeza ladeada mientras escribes en el diálogo.' },
  hablar: { nombre: 'Hablar', desc: 'Mueve el hocico mientras va llegando la respuesta de Claude.' },
  pensar: { nombre: 'Pensar', desc: 'Mira hacia arriba y arremolina las colas mientras Claude piensa.' },
  dormir: { nombre: 'Dormir', desc: 'Agacha la cabeza y recoge las colas tras unos minutos sin uso.' },
};

const INFO_ACCIONES = {
  aparecer: { nombre: 'Aparecer', cuando: 'Al pulsar el atajo' },
  saludar: { nombre: 'Saludar', cuando: 'La primera vez cada día' },
  alegria: { nombre: 'Alegría', cuando: 'Cuando llega un correo nuevo' },
  desaparecer: { nombre: 'Desaparecer', cuando: 'Atajo otra vez o Esc' },
};

const escenario = document.getElementById('escenario');
const kitsune = new Kitsune(document.getElementById('lienzo'));
window.kitsune = kitsune;

const etiquetaEstado = document.getElementById('etiqueta-estado');
const descripcion = document.getElementById('descripcion-estado');

// ---------- Estados ----------
const botonesEstado = ESTADOS.map((estado) => {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.id = `estado-${estado}`;
  boton.textContent = INFO_ESTADOS[estado].nombre;
  boton.addEventListener('click', async () => {
    await asegurarVisible();
    kitsune.setEstado(estado);
  });
  document.getElementById('estados').append(boton);
  return [estado, boton];
});

function pintarEstado(estado) {
  for (const [nombre, boton] of botonesEstado) boton.setAttribute('aria-pressed', String(nombre === estado));
  etiquetaEstado.textContent = INFO_ESTADOS[estado].nombre;
  descripcion.textContent = INFO_ESTADOS[estado].desc;
}
kitsune.on('estado', pintarEstado);
pintarEstado(kitsune.estado);

// ---------- Acciones ----------
const botonesAccion = new Map();
for (const accion of ACCIONES) {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.id = `accion-${accion}`;
  boton.className = 'accion';
  boton.innerHTML = `<strong>${INFO_ACCIONES[accion].nombre}</strong><span>${INFO_ACCIONES[accion].cuando}</span>`;
  boton.addEventListener('click', () => lanzar(accion));
  document.getElementById('acciones').append(boton);
  botonesAccion.set(accion, boton);
}

kitsune.on('accion', (nombre) => {
  for (const [accion, boton] of botonesAccion) boton.classList.toggle('activa', accion === nombre);
});
kitsune.on('accion-fin', (nombre) => botonesAccion.get(nombre)?.classList.remove('activa'));

async function asegurarVisible() {
  if (!kitsune.visible || kitsune.accion?.nombre === 'desaparecer') await kitsune.reproducir('aparecer');
}

async function lanzar(accion) {
  if (accion === 'aparecer' || accion === 'desaparecer') return kitsune.reproducir(accion);
  await asegurarVisible();
  if (kitsune.estado === 'dormir') kitsune.setEstado('reposo');
  return kitsune.reproducir(accion);
}

function alternarVisibilidad() {
  const oculto = !kitsune.visible || kitsune.accion?.nombre === 'desaparecer';
  return kitsune.reproducir(oculto ? 'aparecer' : 'desaparecer');
}

// ---------- Paletas ----------
const botonesPaleta = Object.entries(PALETAS).map(([clave, pal]) => {
  const boton = document.createElement('button');
  boton.type = 'button';
  boton.id = `paleta-${clave}`;
  boton.className = 'paleta';
  boton.innerHTML = `
    <span class="paleta__muestra" aria-hidden="true">
      <i style="background:${pal.pelaje}"></i><i style="background:${pal.puntaCola}"></i><i style="background:${pal.marca}"></i>
    </span>${pal.nombre}`;
  boton.addEventListener('click', () => kitsune.setPaleta(clave));
  document.getElementById('paletas').append(boton);
  return [clave, boton];
});
function pintarPaleta(nombre) {
  for (const [clave, boton] of botonesPaleta) boton.setAttribute('aria-pressed', String(clave === nombre));
}
kitsune.on('paleta', pintarPaleta);
pintarPaleta(kitsune.paleta);

// ---------- Opciones ----------
document.getElementById('opcion-cursor').addEventListener('change', (e) => {
  kitsune.setOpcion('seguirCursor', e.target.checked);
});
document.getElementById('opcion-fuegos').addEventListener('change', (e) => {
  kitsune.setOpcion('fuegos', e.target.checked);
});

// ---------- Vista ----------
const botonesVista = [...document.querySelectorAll('.vista button')];
for (const boton of botonesVista) {
  boton.addEventListener('click', () => {
    escenario.dataset.vista = boton.dataset.vista;
    for (const b of botonesVista) b.setAttribute('aria-pressed', String(b === boton));
  });
}

const reloj = document.getElementById('reloj');
function pintarReloj() {
  const ahora = new Date();
  reloj.innerHTML = `${ahora.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}<br>${ahora.toLocaleDateString('es-ES')}`;
}
pintarReloj();
setInterval(pintarReloj, 30_000);

// ---------- Atajo y clic ----------
window.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.altKey && e.code === 'KeyK') {
    e.preventDefault();
    alternarVisibilidad();
  } else if (e.key === 'Escape' && kitsune.visible) {
    kitsune.reproducir('desaparecer');
  }
});

kitsune.on('toque', () => {
  if (kitsune.estado === 'dormir') kitsune.setEstado('reposo');
  kitsune.reproducir('alegria');
});

// Al cargar: se invoca y saluda, como hará la app al pulsar el atajo por primera vez.
kitsune.reproducir('aparecer').then(() => kitsune.reproducir('saludar'));
