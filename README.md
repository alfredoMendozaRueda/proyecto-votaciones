# Proyecto e-Votaciones

## Descripción general

**Proyecto e-Votaciones** es una aplicación web desarrollada en **Java** que simula el proceso de unas **elecciones generales**, permitiendo el registro de votantes, la gestión electoral y la obtención de resultados finales de forma controlada y segura.

El sistema se basa en partidos políticos y candidatos, y a través de las votaciones de los ciudadanos inscritos en el censo se determina:

* El número de votos obtenidos por cada partido.
* El **Presidente del Gobierno**, que será el **candidato nº1 del partido con mayor número de votos**.

La aplicación sigue una arquitectura en capas (**Servlets/JSP → Servicios → Repositorios → JDBC**), construida con **Maven**, utilizando **Java, HTML y CSS**.

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

* Arquitectura en capas: los **servlets** son controladores finos que delegan en la capa de **servicios** (reglas de negocio), que a su vez depende de **interfaces de repositorio** implementadas con JDBC (`repositorios.jdbc`). Los servlets y JSP solo conocen las interfaces, nunca el driver JDBC directamente.
* Cada operación de negocio con reglas propias (login, registro, voto, alta de eleccion/candidato...) tiene su propia **excepción de dominio** en el paquete `excepciones`, en vez de comprobaciones dispersas de booleanos.
* La contraseña se cifra a través de la interfaz `seguridad.EncriptadorContrasena` (implementación MD5 por compatibilidad con los datos existentes; ver aviso de seguridad en `EncriptadorMd5`).
* Los recuentos de resultados (global, por localidad, por comunidad) y el porcentaje de participación se calculan con una única consulta SQL agregada por caso, evitando los bucles N+1 de la versión original.
* Uso de **sentencias preparadas** para evitar **SQL Injection**.
* Uso de **cookies**:

  * Al cerrar sesión se muestra un mensaje de despedida agradeciendo la visita y mostrando el nombre del usuario.
* Interfaz desarrollada con **HTML y CSS**, con una hoja de estilos común y fragmentos JSP reutilizables (`WEB-INF/incluidos`) para la cabecera y el pie de cada página.

---

## Tecnologías utilizadas

* Java 11 (Servlets 4.0 / JSP)
* Maven
* HTML5
* CSS3
* MySQL / MariaDB
* JUnit 5 + Mockito + AssertJ (tests unitarios)

---

## Cómo ejecutar el proyecto

### Requisitos

* JDK 11+
* Maven 3.6+
* Un servidor MySQL/MariaDB con la base de datos de `database/bbdd_amr_elecciones.sql` importada
* Un contenedor de servlets compatible con Servlet 4.0 (p. ej. Tomcat 9 o GlassFish 5)

### Configuración de la base de datos

La conexión ya no lleva credenciales fijas en el código: se configura con variables de entorno (o propiedades de sistema equivalentes), con valores por defecto pensados para desarrollo local:

| Variable | Por defecto |
|---|---|
| `DB_URL` | `jdbc:mysql://localhost:3306/bbdd_amr_elecciones?useUnicode=true&characterEncoding=UTF-8` |
| `DB_USUARIO` | `root` |
| `DB_CONTRASENA` | (vacío) |

### Compilar y probar

```bash
mvn test        # ejecuta la batería de tests JUnit5 + Mockito
mvn package      # genera target/proyecto-votaciones.war
```

Despliega el `.war` generado en tu servidor de aplicaciones habitual.

---

## Conclusión

El proyecto **e-Votaciones** implementa un sistema completo de simulación electoral, cumpliendo con los requisitos funcionales y técnicos del módulo de **Desarrollo Web en Entorno Servidor**, aplicando buenas prácticas de programación, seguridad y arquitectura de software.
Usuarios de prueba:
admin: 23456789M y constraseña: password
usuario normal: 12345678Z y contraseña: password
