# Kitsune · asistente personal

Asistente personal protagonizado por un kitsune 3D de nueve colas. En Windows,
con `Ctrl + Alt + K` aparece abajo a la izquierda de la pantalla y, encima de
él, un diálogo en rojo y negro para hablar con Claude y llevar el correo de
Gmail sin salir de ahí. En el móvil es una app web instalable (PWA): tocas el
icono y el zorro aparece abajo con el diálogo encima, a pantalla completa.

Esta rama es un proyecto independiente del sistema de votaciones: no comparte
historial ni código con `main`.

## Qué hace

El diálogo tiene seis apartados en una barra bajo la cabecera (con el teclado,
las flechas pasan de uno a otro):

| Apartado          | Qué hay                                                                                   |
| ----------------- | ----------------------------------------------------------------------------------------- |
| **Chat**          | La conversación con Kitsune.                                                              |
| **Correo**        | La bandeja de Gmail.                                                                      |
| **Agenda**        | Google Calendar por días (14 días, ampliable), crear eventos a mano y borrarlos.          |
| **Recordatorios** | Los pendientes, alta rápida («en 1 hora», «mañana a las 9») y borrar. Insignia con los de hoy. |
| **Memoria**       | Lo que Kitsune sabe de ti: añadir, olvidar, olvidarlo todo y apagarla.                    |
| **Historial**     | Las últimas 50 conversaciones, con buscador: ábrelas para seguir donde lo dejaste.        |

Todo lo que se borra pide un segundo toque para confirmar.

- **Atajo global** (`Ctrl + Alt + K`, configurable): el zorro aparece con su
  animación; pulsarlo otra vez o `Esc` lo oculta. Vive en la bandeja del
  sistema y puede arrancar con Windows.
- **Chat con Claude**: respuestas en tiempo real, con el zorro escuchando,
  pensando y hablando. Puede leer tu correo (solo lectura) para resumirlo o
  contestarte preguntas sobre él, y leer las respuestas en voz alta. En el
  móvil puedes dictarle con el micrófono: al terminar de hablar, lo envía.
- **Recordatorios**: «recuérdame llamar a Lucía mañana a las 10». Claude lo
  apunta con una herramienta y, a su hora, el zorro salta y llega una
  notificación. Se pueden deshacer desde el chat o borrar en Ajustes.
- **Memoria**: «recuerda que mi hermana se llama Ana». Kitsune guarda datos y
  preferencias (cifrados) y los tiene en cuenta en cada conversación. Se ven,
  se borran o se pausan en Ajustes → Memoria.
- **Búsqueda en internet**: tiempo, noticias, precios u horarios, con los
  enlaces a las fuentes debajo de la respuesta. Usa la herramienta de búsqueda
  de la API de Claude (cada búsqueda tiene un pequeño coste); se puede apagar.
- **Google Calendar**: «¿qué tengo esta semana?», «añade el tren a mi
  calendario». Antes de crear un evento aparece una tarjeta para confirmarlo;
  sin tu «Añadir» no se crea nada. Avisa un cuarto de hora antes de cada cita.
- **Acciones con texto**: en Windows, copia un texto y llama a Kitsune con el
  atajo: te propone Resumir, Traducir, Mejorar o Explicar. En el móvil, lo
  mismo con "Compartir → Kitsune". Cada respuesta tiene un botón para copiarla.
- **Pulso del día**: la primera vez que lo abres cada día te ofrece un
  resumen de tu jornada: lo urgente del correo, recordatorios de hoy y mañana
  y una sugerencia. Solo se pide al pulsar el botón (no gasta sin permiso).
- **Historial de conversaciones**: cada conversación se guarda cifrada (en
  Windows con el sistema; en el navegador con AES-GCM). Si la última es de
  hace menos de 12 horas, al abrir Kitsune sigue con ella.
- **Compartir y atajos** (móvil instalado): "Compartir → Kitsune" desde
  cualquier app deja el texto o enlace listo para que lo resuma; manteniendo
  pulsado el icono aparecen "Pulso del día" y "Correo".
