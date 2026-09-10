# Proyecto e-Votaciones

## Descripción general

**Proyecto e-Votaciones** es una aplicación web desarrollada en **Java** que simula el proceso de unas **elecciones generales**, permitiendo el registro de votantes, la gestión electoral y la obtención de resultados finales de forma controlada y segura.

El sistema se basa en partidos políticos y candidatos, y a través de las votaciones de los ciudadanos inscritos en el censo se determina:

* El número de votos obtenidos por cada partido.
* El **Presidente del Gobierno**, que será el **candidato nº1 del partido con mayor número de votos**.

La aplicación tiene dos partes independientes:

* Un **backend Spring Boot** que expone una **API REST en JSON** (arquitectura **Controladores → Servicios → Repositorios Spring Data JPA**), con autenticación por sesión y autorización por rol con **Spring Security**.
* Un **frontend Angular** (`frontend/`), una SPA independiente que consume esa API y se sirve desde el mismo origen que el backend en producción (empaquetada dentro del propio jar).

---

## Roles de usuario

El sistema distingue **dos tipos de usuarios**, cada uno con funcionalidades específicas:

### Administrador

El administrador es el encargado de que el proceso electoral se desarrolle correctamente.

Funciones principales:

* **Gestión de partidos políticos**

  * Alta de al menos **cuatro partidos políticos**.
* **Gestión de candidatos**

  * Alta de **tres candidatos por partido político**.
* **Gestión de elecciones**

  * Crear y modificar elecciones.
  * Las elecciones se crean inicialmente en estado **Inhabilitadas**.
* **Habilitación e inhabilitación de las elecciones**

  * Habilitar el inicio de las votaciones.
  * Inhabilitar las elecciones cuando se desee finalizar la votación.
* **Presentación de resultados**

  * Solo disponible cuando las elecciones están **Inhabilitadas**.
  * Visualización de resultados por:

    * Comunidad Autónoma
    * Localidad
    * Total nacional
* **Listados del censo**

  * Censo completo
  * Por comunidades autónomas
  * Por localidades
* **Votar**

  * El administrador también puede ejercer su derecho al voto.

---

### Votante

El votante puede participar en el proceso electoral una vez registrado.

Funciones disponibles:

* **Registro de usuario**

  * El password se almacena **encriptado en MD5**.
  * Se comprueba:

    * Que el votante esté inscrito en el censo.
    * Que sea mayor de edad.
    * Que el DNI no esté registrado previamente.
  * En caso de ser menor de edad se lanza la excepción personalizada:

    * `MenorEdadExcepcion`, indicando los años del votante.
  * El sistema devuelve un mensaje indicando si el alta ha sido correcta o fallida.
* **Votar**

  * Elección de un partido político.
  * El voto queda registrado y **no puede volver a votar**.
* **Consultar resultados**

  * Solo disponible cuando las elecciones están **Inhabilitadas**.

---

## Estados de las elecciones

Las elecciones pueden encontrarse en uno de los siguientes estados:

* **Inhabilitadas**: No se permite votar y se pueden consultar los resultados.
* **Habilitadas**: Los votantes pueden ejercer su voto.

---

## Base de datos

### 📐 Diseño

* Base de datos relacional diseñada para gestionar:

  * Usuarios
  * Censo
  * Partidos políticos
  * Candidatos
  * Elecciones
  * Votos
  * Comunidades autónomas y localidades

### 🧾 Nombre de la base de datos

El nombre de la base de datos sigue el formato:

```
bbdd_amr_elecciones
```

(donde `xxx` son las iniciales del nombre y apellidos del autor, en mi caso amr)

### 🛠 Gestión de datos iniciales

* Los datos de:

  * Comunidades autónomas
  * Localidades
  * Personas censadas
* Se insertan manualmente desde **PHPMyAdmin**.

---

## Proceso de votación

### 1. Habilitación de las elecciones

* El administrador cambia el estado de las elecciones a **Habilitadas**.
* Los votantes se autentican mediante **DNI y contraseña**.
* Se controla que el votante **no haya votado previamente**.
* El voto se registra correctamente y se informa al usuario.

### 2. Inhabilitación de las elecciones

* El administrador cambia el estado de las elecciones a **Inhabilitadas**.
* No se admiten más votos.

### 3. Resultados

