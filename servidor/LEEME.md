# Servidor de avisos de Kitsune

Es un pequeño servidor tuyo, gratuito, en Cloudflare Workers. Hace lo que la app
no puede hacer cuando está cerrada:

- **Notificaciones push en el iPhone** (y en cualquier navegador): correos nuevos,
  citas que se acercan y recordatorios.
- **Automatizaciones**, por ejemplo:
  - «cuando llegue una reserva, ponla en mi agenda»;
  - «avísame media hora antes de cada cita»;
  - «el resumen del día a las 8»;
  - «archiva los boletines».
- **Revisión cada minuto**: recordatorios, correo, citas y automatizaciones.

Solo tiene acceso tu cuenta: la primera cuenta de Google que lo conecta es la
dueña. El permiso de Google y tu clave de Groq se guardan cifrados con una clave
que solo existe en los secretos del Worker.

## Montarlo, una sola vez

### 1. Cloudflare

1. Crea una cuenta gratuita en <https://dash.cloudflare.com>.
2. Abre **Workers y Pages** una vez. Así se crea tu subdominio `workers.dev`.
3. Copia tu **ID de cuenta** (Account ID). Aparece en la columna derecha de
   *Workers y Pages*, o en la URL del panel.
4. Ve a **Mi perfil → Tokens de API → Crear token → «Editar Cloudflare Workers»**.
5. Añade también el permiso **Cuenta · D1 · Editar**.
6. Crea el token y cópialo.

### 2. Google Cloud (el proyecto de Kitsune)

1. Abre **API y servicios → Credenciales** y entra en el **cliente OAuth web** de
   Kitsune.
2. Copia el **Secreto del cliente**.

### 3. GitHub

Ve a **Settings → Secrets and variables → Actions → New repository secret** y
crea estos tres secretos:

| Secreto | Valor |
| --- | --- |
| `CLOUDFLARE_API_TOKEN` | el token del paso 1 |
| `CLOUDFLARE_ACCOUNT_ID` | el ID de cuenta del paso 1 |
| `GOOGLE_WEB_CLIENT_SECRET` | el secreto del cliente web de Google |

Hay una variable opcional, `KITSUNE_DUENO_EMAIL` (pestaña *Variables*). Si la
creas con tu correo de Google, solo esa cuenta podrá conectarlo.

### 4. Desplegar

1. Ve a **Actions → «Kitsune servidor» → Run workflow**, en la rama
   `kitsune-asistente`. También se lanza solo cada vez que cambia `servidor/`.
2. Al terminar, el resumen del flujo muestra la dirección del servidor, algo
   como `https://kitsune.tu-cuenta.workers.dev`.
3. La dirección se guarda en `servidor/url.txt` y la app web y la de Windows se
   vuelven a publicar con ella.

### 5. Dos ajustes en Google Cloud

1. En el mismo **cliente OAuth web**, añade en *URI de redireccionamiento
   autorizados* la dirección que salió en el resumen, terminada en
   `/google/vuelta`. Por ejemplo: `https://kitsune.tu-cuenta.workers.dev/google/vuelta`.
2. Abre **Pantalla de consentimiento de OAuth** y comprueba que el estado de
   publicación es **En producción**. Si está «En prueba», Google retira el
   permiso del servidor cada 7 días.

### 6. En el iPhone

1. Abre Kitsune desde el icono de la pantalla de inicio. Si aún no lo tienes, en
   Safari pulsa Compartir → *Añadir a pantalla de inicio*.
2. Ve a **Ajustes → Avisos en el móvil → Conectar los avisos** y acepta en
   Google. Después vuelve a Kitsune.
3. Pulsa **Activar avisos en este iPhone** y permite las notificaciones. Te
   llegará un aviso de prueba.

En **Avisos → Automatizaciones** tienes plantillas para empezar.

### 7. En Windows (opcional)

1. En el móvil ve a **Ajustes → Avisos en el móvil → Vincular otro dispositivo**.
2. Escribe el código de 6 cifras en el mismo sitio de la app de Windows.

Así el ordenador manda sus recordatorios al servidor y puede gestionar las
automatizaciones.

## Coste

Entra de sobra en el plan gratuito de Cloudflare:

- **Revisiones:** una por minuto, son 1.440 al día.
- **Peticiones:** el límite son 100.000 al día.
- **Base de datos D1:** también gratuita.

Las automatizaciones que crean eventos desde el correo usan tu clave de Groq,
también gratuita.

## Desarrollo

```sh
cd servidor
printf 'CLAVE_CIFRADO=%s\n' "$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))")" > .dev.vars
npx wrangler@4 d1 execute kitsune --local --file esquema.sql
npx wrangler@4 dev --local --test-scheduled   # /__scheduled lanza la revisión
```

Las pruebas (`npm test` en la raíz) simulan D1 con el SQLite de Node, y Google,
Groq y el servicio de push con un `fetch` falso.
