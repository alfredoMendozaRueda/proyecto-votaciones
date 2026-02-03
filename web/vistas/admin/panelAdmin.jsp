<%-- 
    Document   : panelAdmin
    Created on : 30 oct 2025, 16:29:04
    Author     : ferre
--%>

<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
if (!(Boolean)session.getAttribute("isValido")) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect("../../mensajesError.jsp");
    }
%>
<%session.setAttribute("rolDelUsu","admin");%>
<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Página del admin</title>
        <link rel="stylesheet" href="../../styles/styles.css">
    </head>
    <body>
    <center>
        <h1>Panel de admin</h1>
        <%session.setAttribute("rolDelUsu","admin");%>
        <form action="../../servletRedirigirAccion" accept-charset="UTF-8">
            <input type="submit" name="accion" value="Gestion de partidos">
            <input type="submit" name="accion" value="Gestion de candidatos">
            <input type="submit" name="accion" value="Anadir elecciones">
            <input type="submit" name="accion" value="Votar">
            <input type="submit" name="accion" value="Habilitar, deshabilitar o eliminar elecciones">
            <input type="submit" name="accion" value="Ver resultado de las elecciones"> <br>
            <br><input type="submit" name="accion" value="Ver presidente ganador"> 
            <br>
           
            <br><input type="submit" name="accion" value="Ver censo"> 
            <br>
                  
            <br>
            <br>
            <br><input type="submit" name="accion" value="Salir de la aplicacion">           
            
            <br>
        </form>
        <br>
        <form action="../../index.jsp">
            <input type="submit" value="Volver al index">
        </form>
        </center>
    </body>
</html>