- **Correo**: bandeja tipo Gmail con búsqueda, filtros (recibidos, no leídos,
  destacados), lectura, responder, redactar, archivar, papelera y destacados.
  Los correos nuevos hacen saltar al zorro y muestran una notificación.
- **Ajustes**: pelaje, tamaño, posición, calidad del pelo, fuegos fatuos,
  mirada, atajo, inicio con Windows, sueño, voz, pulso del día,
  recordatorios, clave y modelo de Claude, personalidad y cuenta de Gmail.

## Instalar en Windows

Descarga **Kitsune-Setup.exe** de la página de descargas del repositorio
(Releases → «Kitsune para Windows»). Se compila sola con cada cambio en esta
rama (`.github/workflows/windows.yml`).

1. Abre el instalador. Como no está firmado, Windows puede mostrar «Windows
   protegió tu PC»: pulsa **Más información** → **Ejecutar de todas formas**.
2. Sigue el asistente (puedes elegir la carpeta).
3. Pulsa **Ctrl + Alt + K**: aparece el zorro. Vive en la bandeja del sistema,
   junto al reloj; desde ahí también están Ajustes y Salir.

Para desinstalarlo: Configuración de Windows → Aplicaciones → Kitsune.

## Puesta en marcha (desarrollo)

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

### Conectar la IA

Kitsune funciona con dos IA; se elige en Ajustes → Inteligencia artificial.

**Groq (gratis, la opción por defecto)**

