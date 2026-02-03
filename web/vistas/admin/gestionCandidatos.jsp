<%-- 
    Document   : gestionCandidatos
    Created on : 4 nov 2025, 13:39:35
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
        <title>JSP Page</title>
        <link rel="stylesheet" href="../../styles/styles.css"/>
    </head>
    <body>
    <center>
        <h1>GESTIÓN DE CANDIDATOS</h1>
        <form action="../../servletAniadirCandidatos" accept-charset="UTF-8">
            <label>DNI:</label><input type="text" name="dni" maxlength="9" required><br>
            <label>Nombre completo</label><input type="text" name="nombre_completo" required><br>
            <label>Siglas de su partido</label><input type="text" name="siglas_partido" required><br>
            <label>Orden que tiene</label><input type="number" name="orden" min="1" max="3" required>
            <input type="submit" value="Registrar candidato">
        </form>
        <br>
        
        <form action="panelAdmin.jsp">
            <input type="submit" value="Volver panel">
        </form>
    </center>
    </body>
</html>
