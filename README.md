# Kitsune · asistente personal

Asistente personal protagonizado por un kitsune 3D de nueve colas. En Windows,
con `Ctrl + Alt + K` aparece abajo a la izquierda de la pantalla y, encima de
él, un diálogo en rojo y negro para hablar con Claude y llevar el correo de
Gmail sin salir de ahí. En el móvil es una app web instalable (PWA): tocas el
icono y el zorro aparece abajo con el diálogo encima, a pantalla completa.

Esta rama es un proyecto independiente del sistema de votaciones: no comparte
historial ni código con `main`.

## Qué hace

- **Atajo global** (`Ctrl + Alt + K`, configurable): el zorro aparece con su
  animación; pulsarlo otra vez o `Esc` lo oculta. Vive en la bandeja del
  sistema y puede arrancar con Windows.
- **Chat con Claude**: respuestas en tiempo real, con el zorro escuchando,
  pensando y hablando. Puede leer tu correo (solo lectura) para resumirlo o
  contestarte preguntas sobre él, y leer las respuestas en voz alta.
- **Correo**: bandeja tipo Gmail con búsqueda, filtros (recibidos, no leídos,
  destacados), lectura, responder, redactar, archivar, papelera y destacados.
  Los correos nuevos hacen saltar al zorro y muestran una notificación.
- **Ajustes**: pelaje, tamaño, posición, calidad del pelo, fuegos fatuos,
  mirada, atajo, inicio con Windows, sueño, voz, clave y modelo de Claude,
  personalidad y cuenta de Gmail.

## Puesta en marcha

Necesitas Node.js 20 o superior.

```bash
npm install
npm run app      # compila la interfaz y abre la aplicación
```

Para generar el instalador de Windows (`out/Kitsune Setup x.y.z.exe`):

```bash
npm run dist
```

`npm run dev` sirve la versión web en `http://localhost:5173/`; con
`http://localhost:5173/?demo` se abre en **modo de ejemplo** (correos y
respuestas inventados), útil para trabajar en el diseño sin cuentas reales.
La vista del personaje y sus animaciones está en `personaje.html`.

### Conectar Claude

