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
- **Apple Salud → Forma**: un Atajo del iPhone manda tus pasos y los pesajes
  de la báscula (ver más abajo).
- **Voz natural** para que Kitsune lea sus respuestas: voces en español de Aura-2
  (Deepgram) con Workers AI. El plan gratuito da para unas 3.500 letras al día;
  después usa MeloTTS, más sencilla y casi sin límite.

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

## Apple Salud (pasos y báscula) para Forma

Un Atajo del iPhone llama a `POST https://<tu-servidor>.workers.dev/integraciones/salud`
con un token personal. Todo se gestiona desde la app, en **Forma → Perfil →
Integraciones**:

1. **Generar token.** El token (`forma_…`) se enseña una sola vez. El servidor
   solo guarda su huella SHA-256. Solo vale para `/integraciones/…` y admite
   60 envíos por hora. Se puede revocar desde la misma pantalla.
2. **Cómo configurar el Atajo.** La guía trae la dirección, las cabeceras, el
   JSON y los pasos en iOS.

Cabeceras: `Authorization: Bearer forma_…` y `Content-Type: application/json`.

```json
{
  "fuente": "apple_salud",
  "dias": [{ "fecha": "2026-11-19", "pasos": 11234 }, { "fecha": "2026-11-20", "pasos": 4321 }],
  "pesaje": { "fecha_hora": "2026-11-20T08:12:00+01:00", "peso_kg": 77.55, "grasa_pct": 22.9, "masa_magra_kg": 59.8 }
}
```

También vale un formato **plano**, más fácil de montar en Atajos, porque no
lleva listas y las fechas de los días las pone el servidor:

```json
{ "pasos_hoy": 4321, "pasos_ayer": 11234, "peso_kg": 77.55, "grasa_pct": 22.9, "masa_magra_kg": 59.8, "fecha_peso": "20 nov 2026, 8:12" }
```

En este formato:

- **Campos vacíos:** se ignoran. Si no hay peso, no se manda pesaje, pero los
  pasos se guardan igual.
- **`fecha_peso`:** vale en ISO 8601 o tal como la escribe el iPhone en español.

Reglas del envío:

- **Pasos:** son el total de cada día y se reemplazan; repetir un envío no
  duplica nada. Valen de 0 a 100.000.
- **Peso:** de 30 a 300 kg.
- **% de grasa:** de 3 a 60. Si llega como fracción (0,229), se multiplica por 100.
- **Números:** pueden ir como número o como texto, con coma decimal («77,55»).
- **Fecha y hora:** sin zona se entiende en la de Ajustes (Europe/Madrid).
- **Pesaje repetido:** el mismo peso con menos de un minuto de diferencia no se
  vuelve a guardar.
- **Todo o nada:** si un dato no vale, responde 400 con el campo y el motivo, y
  no guarda nada.

Si todo va bien, responde `{"pasos_guardados": 2, "pesaje": "guardado" | "duplicado" | "no_enviado"}`.

**Privacidad.** El servidor no puede leer tus datos de salud:

- Cifra cada envío (ECDH P-256 + HKDF + AES-GCM) con la llave pública del buzón.
- La llave privada solo está en tus dispositivos, dentro de los datos de Forma,
  que viajan cifrados al sincronizar.
- Los envíos esperan en la tabla `buzon_salud` hasta que la app los recoge, al
  abrir Forma o al volver a ella. Si nadie los recoge, se borran a los 60 días.
- Para responder «duplicado» guarda solo una huella HMAC de cada pesaje, que se
  borra a los 120 días.

## Coste

Entra de sobra en el plan gratuito de Cloudflare:

- **Revisiones:** una por minuto, son 1.440 al día.
- **Peticiones:** el límite son 100.000 al día.
- **Base de datos D1:** también gratuita.

Las automatizaciones que crean eventos desde el correo usan tu clave de Groq,
también gratuita.

La voz usa los 10.000 «neuronas» diarias gratuitas de Workers AI: unas 3.500
letras con Aura-2. Si se gastan, sigue con MeloTTS hasta el día siguiente.

## Desarrollo

```sh
cd servidor
printf 'CLAVE_CIFRADO=%s\n' "$(node -e "process.stdout.write(require('crypto').randomBytes(32).toString('base64url'))")" > .dev.vars
npx wrangler@4 d1 execute kitsune --local --file esquema.sql
npx wrangler@4 dev --local --test-scheduled   # /__scheduled lanza la revisión
```

Las pruebas (`npm test` en la raíz) simulan D1 con el SQLite de Node, y Google,
Groq y el servicio de push con un `fetch` falso.