* Se muestran los votos obtenidos por cada partido.
* A partir de los resultados:

  * Se determina el partido ganador.
  * Se obtiene el **Presidente del Gobierno** usando el candidato nº1 del partido ganador.
* Los resultados pueden ser consultados por **cualquier votante registrado**.

---

## Aspectos de implementación

### Backend

* **Arquitectura en capas**: los **controladores REST** (`web`, `@RestController`) son finos y delegan en la capa de **servicios** (`servicios`, anotada `@Service`/`@Transactional`), que a su vez depende de **interfaces de repositorio Spring Data JPA** (`repositorios`, `extends JpaRepository`). Los controladores solo conocen las interfaces de servicio, nunca JPA/SQL directamente.
* **API JSON**: cada pantalla del front tiene su propio endpoint bajo `/api/**`; las peticiones y respuestas se modelan con **records** de Java (`web/dto`). Documentada automáticamente con **springdoc-openapi**: Swagger UI en `/swagger-ui.html`, especificación OpenAPI en `/v3/api-docs` (la autenticación es por cookie de sesión, no Bearer token — para probar un endpoint protegido desde Swagger UI hay que iniciar sesión antes en la propia app, mismo origen).
* **Persistencia con Spring Data JPA**: las entidades (`modelos`) están anotadas con JPA; los recuentos de resultados (global, por localidad, por comunidad) y el porcentaje de participación se calculan con una única consulta SQL agregada por caso (nativa u JPQL), evitando los bucles N+1 de la versión original basada en JDBC manual.
* **Spring Security para SPA**: sin `formLogin` ni vistas de error propias del backend. El login es un `POST /api/auth/login` en JSON que autentica manualmente contra un `AuthenticationManager` y persiste la sesión en una cookie `JSESSIONID`; `GET /api/auth/me` permite a Angular recuperar la sesión activa al recargar la página. Control de acceso declarativo por rol (`ROLE_ADMIN`, `ROLE_ANALISTA`, `ROLE_VOTANTE`) en `SecurityConfig`. Protección CSRF activa mediante cookie `XSRF-TOKEN` legible por JavaScript (patrón *double submit cookie* que el `HttpClient` de Angular rellena automáticamente en la cabecera `X-XSRF-TOKEN`); los errores de autenticación/autorización devuelven `401`/`403` sin cuerpo en vez de redirigir a una página de login.
* La contraseña se verifica a través de un `PasswordEncoder` (`Md5PasswordEncoder`) que envuelve `seguridad.EncriptadorContrasena` (implementación MD5 por compatibilidad con los datos existentes; ver aviso de seguridad en `EncriptadorMd5`).
* Cada operación de negocio con reglas propias (registro, voto, alta de elección/candidato...) tiene su propia **excepción de dominio** en el paquete `excepciones`; un `@RestControllerAdvice` (`ManejadorErroresGlobal`) las traduce a una respuesta JSON `{"mensaje": "..."}` con el código HTTP adecuado (`404`, `409`, `422`), en vez de un `500` genérico o de repetir un try/catch en cada controlador.
* Uso de **sentencias preparadas / JPQL parametrizado** para evitar **SQL Injection**.
* **Mensajería con RabbitMQ**: cuando ocurre un evento electoral relevante (se registra un voto, se habilita o deshabilita una elección) se publica un mensaje a un *exchange* de tipo topic (`elecciones.eventos`), a través de la interfaz `notificaciones.EventoElectoralPublicador` (implementación `RabbitEventoElectoralPublicador`) — los servicios no dependen de RabbitMQ directamente, igual que con `EncriptadorContrasena`. Incluye un consumidor de referencia (`EventoElectoralLogListener`) suscrito a todos los eventos, a modo de auditoría y como prueba de que la infraestructura funciona de extremo a extremo; otros consumidores (email, un dashboard en tiempo real...) pueden añadir su propia cola al mismo exchange sin tocar el código que publica. Es un canal **best-effort**: si el broker no está disponible, la app arranca igual (`RabbitAdmin` con `ignoreDeclarationExceptions`) y un fallo al publicar solo se registra como aviso, nunca hace fallar la operación de negocio que lo originó.

### Frontend

