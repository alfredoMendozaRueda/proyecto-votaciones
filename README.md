# Proyecto e-Votaciones

## Descripción general

**Proyecto e-Votaciones** es una aplicación web desarrollada en **Java** que simula el proceso de unas **elecciones generales**, permitiendo el registro de votantes, la gestión electoral y la obtención de resultados finales de forma controlada y segura.

El sistema se basa en partidos políticos y candidatos, y a través de las votaciones de los ciudadanos inscritos en el censo se determina:

* El número de votos obtenidos por cada partido.
* El **Presidente del Gobierno**, que será el **candidato nº1 del partido con mayor número de votos**.

La aplicación es un proyecto **Spring Boot** (arquitectura **Controladores MVC → Servicios → Repositorios Spring Data JPA**), con vistas **Thymeleaf** y autenticación/autorización por rol con **Spring Security**.

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

* **Arquitectura en capas**: los **controladores** (`web`) son finos y delegan en la capa de **servicios** (`servicios`, anotada `@Service`/`@Transactional`), que a su vez depende de **interfaces de repositorio Spring Data JPA** (`repositorios`, `extends JpaRepository`). Los controladores y plantillas no conocen JPA/SQL, solo las interfaces de servicio.
* **Persistencia con Spring Data JPA**: las entidades (`modelos`) están anotadas con JPA; los recuentos de resultados (global, por localidad, por comunidad) y el porcentaje de participación se calculan con una única consulta SQL agregada por caso (nativa u JPQL), evitando los bucles N+1 de la versión original basada en JDBC manual.
* **Spring Security**: login por formulario (DNI + contraseña) respaldado por un `UserDetailsService` propio y control de acceso declarativo por rol (`ROLE_ADMIN`, `ROLE_ANALISTA`, `ROLE_VOTANTE`) en `SecurityConfig`, con protección CSRF activa en todos los formularios.
* La contraseña se verifica a través de un `PasswordEncoder` (`Md5PasswordEncoder`) que envuelve `seguridad.EncriptadorContrasena` (implementación MD5 por compatibilidad con los datos existentes; ver aviso de seguridad en `EncriptadorMd5`).
* Cada operación de negocio con reglas propias (registro, voto, alta de elección/candidato...) tiene su propia **excepción de dominio** en el paquete `excepciones`; un `@ControllerAdvice` (`ManejadorErroresGlobal`) las traduce a la página de error compartida, en vez de repetir un try/catch en cada controlador.
* Uso de **sentencias preparadas / JPQL parametrizado** para evitar **SQL Injection**.
* Vistas con **Thymeleaf**, con un fragmento de cabecera reutilizable (`fragments/barra.html`) y hojas de estilos comunes en `static/css`.
* Al cerrar sesión (`/logout`) se invalida la sesión y se muestra una página de despedida con el nombre del usuario (leído de una cookie).

---

## Tecnologías utilizadas

* Java 17 · Spring Boot 3
* Spring MVC, Spring Data JPA (Hibernate), Spring Security, Thymeleaf
* MySQL / MariaDB (H2 en memoria para los tests)
* Maven
* JUnit 5 + Mockito + AssertJ + Spring Test / MockMvc (tests unitarios y de integración)

---

## Cómo ejecutar el proyecto

### Requisitos

* JDK 17+
* Maven 3.6+
* Un servidor MySQL/MariaDB con la base de datos de `database/bbdd_amr_elecciones.sql` importada

### Configuración de la base de datos

La conexión no lleva credenciales fijas en el código: se configura con variables de entorno, con valores por defecto pensados para desarrollo local:

| Variable | Por defecto |
|---|---|
| `DB_URL` | `jdbc:mysql://localhost:3306/bbdd_amr_elecciones?useUnicode=true&characterEncoding=UTF-8` |
| `DB_USUARIO` | `root` |
| `DB_CONTRASENA` | (vacío) |
| `SERVER_PORT` | `8080` |

### Compilar, probar y ejecutar

```bash
mvn test               # ejecuta la batería de tests (unitarios + integración con H2)
mvn spring-boot:run    # arranca la aplicación en http://localhost:8080
mvn package             # genera target/proyecto-votaciones-<version>.jar ejecutable
java -jar target/proyecto-votaciones-2.0.0.jar
```

No requiere desplegar en un servidor externo: el jar incluye un Tomcat embebido.

---

## Conclusión

El proyecto **e-Votaciones** implementa un sistema completo de simulación electoral, cumpliendo con los requisitos funcionales y técnicos del módulo de **Desarrollo Web en Entorno Servidor**, aplicando buenas prácticas de programación, seguridad y arquitectura de software.
Usuarios de prueba:
admin: 23456789M y constraseña: password
usuario normal: 12345678Z y contraseña: password
