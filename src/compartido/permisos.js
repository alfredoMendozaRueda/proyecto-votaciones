// Qué puede hacer Kitsune por su cuenta. Cada permiso tiene tres niveles:
//   si:        lo hace directamente.
//   preguntar: muestra una tarjeta en el chat y espera a que el usuario la acepte.
//   no:        no se le ofrece la herramienta; si se lo piden, dice que no puede.
// Algunos no admiten todos los niveles: leer no necesita confirmación y enviar
// un correo siempre la pide.

export const NIVELES = ['si', 'preguntar', 'no'];

export const PERMISOS = [
  { clave: 'permisoCorreoLeer', grupo: 'Correo', nombre: 'Buscar y leer tus correos', defecto: 'si', niveles: ['si', 'no'], herramientas: ['buscar_correos', 'leer_correo'] },
  { clave: 'permisoCorreoOrganizar', grupo: 'Correo', nombre: 'Marcar como leído, destacar y archivar', defecto: 'preguntar', herramientas: ['organizar_correo'] },
  { clave: 'permisoCorreoBorrar', grupo: 'Correo', nombre: 'Mover correos a la papelera', defecto: 'preguntar', herramientas: ['borrar_correo'] },
  { clave: 'permisoCorreoEnviar', grupo: 'Correo', nombre: 'Enviar y responder correos', defecto: 'preguntar', niveles: ['preguntar', 'no'], herramientas: ['enviar_correo'] },
  { clave: 'permisoAgendaVer', grupo: 'Agenda', nombre: 'Consultar tu agenda', defecto: 'si', niveles: ['si', 'no'], herramientas: ['ver_agenda'] },
  { clave: 'permisoEventoCrear', grupo: 'Agenda', nombre: 'Crear eventos', defecto: 'preguntar', herramientas: ['crear_evento'] },
  { clave: 'permisoEventoModificar', grupo: 'Agenda', nombre: 'Cambiar eventos (hora, título, lugar)', defecto: 'preguntar', herramientas: ['modificar_evento'] },
  { clave: 'permisoEventoBorrar', grupo: 'Agenda', nombre: 'Eliminar eventos', defecto: 'preguntar', herramientas: ['borrar_evento'] },
  { clave: 'permisoRecordatorioCrear', grupo: 'Avisos', nombre: 'Crear recordatorios', defecto: 'si', herramientas: ['crear_recordatorio'] },
  { clave: 'permisoRecordatorioBorrar', grupo: 'Avisos', nombre: 'Borrar recordatorios', defecto: 'si', herramientas: ['borrar_recordatorio'] },
  { clave: 'permisoMemoria', grupo: 'Memoria', nombre: 'Apuntar y olvidar cosas sobre ti', defecto: 'si', herramientas: ['recordar', 'olvidar'] },
  { clave: 'permisoAutomatizacion', grupo: 'Automatizaciones', nombre: 'Crear automatizaciones', defecto: 'preguntar', herramientas: ['crear_automatizacion'] },
];

export const NOMBRES_NIVEL = { si: 'Sí', preguntar: 'Preguntar', no: 'No' };

const POR_HERRAMIENTA = new Map(PERMISOS.flatMap((p) => p.herramientas.map((h) => [h, p])));

export const nivelesDe = (permiso) => permiso.niveles ?? NIVELES;

// Nivel vigente de un permiso; si el ajuste falta (o no vale), el de por defecto.
export function nivel(ajustes, clave) {
  const permiso = PERMISOS.find((p) => p.clave === clave);
  const valor = ajustes?.[clave];
  return permiso && nivelesDe(permiso).includes(valor) ? valor : permiso?.defecto;
}

// Nivel que corresponde a una herramienta. Las que no dependen de un permiso
// (tiempo, recordatorios pendientes…) siempre están permitidas.
export function nivelHerramienta(ajustes, nombre) {
  const permiso = POR_HERRAMIENTA.get(nombre);
  return permiso ? nivel(ajustes, permiso.clave) : 'si';
}

export const permisosPorDefecto = () => Object.fromEntries(PERMISOS.map((p) => [p.clave, p.defecto]));

export const opcionesPermisos = () => Object.fromEntries(PERMISOS.map((p) => [p.clave, nivelesDe(p)]));
