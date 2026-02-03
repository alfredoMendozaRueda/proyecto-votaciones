<%-- 
    Document   : index
    Created on : 30 oct 2025, 12:43:22
    Author     : ferre
--%>

<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    session.setAttribute("volver", "normal");
    session.setAttribute("isValido", false);
    session.setAttribute("rolDelUsu", "");
%>
<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Inicio de sesión</title>
        <link rel="stylesheet" href="styles/styles.css">
        <style>
            a {
                color: #E0BBE4;
                text-decoration: none;
            }
            a:hover {
                color: #F8EAFB;
            }

        </style>
    </head>
    <body>
    <center>
        <h1>Inicio de sesión</h1>
        <form action="servletRedirigirRol" accept-charset="UTF-8">

            <br><label for="dni">DNI: </label> <input type="text" name="dni" maxlength="9" required>
            <br><br> <label for="dni">Contraseña </label> <input type="password" name="contrasena" required>
            <br><br><input type="submit" name="boton" value="Iniciar sesion">
        </form>
        <p>Si no tiene cuenta, registrese <a href="vistas/usuario/registro.jsp">aquí</a></p>
    </center>
</body>
</html>
