<%-- 
    Document   : aniadirElecciones
    Created on : 4 nov 2025, 13:39:48
    Author     : ferre
--%>

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
        <title>Añadir elecciones</title>
        <link rel="stylesheet" href="../../styles/styles.css"/>
    </head>
    <body>
    <center>
        <h1>Añadir elecciones</h1>
        <form action="../../servletCreacionElecciones">
            <label>ID de eleccion</label><input type="text" name="id_elecciones" required>
            <label>Descripcion:</label><input type="text" name="descripcion" required>
            <label>Fecha en la que finalizará</label><input type="date" name="fecha_fin" required>
            <br><input type="submit" value="Crear nueva elección" >
        </form>
        
        <br>
        <form action="panelAdmin.jsp">
            <input type="submit" value="Volver panel">
        </form>
    </center>
    </body>
</html>
