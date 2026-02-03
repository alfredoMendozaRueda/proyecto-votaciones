<%-- 
    Document   : gestionPartidos
    Created on : 4 nov 2025, 13:39:23
    Author     : ferre
--%>

<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
if (!(Boolean)session.getAttribute("isValido")) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect("../../mensajesError.jsp");
    }
%>
<%
/*
siglas (PK)        VARCHAR(10)
descripcion        VARCHAR(100)
imagen             VARCHAR(255)
*/
%>
<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>JSP Page</title>
        <link rel="stylesheet" href="../../styles/styles.css"/>
    </head>
    <body>
    <center>
        <h1>Gestión de partidos</h1>
        <form action="../../servletCrearPartidos" accept-charset="UTF-8">
            <input name="siglas" type="text" placeholder="siglas" required>
            <input name="descripcion" type="text" placeholder="descripcion del partido politico" required>
            <input name="imagen" type="text" placeholder="img(poner.jpg al final)" required>
            <input type="submit" value="Crear partido">
        </form>
        <br>
        
        <form action="panelAdmin.jsp">
            <input type="submit" value="Volver panel">
        </form>
    </center>
    </body>
</html>
