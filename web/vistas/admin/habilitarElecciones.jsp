<%-- 
    Document   : habilitarElecciones
    Created on : 4 nov 2025, 13:40:44
    Author     : ferre
--%>

<%@page import="java.sql.SQLException"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
if (!(Boolean)session.getAttribute("isValido")) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect("../../mensajesError.jsp");
    }
%>

<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Deshabilitar y habilitar elecciones</title>
        <link rel="stylesheet" href="../../styles/styles.css"/>
    </head>
    <body>
    <center>
        <h1>Deshabilitar y habilitar elecciones</h1>
        <form action="../../servletHabilitacionElecciones">
            <input type="text" name="id_eleccion" placeholder="Escriba el id de eleccion" required><br>
            <input type="submit" name="accion" value="habilitar">
            <input type="submit" name="accion" value="deshabilitar">
            <input type="submit" name="accion" value="eliminar">
        </form>
       <br>
        <form action="panelAdmin.jsp">
            <input type="submit" value="Volver panel">
        </form>
    </center>
    </body>
</html>
