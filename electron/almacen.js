import { app, safeStorage } from 'electron';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import path from 'node:path';
import { normalizarAjustes, aplicarCambios } from '../src/compartido/ajustes.js';

const carpeta = () => app.getPath('userData');
const rutaAjustes = () => path.join(carpeta(), 'ajustes.json');
const rutaSecretos = () => path.join(carpeta(), 'secretos.json');

function leerJson(ruta) {
  try {
    return JSON.parse(readFileSync(ruta, 'utf8'));
  } catch {
    return {};
  }
}

function escribirJson(ruta, datos) {
  mkdirSync(path.dirname(ruta), { recursive: true });
  writeFileSync(ruta, JSON.stringify(datos, null, 2), { mode: 0o600 });
}

export function obtenerAjustes() {
  return normalizarAjustes(leerJson(rutaAjustes()));
}

// Cualquier ajuste que llegue del renderer se valida antes de guardarse.
export function guardarAjustes(cambios) {
  const ajustes = aplicarCambios(obtenerAjustes(), cambios);
  escribirJson(rutaAjustes(), ajustes);
  return ajustes;
}

// Datos de la app que no son secretos (recordatorios).
export function leerDatos(nombre) {
  const datos = leerJson(path.join(carpeta(), `${nombre}.json`));
  return Array.isArray(datos) ? datos : [];
}

export function guardarDatos(nombre, datos) {
  escribirJson(path.join(carpeta(), `${nombre}.json`), datos);
}

// Secretos (clave de Claude, tokens de Google): cifrados con la API del
// sistema (DPAPI en Windows) y nunca enviados al renderer.
export function leerSecreto(nombre) {
  const cifrado = leerJson(rutaSecretos())[nombre];
  if (!cifrado) return null;
  try {
    return safeStorage.decryptString(Buffer.from(cifrado, 'base64'));
  } catch {
    return null;
  }
}

export function guardarSecreto(nombre, valor) {
  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('El sistema no permite cifrar datos: no se puede guardar la clave de forma segura.');
  }
  const secretos = leerJson(rutaSecretos());
  secretos[nombre] = safeStorage.encryptString(valor).toString('base64');
  escribirJson(rutaSecretos(), secretos);
}

export function borrarSecreto(nombre) {
  const secretos = leerJson(rutaSecretos());
  delete secretos[nombre];
  escribirJson(rutaSecretos(), secretos);
}
