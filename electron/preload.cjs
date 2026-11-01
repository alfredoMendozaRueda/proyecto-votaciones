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
    guardarClave: (clave, proveedor) => invocar('claude:clave', clave, proveedor),
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
  voicestudio: {
    hablar: (texto) => invocar('voicestudio:hablar', texto),
    voces: () => invocar('voicestudio:voces'),
  },
  ia: {
    tarea: (peticion) => invocar('ia:tarea', peticion),
    transcribir: (audio, tipo) => invocar('ia:transcribir', audio, tipo),
  },
  empleo: {
    leer: () => invocar('empleo:leer'),
    guardar: (datos) => invocar('empleo:guardar', datos),
  },
  sincro: {
    resumen: () => invocar('sincro:resumen'),
    activar: () => invocar('sincro:activar'),
    solicitar: () => invocar('sincro:solicitar'),
    esperar: () => invocar('sincro:esperar'),
    cancelarEspera: () => invocar('sincro:cancelarEspera'),
    aprobar: (id, publica) => invocar('sincro:aprobar', id, publica),
    rechazar: (id) => invocar('sincro:rechazar', id),
    elegirColecciones: (lista) => invocar('sincro:colecciones', lista),
    sincronizar: () => invocar('sincro:sincronizar'),
    desactivar: () => invocar('sincro:desactivar'),
    borrarServidor: () => invocar('sincro:borrarServidor'),
    alCambios: (callback) => escuchar('sincro:cambios', callback),
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
  servidor: {
    estado: () => invocar('servidor:estado'),
    canjear: (codigo) => invocar('servidor:canjear', codigo),
    probar: () => invocar('servidor:probar'),
    voz: (texto, voz) => invocar('servidor:voz', texto, voz),
    empleo: {
      buscar: (datos) => invocar('servidor:empleoBuscar', datos),
      detalle: (url) => invocar('servidor:empleoDetalle', url),
      alerta: () => invocar('servidor:empleoAlerta'),
      guardarAlerta: (datos) => invocar('servidor:guardarEmpleoAlerta', datos),
      probarAlerta: () => invocar('servidor:probarEmpleoAlerta'),
    },
    resumen: () => invocar('servidor:resumen'),
    crearCodigo: () => invocar('servidor:codigo'),
    avisos: (avisos) => invocar('servidor:avisos', avisos),
    groq: (activar) => invocar('servidor:groq', activar),
    automatizaciones: {
      listar: () => invocar('servidor:automatizaciones'),
      crear: (datos) => invocar('servidor:crearAutomatizacion', datos),
      actualizar: (id, datos) => invocar('servidor:actualizarAutomatizacion', id, datos),
      borrar: (id) => invocar('servidor:borrarAutomatizacion', id),
    },
    registro: () => invocar('servidor:registro'),
    quitarDispositivo: (id) => invocar('servidor:quitarDispositivo', id),
    desvincular: () => invocar('servidor:desvincular'),
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
