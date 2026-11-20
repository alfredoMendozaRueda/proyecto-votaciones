-- Base de datos del servidor de Kitsune (Cloudflare D1). Se puede aplicar
-- tantas veces como se quiera: solo crea lo que falta.
CREATE TABLE IF NOT EXISTS ajustes (clave TEXT PRIMARY KEY, valor TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS dispositivos (
  id TEXT PRIMARY KEY,
  token TEXT NOT NULL UNIQUE,
  nombre TEXT NOT NULL,
  suscripcion TEXT,
  creado INTEGER NOT NULL,
  visto INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS recordatorios (
  id TEXT PRIMARY KEY,
  texto TEXT NOT NULL,
  cuando INTEGER NOT NULL,
  avisado INTEGER NOT NULL DEFAULT 0,
  origen TEXT NOT NULL DEFAULT 'app'
);
CREATE INDEX IF NOT EXISTS recordatorios_cuando ON recordatorios (avisado, cuando);
CREATE TABLE IF NOT EXISTS automatizaciones (id TEXT PRIMARY KEY, datos TEXT NOT NULL, creada INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS avisados (clave TEXT PRIMARY KEY, cuando INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS registro (id INTEGER PRIMARY KEY AUTOINCREMENT, cuando INTEGER NOT NULL, tipo TEXT NOT NULL, texto TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS pendientes (
  estado TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  zona TEXT,
  caduca INTEGER NOT NULL,
  token TEXT,
  error TEXT
);
CREATE TABLE IF NOT EXISTS codigos (codigo TEXT PRIMARY KEY, caduca INTEGER NOT NULL, intentos INTEGER NOT NULL DEFAULT 0);
-- Sincronización entre dispositivos: cada dato va cifrado de extremo a extremo
-- (el servidor no tiene la llave). «version» crece con cada cambio.
CREATE TABLE IF NOT EXISTS sincro (id TEXT PRIMARY KEY, version INTEGER NOT NULL, cambiado INTEGER NOT NULL, datos TEXT, dispositivo TEXT);
CREATE INDEX IF NOT EXISTS sincro_version ON sincro (version);
CREATE TABLE IF NOT EXISTS sincro_solicitudes (
  id TEXT PRIMARY KEY,
  dispositivo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  publica TEXT NOT NULL,
  sobre TEXT,
  creado INTEGER NOT NULL
);
-- Registro de la IA: qué recibe y qué devuelve cada llamada (para entender sus
-- decisiones). Lo legible va cifrado en «datos»; se borra solo a los 14 días.
CREATE TABLE IF NOT EXISTS registro_ia (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cuando INTEGER NOT NULL,
  origen TEXT NOT NULL,
  etiqueta TEXT NOT NULL,
  sobre TEXT NOT NULL DEFAULT '',
  proveedor TEXT NOT NULL DEFAULT '',
  modelo TEXT NOT NULL DEFAULT '',
  ms INTEGER NOT NULL DEFAULT 0,
  ok INTEGER NOT NULL DEFAULT 1,
  datos TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS registro_ia_cuando ON registro_ia (cuando);
-- Apple Salud: tokens personales para el Atajo del iPhone (solo valen para
-- /integraciones/…). Se guarda la huella SHA-256, nunca el token en claro.
CREATE TABLE IF NOT EXISTS token_integracion (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  hash_token TEXT NOT NULL UNIQUE,
  creado_en INTEGER NOT NULL,
  ultimo_uso_en INTEGER,
  revocado INTEGER NOT NULL DEFAULT 0,
  ventana INTEGER NOT NULL DEFAULT 0,
  peticiones INTEGER NOT NULL DEFAULT 0
);
-- Lo que manda el Atajo, cifrado hacia la llave pública del buzón (el servidor
-- no puede leerlo). Se borra cuando un dispositivo lo recoge. Los pasos de un
-- día pendientes se reemplazan («clave» = huella del día).
CREATE TABLE IF NOT EXISTS buzon_salud (
  id TEXT PRIMARY KEY,
  clave TEXT UNIQUE,
  recibido INTEGER NOT NULL,
  sobre TEXT NOT NULL
);
-- Huellas (HMAC con un secreto del servidor) de los pesajes ya recibidos, para
-- responder «duplicado» sin guardar el peso en claro. Se borran a los 120 días.
CREATE TABLE IF NOT EXISTS salud_vistos (clave TEXT PRIMARY KEY, cuando INTEGER NOT NULL);
-- Forma → Apple Salud (solo si lo activas en la app): días cerrados de comida y
-- entrenos terminados, que el Atajo lee con su token y escribe en Salud. Van sin
-- cifrar (el Atajo no sabe descifrar); se entregan una sola vez y se borran a los 30 días.
CREATE TABLE IF NOT EXISTS salud_salida (
  id TEXT PRIMARY KEY,
  tipo TEXT NOT NULL,
  datos TEXT NOT NULL,
  creado INTEGER NOT NULL,
  entregado INTEGER
);
