# Kitsune · asistente de escritorio

Asistente personal para Windows protagonizado por un kitsune 3D de nueve colas.
Con `Ctrl + Alt + K` aparece abajo a la izquierda de la pantalla y, encima de
él, un diálogo en rojo y negro para hablar con Claude y llevar el correo de
Gmail sin salir de ahí.

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

`npm run dev` abre la interfaz en el navegador en **modo de ejemplo** (correos
y respuestas inventados), útil para trabajar en el diseño sin cuentas reales.
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

| Carpeta         | Qué contiene                                                                   |
| --------------- | ------------------------------------------------------------------------------ |
| `electron/`     | Proceso principal: ventana, atajo, bandeja, Claude, Gmail, ajustes cifrados.  |
| `src/app/`      | Interfaz: diálogo, chat, correo, ajustes y modo de ejemplo.                   |
| `src/kitsune/`  | El personaje 3D.                                                               |
| `src/preview/`  | Página de pruebas del personaje (`personaje.html`).                            |
| `test/`         | Pruebas de las utilidades de correo (`npm test`).                              |

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