* **Angular** (standalone components, sin `NgModule`), con **routing basado en hash** (`#/...`) para no requerir configuración de rutas en el servidor.
* Estado de sesión con **signals** (`AuthService`), guards funcionales por rol (`authGuard`, `roleGuard`) y un interceptor HTTP que redirige a `/login` ante una respuesta `401`.
* Un servicio Angular por recurso de la API (`partido`, `candidato`, `censo`, `resultados`, `elecciones`, `participacion`, `cookie-ganador`...), todos consumiendo `HttpClient` sobre `/api/**`.
* UI con **Bootstrap 5**: `frontend/src/styles.css` se limita a los tokens de marca (variables `--bs-*`, paleta violeta/oro) y a los detalles que Bootstrap no trae de fábrica (animaciones, panel de login); el resto son clases y componentes de Bootstrap directamente en las plantillas. El menú móvil se colapsa con una signal propia en vez del JS de Bootstrap, para no cargar ~70 kB de más por un simple toggle.
* **ESLint** (`@angular-eslint` + `typescript-eslint`) y **Prettier** para lint/formato; tests unitarios con **Karma + Jasmine** para la capa `core/` (servicios, guards, interceptor).

---

## Tecnologías utilizadas

* **Backend**: Java 17 · Spring Boot 3 (Spring Web, Spring Data JPA/Hibernate, Spring Security, Spring AMQP) · Maven · springdoc-openapi (Swagger UI)
* **Frontend**: Angular · TypeScript · RxJS · Bootstrap 5 · ESLint + Prettier · Karma + Jasmine
* MySQL / MariaDB (H2 en memoria para los tests y para previsualizar sin base de datos externa)
* **RabbitMQ** para la mensajería de eventos electorales
* JUnit 5 + Mockito + AssertJ + Spring Test / MockMvc (tests unitarios y de integración del backend)

---

## Cómo ejecutar el proyecto

### La forma rápida: todo con Docker

Si solo tienes Docker instalado (nada de Java, Node, MySQL ni RabbitMQ), esto levanta el stack completo — app, base de datos con los datos de ejemplo ya importados, y RabbitMQ:

```bash
./run-stack.sh
```

Es un wrapper fino sobre `docker compose up --build` que además comprueba que Docker esté instalado y arrancado antes de intentarlo. Equivalente directo con `docker compose` por si lo prefieres:

```bash
docker compose up --build
```

* App: <http://localhost:8080> (usuarios de prueba más abajo)
* Panel de RabbitMQ: <http://localhost:15672> (`guest`/`guest`)
* MySQL: `localhost:3306` (`root`/`rootpass`)

La primera vez tarda unos minutos (compila Angular y el backend dentro de la imagen); las siguientes veces solo reconstruye lo que haya cambiado.

```bash
./run-stack.sh -d          # igual, pero en segundo plano
./run-stack.sh logs        # sigue los logs de todos los servicios (o de uno: logs app)
./run-stack.sh down        # para y elimina los contenedores
./run-stack.sh down -v     # además borra el volumen de datos de MySQL, para partir del dump original
```

El resto de esta sección explica cómo trabajar sin Docker (día a día en desarrollo) y cómo desplegarlo de verdad en internet.

### Requisitos

* JDK 17+
* Maven 3.6+
* Node.js 20+ y npm (solo para trabajar en el frontend o generar el jar con el front incluido)
* Un servidor MySQL/MariaDB con la base de datos de `database/bbdd_amr_elecciones.sql` importada
* Un broker RabbitMQ (opcional: si no está disponible, la app arranca igual y las notificaciones simplemente no se publican — ver más abajo)

### Configuración de la base de datos y RabbitMQ

Ninguna credencial va fija en el código: todo se configura con variables de entorno, con valores por defecto pensados para desarrollo local:

| Variable | Por defecto |
|---|---|
| `DB_URL` | `jdbc:mysql://localhost:3306/bbdd_amr_elecciones?useUnicode=true&characterEncoding=UTF-8` |
| `DB_USUARIO` | `root` |
| `DB_CONTRASENA` | (vacío) |
| `RABBITMQ_HOST` | `localhost` |
| `RABBITMQ_PORT` | `5672` |
| `RABBITMQ_USUARIO` | `guest` |
| `RABBITMQ_CONTRASENA` | `guest` |
| `SERVER_PORT` | `8080` |

Para levantar solo RabbitMQ (por ejemplo si el backend lo ejecutas tú directamente con `mvn spring-boot:run`, como en la sección siguiente):