1. Crea una clave gratis, sin tarjeta, en [console.groq.com](https://console.groq.com) → API Keys → Create API Key.
2. En Kitsune: Ajustes → Inteligencia artificial → Groq → pega la clave y pulsa Guardar.

Usa modelos abiertos (GPT-OSS 120B por defecto; también Llama 3.3 70B y
GPT-OSS 20B) con las mismas herramientas: correo, agenda, recordatorios y
memoria. No tiene búsqueda web, y la capa gratuita limita las peticiones por
minuto y por día: si se llega al límite, Kitsune lo avisa. En conversaciones
largas solo se envía la parte reciente.

**Claude (de pago)**

1. Crea una clave en [console.anthropic.com](https://console.anthropic.com), en API Keys.
2. En Kitsune: Ajustes → Inteligencia artificial → Claude → pega la clave y pulsa Guardar.

El modelo por defecto es Claude Opus 5.5; puedes cambiar a Sonnet 5.5 (más
rápido) o Haiku 5.5 (más económico). Incluye búsqueda web.

Las claves se comprueban antes de guardarlas y se guardan cifradas con el
sistema (DPAPI en Windows), cada una por separado.

### Conectar Gmail y Google Calendar

Kitsune trae su propio proyecto de Google: cada persona solo pulsa
**Ajustes → Google → Conectar con Google**, elige su cuenta y acepta. Una vez.
Cada uno ve únicamente su correo y su agenda; nada pasa por ningún servidor
de Kitsune.

Mientras la app no esté verificada por Google, la pantalla de permisos avisa
de que «Google no ha verificado esta aplicación»: hay que pulsar
**Configuración avanzada → Ir a Kitsune**. Google permite hasta 100 personas
en una app sin verificar.

Kitsune pide `gmail.modify` (leer, marcar, archivar, mover a la papelera y
enviar; nunca borrar para siempre) y `calendar.events` (ver y crear eventos).
En Windows el token se guarda cifrado y no caduca; en la versión web Google
da sesiones de una hora, que Kitsune renueva sola al tocar Correo, Agenda o
enviar un mensaje (la ventana de Google se abre y se cierra sola).

Quien prefiera su propio proyecto de Google Cloud puede ponerlo en
**Ajustes → Google → Usar mi propio proyecto de Google**.

### Configurar el proyecto de Google (una sola vez, quien publica la app)

1. En [Google Cloud Console](https://console.cloud.google.com/) crea un
   proyecto «Kitsune» y activa **Gmail API** y **Google Calendar API**.
2. En **Google Auth Platform**: nombre «Kitsune», público **Externo**. En
   **Data Access** añade los permisos
   `https://www.googleapis.com/auth/gmail.modify` y
   `https://www.googleapis.com/auth/calendar.events`. En **Audience**, pulsa
   **Publish app** (en modo «Testing» las sesiones caducan cada 7 días).
3. En **Clients** crea dos clientes OAuth:
   - **Aplicación web**, con el origen autorizado `https://alfredomendozarueda.github.io`.
   - **App de escritorio**.
4. En GitHub, **Settings → Secrets and variables → Actions**:
   - Variables: `GOOGLE_WEB_CLIENT_ID` y `GOOGLE_DESKTOP_CLIENT_ID`.
   - Secret: `GOOGLE_DESKTOP_CLIENT_SECRET`.
5. Vuelve a lanzar los flujos «Kitsune web» y «Kitsune para Windows»: los
   identificadores quedan dentro de la web y del instalador
   (`scripts/google.mjs`). La web nunca recibe el secreto del cliente de
   escritorio; ese va dentro del instalador, como en cualquier app instalada
   (Google no lo trata como confidencial y el inicio de sesión usa PKCE).

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
- **Gmail y Calendar**: igual que en escritorio, «Conectar con Google» y
  elegir la cuenta.

Diferencias con la versión de escritorio:

- Google da a las aplicaciones web sesiones de una hora; Kitsune la renueva
  al tocar Correo, Agenda o enviar un mensaje, sin volver a pedir permisos.
- Los avisos de correo nuevo llegan como notificaciones mientras la app está
  abierta o en segundo plano reciente; con la app cerrada el sistema no la
  despierta (haría falta un servidor propio).
- Los recordatorios suenan con la app abierta o en segundo plano reciente;
  si el móvil la había cerrado, avisa de los atrasados al volver a abrirla.
- "Compartir → Kitsune" solo existe en Android (iPhone no lo permite a las
  apps web). El dictado necesita conexión.
- No hay atajo global, bandeja del sistema ni inicio automático.
- La app abre sin conexión, pero hablar con Claude o ver el correo necesita red.

## Rendimiento

El zorro ajusta solo su coste:

- **Calidad automática**: mide cuánto tarda cada fotograma y baja (o sube) la
  resolución, las capas de pelo y las sombras hasta ir fluido. Se puede fijar
  a mano en Ajustes → Calidad gráfica. En móviles empieza un nivel por debajo.
- **Gestos sin coste extra**: los gestos en reposo y las caricias reutilizan
  el mismo esqueleto y unos pocos sprites; no añaden llamadas de dibujo
  pesadas.
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
  correos, eventos y páginas web se le pasa como información, nunca como
  instrucciones.
- Lo único que Claude puede escribir fuera de Kitsune es un evento del
  calendario, y solo después de que pulses "Añadir" en la tarjeta.
- La memoria va cifrada (sistema en Windows, AES-GCM en el navegador). El
  portapapeles solo se lee en el momento de llamar a Kitsune con el atajo, y
  el texto no sale del equipo hasta que eliges una acción.

## Estructura

| Carpeta             | Qué contiene                                                                   |
| ------------------- | ------------------------------------------------------------------------------ |
| `electron/`         | Proceso principal: ventana, atajo, bandeja, OAuth de Gmail, ajustes cifrados.  |
| `src/compartido/`   | Lógica común a escritorio y web: Claude, Gmail, Calendar, memoria, recordatorios, historial, MIME y ajustes. |
| `src/app/`          | Interfaz: diálogo, chat, correo, apartados (`vistas.js`), ajustes y modo de ejemplo. |
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
| `caricia`     | Al arrastrar el dedo o el ratón sobre él: cierra los ojos a gusto, echa las orejas atrás y suelta corazones. Mientras sigues, no para. |
| `bostezo`     | Solo, en reposo (más a menudo de noche).    |
| `curiosear`   | Solo, en reposo: mira a un lado y a otro.   |
| `sacudir`     | Solo, en reposo: sacude las colas.          |

Al hablar, la boca sigue al texto que llega de Claude (y, con la voz
activada, a cada palabra pronunciada) en vez de moverse en bucle.

Respeta `prefers-reduced-motion`: con movimiento reducido el balanceo de las
colas y los saltos se atenúan.
