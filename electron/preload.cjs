// Puente seguro entre el renderer (sin acceso a Node) y el proceso principal.
// Solo expone funciones concretas; nunca ipcRenderer directamente.
const { contextBridge, ipcRenderer } = require('electron');

async function invocar(canal, ...args) {
  const respuesta = await ipcRenderer.invoke(canal, ...args);
  if (!respuesta.ok) throw new Error(respuesta.error);
  return respuesta.datos;
}

function escuchar(canal, callback) {
  const oyente = (_evento, datos) => callback(datos);
  ipcRenderer.on(canal, oyente);
  return () => ipcRenderer.removeListener(canal, oyente);
}

contextBridge.exposeInMainWorld('asistente', {
  plataforma: 'electron',
  ajustes: {
    obtener: () => invocar('ajustes:obtener'),
    guardar: (cambios) => invocar('ajustes:guardar', cambios),
  },
  claude: {
    estado: () => invocar('claude:estado'),
    guardarClave: (clave) => invocar('claude:clave', clave),
    enviar: (texto) => invocar('claude:enviar', texto),
    cancelar: () => invocar('claude:cancelar'),
    reiniciar: () => invocar('claude:reiniciar'),
    mensajes: () => invocar('claude:mensajes'),
    confirmar: (id, acepta) => invocar('claude:confirmar', id, acepta),
    redactarRespuesta: (id, indicaciones) => invocar('claude:redactar', id, indicaciones),
    alEvento: (callback) => escuchar('claude:evento', callback),
  },
  conversaciones: {
    listar: () => invocar('conversaciones:listar'),
    abrir: (id) => invocar('conversaciones:abrir', id),
    borrar: (id) => invocar('conversaciones:borrar', id),
    borrarTodo: () => invocar('conversaciones:borrarTodo'),
  },
  correo: {
    estado: () => invocar('correo:estado'),
    guardarSecretoCliente: (secreto) => invocar('correo:cliente', secreto),
    conectar: () => invocar('correo:conectar'),
    desconectar: () => invocar('correo:desconectar'),
    listar: (opciones) => invocar('correo:listar', opciones),
    leer: (id) => invocar('correo:leer', id),
    modificar: (id, cambios) => invocar('correo:modificar', id, cambios),
    enviar: (datos) => invocar('correo:enviar', datos),
    alNuevo: (callback) => escuchar('correo:nuevo', callback),
  },
  memoria: {
    listar: () => invocar('memoria:listar'),
    recordar: (texto) => invocar('memoria:recordar', texto),
    olvidar: (id) => invocar('memoria:olvidar', id),
    olvidarTodo: () => invocar('memoria:olvidarTodo'),
  },
  calendario: {
    estado: () => invocar('calendario:estado'),
    eventos: (desde, hasta) => invocar('calendario:eventos', desde, hasta),
    crear: (evento) => invocar('calendario:crear', evento),
    borrar: (id) => invocar('calendario:borrar', id),
    alCita: (callback) => escuchar('calendario:cita', callback),
  },
  recordatorios: {
    listar: () => invocar('recordatorios:listar'),
    crear: (datos) => invocar('recordatorios:crear', datos),
    borrar: (id) => invocar('recordatorios:borrar', id),
    alAviso: (callback) => escuchar('recordatorio:aviso', callback),
  },
  ventana: {
    alAlternar: (callback) => escuchar('ventana:alternar', callback),
    alAbrirAjustes: (callback) => escuchar('ventana:ajustes', callback),
    alTexto: (callback) => escuchar('ventana:texto', callback),
    ocultar: () => ipcRenderer.send('ventana:ocultar'),
    ratonDentro: (dentro) => ipcRenderer.send('ventana:raton', Boolean(dentro)),
    abrirEnlace: (url) => invocar('enlace:abrir', url),
  },
});