```bash
docker compose up -d rabbitmq
```

### Desarrollo: dos servidores en paralelo

Durante el desarrollo, el backend y el frontend se ejecutan por separado; Angular usa un proxy (`frontend/proxy.conf.json`) para redirigir `/api` y `/imagenes` al backend, así que en el navegador todo parece servido desde el mismo origen.

```bash
mvn test               # ejecuta la batería de tests del backend (unitarios + integración con H2)
mvn spring-boot:run    # arranca el backend en http://localhost:8080

cd frontend
npm install
npm start               # arranca el frontend (con proxy a la API) en http://localhost:4200
```

Abre `http://localhost:4200` mientras desarrollas: los cambios en Angular se recargan al vuelo y las llamadas a `/api` llegan al backend en el puerto 8080.

### Calidad del frontend: lint, formato y tests

```bash
cd frontend
npm run lint            # ESLint (@angular-eslint + typescript-eslint)
npm run format:check    # Prettier, sin escribir cambios ('npm run format' sí los aplica)
npm test                # Karma + Jasmine en modo watch (navegador real)
npm run test:ci         # igual, pero sin watch y con el Chromium de Puppeteer sin sandbox
                         # (headless, pensado para CI/contenedores; ver frontend/scripts/chrome-headless-ci.sh)
```

Los tests unitarios cubren de momento la capa `core/` (servicios, guards e interceptor de autenticación) — donde vive la lógica con más impacto si se rompe — en vez de cada componente de pantalla uno a uno.

Para correr toda la batería del proyecto (backend + frontend) en un único comando, en vez de ir mandando cada uno por separado:

```bash
./run-tests.sh              # mvn test + lint + format:check + test:ci
./run-tests.sh --backend    # solo mvn test
./run-tests.sh --frontend   # solo lint + format:check + test:ci
```

Es justo lo que ejecuta el hook de `pre-push` (backend) más las comprobaciones de frontend que añade el CI.

### Git hooks

El repositorio incluye hooks de Git versionados en `.githooks/` (no en `.git/hooks`, que no se comparte al clonar). Actívalos una sola vez por clon:

```bash
git config core.hooksPath .githooks
```

* **`pre-commit`**: rápido, solo mira lo que está en el *stage*. Bloquea marcas de conflicto sin resolver y ficheros que parecen credenciales (`.env`, `*.pem`, `id_rsa`...); si hay `.java` o `pom.xml` en el commit, comprueba que el backend compila (`mvn test-compile`); si hay `.ts`/`.html`/`.css` de `frontend/src`, comprueba el formato con Prettier (`npm run format` lo arregla) y, si son `.ts`/`.html`, que pasan ESLint.
* **`pre-push`**: más lento pero exhaustivo, igual que el CI — ejecuta `mvn test` (backend) y `ng build` (frontend) antes de dejar salir el push.

Ambos se pueden saltar puntualmente con `--no-verify` (`git commit --no-verify`, `git push --no-verify`) cuando de verdad haga falta.

### Producción: un único jar ejecutable

El perfil Maven `frontend` compila Angular y copia el resultado dentro de `src/main/resources/static`, de modo que Spring Boot sirve la SPA y la API desde el mismo origen (sin problemas de CORS) y todo queda empaquetado en un único jar:

```bash
mvn clean package -Pfrontend   # compila el front (npm install + ng build) y lo empaqueta en el jar
java -jar target/proyecto-votaciones-2.0.0.jar
```

Sin este perfil (`mvn package` a secas), el jar se genera solo con el backend y sin necesidad de tener Node instalado, útil para iterar rápido en el día a día en Java.

No requiere desplegar en un servidor externo: el jar incluye un Tomcat embebido.

### Despliegue gratuito (Docker + Render)

