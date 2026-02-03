<%-- 
    Document   : panelUsuario
    Created on : 30 oct 2025, 16:29:11
    Author     : ferre
--%>

<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
if (!(Boolean)session.getAttribute("isValido")) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect("../../mensajesError.jsp");
    }
%>
<%session.setAttribute("rolDelUsu","usuario");%>

<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>JSP Page</title>
        <link rel="stylesheet" href="../../styles/styles.css">
    </head>
    <body>
    <center>
        <h1>Panel de usuario normal</h1>
        <form action="../../servletRedirigirVotante">
            <input type="submit" name="accion" value="Votar">
            <input type="submit" name="accion" value="Ver resultados de las elecciones">
            <input type="submit" name="accion" value="Ver ganador de las elecciones">
            <input type="submit" name="accion" value="Salir de la aplicacion">
        </form>
        
        <form action="../../index.jsp">
            <input type="submit" value="Volver al index">
        </form>
    </center>
    </body>
</html>