1. Crea una clave en [console.anthropic.com](https://console.anthropic.com), en API Keys.
2. En Kitsune: Ajustes → Claude → pega la clave y pulsa Guardar.

La clave se comprueba antes de guardarla y se guarda cifrada con el sistema
(DPAPI en Windows). El modelo por defecto es Claude Opus 5.5; puedes cambiar a
Sonnet 5.5 (más rápido) o Haiku 5.5 (más económico).

### Conectar Gmail

Google exige que cada instalación use su propio cliente OAuth:

1. En [Google Cloud Console](https://console.cloud.google.com/), crea un proyecto
   y activa la **Gmail API**.
2. En "Pantalla de consentimiento de OAuth", añade tu cuenta como usuario de prueba.
3. En Credenciales, crea un **ID de cliente OAuth** de tipo **App de escritorio**.
4. En Kitsune: Ajustes → Correo → pega el ID y el secreto y pulsa
   "Conectar con Google". Se abre el navegador para que autorices el acceso.

Kitsune pide el permiso `gmail.modify` (leer, marcar, archivar, mover a la
papelera y enviar; nunca borrar para siempre). El token se guarda cifrado.

## En el móvil (app web instalable)

La misma interfaz funciona como PWA en Android e iPhone. Se publica sola en
GitHub Pages con cada push a esta rama (`.github/workflows/web.yml`). La
primera vez hay que activarlo en el repositorio:

1. Settings → Pages → Source: **GitHub Actions**.
2. Settings → Environments → `github-pages` → en "Deployment branches and
   tags" añade la rama `kitsune-asistente` (por defecto solo deja publicar
   desde la rama principal).

La app queda en `https://<usuario>.github.io/<repositorio>/`. Para instalarla:

- **Android (Chrome)**: menú ⋮ → "Instalar aplicación".
- **iPhone (Safari)**: Compartir → "Añadir a pantalla de inicio".

Para probarla en local: `npm run build && npx vite preview --host` y abre la
dirección desde el móvil (en la misma red). Con `?demo` al final de la
dirección se abre el modo de ejemplo.

### Claude y Gmail en la versión web

- **Claude**: la clave se pega en Ajustes igual que en escritorio. El navegador
  llama a la API directamente y la clave se guarda cifrada (AES-GCM) con una
  llave no exportable del propio navegador.
- **Gmail**: crea en Google Cloud un ID de cliente OAuth de tipo
  **Aplicación web** y añade como "Orígenes autorizados de JavaScript" la
  dirección donde está publicada la app (Ajustes la muestra). No hace falta
  secreto: solo se pega el ID.

Diferencias con la versión de escritorio:

- Google da a las aplicaciones web sesiones de una hora; después Kitsune pide
  "Reconectar" con un toque (sin volver a dar permisos).
- Los avisos de correo nuevo llegan como notificaciones mientras la app está
  abierta o en segundo plano reciente; con la app cerrada el sistema no la
  despierta (haría falta un servidor propio).
- No hay atajo global, bandeja del sistema ni inicio automático.
- La app abre sin conexión, pero hablar con Claude o ver el correo necesita red.

## Rendimiento

El zorro ajusta solo su coste:

- **Calidad automática**: mide cuánto tarda cada fotograma y baja (o sube) la
  resolución, las capas de pelo y las sombras hasta ir fluido. Se puede fijar
  a mano en Ajustes → Calidad gráfica. En móviles empieza un nivel por debajo.
- **Fotogramas según lo que pasa**: 60 fps mientras habla, piensa o actúa;
  30 en reposo; 20 dormido; 0 cuando está oculto o la pestaña no se ve.
- **Sin basura en cada fotograma**: vectores reutilizados y estelas de los
  fuegos en búferes circulares, para que el recolector de memoria no
  provoque tirones.

## Seguridad

- El renderer no tiene acceso a Node: solo habla con el proceso principal a
  través de un puente con funciones concretas (`electron/preload.cjs`), y cada
  canal valida lo que recibe.
- Las claves y tokens nunca llegan a la interfaz.
- Los correos HTML se sanean con DOMPurify y se muestran en un iframe sin
  scripts. Las imágenes remotas se bloquean hasta que pulsas "Mostrar", para
  que el remitente no sepa cuándo abres su correo. Los enlaces se abren en el
  navegador del sistema.
- Las herramientas de correo de Claude son de solo lectura, y el contenido de
  los correos se le pasa como información, nunca como instrucciones.

## Estructura

| Carpeta             | Qué contiene                                                                   |
| ------------------- | ------------------------------------------------------------------------------ |
| `electron/`         | Proceso principal: ventana, atajo, bandeja, OAuth de Gmail, ajustes cifrados.  |
| `src/compartido/`   | Lógica común a escritorio y web: Claude, cliente de Gmail, MIME y ajustes.     |
| `src/app/`          | Interfaz: diálogo, chat, correo, ajustes y modo de ejemplo.                    |
| `src/app/web/`      | Versión web: almacenamiento cifrado, Google Identity y service worker.         |
| `public/`           | Manifiesto e iconos de la PWA.                                                 |
| `src/kitsune/`      | El personaje 3D.                                                               |
| `src/preview/`      | Página de pruebas del personaje (`personaje.html`).                            |
| `test/`             | Pruebas de las utilidades de correo (`npm test`).                              |

### El personaje

Un zorro semirrealista generado por código con [three.js](https://threejs.org),
sin modelos ni texturas externas. La anatomía está hecha de tubos con perfil
propio (torso, cuello, cabeza, patas, colas), el pelo se dibuja por capas
instanciadas peinadas a favor del cuerpo, y la luz es física (ACES, sombras
reales y un entorno de estudio para los reflejos).

| Archivo        | Qué contiene                                                                    |
| -------------- | ------------------------------------------------------------------------------- |
| `Kitsune.js`   | Escena, luces, máquina de estados, acciones y micro-gestos.                     |
| `anatomia.js`  | Montaje del zorro y "pintores" del pelaje (pecho blanco, medias, lágrimas...). |
| `geometria.js` | Tubos de sección elíptica, orejas en cuenco y parches proyectados.             |
| `pelaje.js`    | Pelo por capas (shell texturing) con una sola llamada de dibujo por pieza.     |
| `ojo.js`       | Ojos y marca de la frente dibujados por shader: párpados, iris, pupila.        |
| `cola.js`      | Cada cola: tubo cuya columna se recalcula por cinemática directa.              |
| `fuegos.js`    | Kitsunebi: fuegos fatuos que orbitan con estela.                               |
| `paletas.js`   | Pelajes reales: zorro rojo (Carmesí), plateado (Sombra) y ártico (Nieve).      |
| `easing.js`    | Curvas de animación y suavizado interrumpible.                                 |
| `rendimiento.js` | Niveles de calidad y el gestor que los ajusta según los fotogramas.          |

| Estado     | Cuándo                                          |
| ---------- | ----------------------------------------------- |
| `reposo`   | Sin actividad: respira, parpadea, mueve orejas. |
| `escuchar` | Mientras escribes.                              |
| `pensar`   | Mientras Claude prepara la respuesta.           |
| `hablar`   | Mientras llega la respuesta.                    |
| `dormir`   | Tras unos minutos sin uso.                      |

| Acción        | Cuándo                               |
| ------------- | ------------------------------------ |
| `aparecer`    | Al pulsar el atajo.                  |
| `saludar`     | La primera vez de cada día.          |
| `alegria`     | Al llegar un correo nuevo.           |
| `desaparecer` | Al pulsar el atajo otra vez o `Esc`. |

Respeta `prefers-reduced-motion`: con movimiento reducido el balanceo de las
colas y los saltos se atenúan.
