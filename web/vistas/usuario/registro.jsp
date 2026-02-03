<%-- 
    Document   : registro
    Created on : 30 oct 2025, 16:49:32
    Author     : ferre
--%>

<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%session.setAttribute("rolDelUsu","nuevoregistrado");%>
<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>JSP Page</title>
        <link rel="stylesheet" href="../../styles/styles.css">
    </head>
    <body>
    <center>
        <h1>Crear usuario</h1>
        <form action="../../servletRegistrarUsuario" accept-charset="UTF-8">
            <br>
            <label for="dni">DNI del usuario: </label> <input type="text" name="dni" maxlength="9" required>
            <br><br>
            <label for="contrasena">Contraseña del usuario: </label> <input type="password" required name="contrasena">
            <br><br><input type="submit" value="Registrarse">
        </form>
        <br>
        <form action="../../index.jsp">
            <input type="submit" value="Volver al index">
        </form>
    </center>
    </body>
</html>
