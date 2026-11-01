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