El repositorio incluye un `Dockerfile` multi-stage (compila Angular, compila el jar con el front ya embebido y genera una imagen final mínima con solo el JRE) y un `render.yaml` para desplegar en [Render](https://render.com) con su tier gratuito:

1. Crea una base de datos MySQL gratuita en algún proveedor externo (Render no ofrece MySQL gestionado, solo PostgreSQL) — por ejemplo [db4free.net](https://www.db4free.net) o [freesqldatabase.com](https://www.freesqldatabase.com), pensados justo para proyectos de prueba/hobby. Importa `database/bbdd_amr_elecciones.sql` con el phpMyAdmin que te den.
2. En Render: **New +** → **Blueprint**, conecta tu cuenta de GitHub y selecciona este repositorio (Render detecta `render.yaml` automáticamente).
3. Al desplegar, Render te pedirá rellenar `DB_URL`, `DB_USUARIO` y `DB_CONTRASENA` con los datos que te dio el proveedor de MySQL (el formato de `DB_URL` es el mismo que en local: `jdbc:mysql://<host>:<puerto>/<nombre_bd>?useUnicode=true&characterEncoding=UTF-8`).
4. Render construye la imagen Docker y publica la app en una URL `https://<nombre>.onrender.com`.

RabbitMQ es opcional: si no configuras `RABBITMQ_HOST` en Render, la app arranca igual y simplemente no llega a publicar las notificaciones (se registra un aviso en el log, nada más). Si quieres que funcionen, añade también `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USUARIO` y `RABBITMQ_CONTRASENA` apuntando a un broker gratuito externo (por ejemplo CloudAMQP, que ofrece un plan gratuito pequeño pensado para esto).

Ten en cuenta las limitaciones propias de un tier gratuito: el servicio "duerme" tras un rato de inactividad (la primera petición tras dormir tarda unos segundos en responder) y las bases de datos gratuitas de terceros suelen tener límites de almacenamiento pequeños — para un proyecto en producción real, conviene pasar a un plan de pago.

### CI/CD

El workflow `.github/workflows/ci-cd.yml` de GitHub Actions hace tres cosas:

1. **En cada push (a cualquier rama) y en cada pull request**: ejecuta `mvn test` (los tests del backend) y, para el frontend, `npm audit --audit-level=high`, `npm run lint`, `npm run format:check`, `npm run test:ci` y `npm run build`, en ese orden — cualquiera de ellos que falle detiene el job, como comprobación de que nada se ha roto ni se ha colado una dependencia con una vulnerabilidad conocida.
2. **Solo en un push a `main`** (la rama por defecto de este repositorio — ojo, **no** se llama `master`) y solo si el punto anterior ha pasado: envía un correo avisando de que el push ha superado los tests, con el commit, el autor y el mensaje.
3. El despliegue en sí **no** lo dispara este workflow: si conectaste Render por Blueprint como se explica arriba, Render ya despliega automáticamente en cada push a la rama conectada (su "auto-deploy" nativo) — no hace falta ningún paso extra aquí. El correo, por tanto, avisa de que el push ha pasado los tests y de que el despliegue en Render se disparará solo, no confirma que Render haya terminado de desplegar (Render no se lo comunica a GitHub Actions).

Además, `.github/dependabot.yml` revisa semanalmente las dependencias de Maven, npm (`frontend/`) y las propias GitHub Actions del workflow, abriendo un PR cuando hay una versión nueva o una vulnerabilidad conocida — así no depende de que alguien acuerde ejecutar `npm audit` a mano. Para que también lleguen alertas de seguridad fuera de esas PRs semanales, conviene activar **Settings → Code security → Dependabot alerts** en el repositorio (es un interruptor, no requiere ningún fichero).

Para que el envío de correo funcione, añade estos secrets en **Settings → Secrets and variables → Actions** del repositorio:

| Secret | Valor |
|---|---|
| `MAIL_USERNAME` | Tu dirección de Gmail (el remitente) |
| `MAIL_PASSWORD` | Una **contraseña de aplicación** de Gmail (no tu contraseña normal) — se genera en [myaccount.google.com/apppasswords](https://myaccount.google.com/apppasswords), requiere tener activada la verificación en dos pasos |
| `NOTIFY_EMAIL` | La dirección a la que quieres que llegue el aviso |

Si no añades estos secrets, los jobs de tests siguen funcionando igual; solo falla (o se salta) el paso de enviar el correo.

---

## Conclusión

El proyecto **e-Votaciones** implementa un sistema completo de simulación electoral, cumpliendo con los requisitos funcionales y técnicos del módulo de **Desarrollo Web en Entorno Servidor**, aplicando buenas prácticas de programación, seguridad y arquitectura de software.
Usuarios de prueba:
admin: 23456789M y constraseña: password
usuario normal: 12345678Z y contraseña: password
