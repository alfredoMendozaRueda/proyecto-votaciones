<%-- 
    Document   : panelAnalista
    Created on : 2 dic 2025, 9:50:06
    Author     : ferre
--%>

<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%session.setAttribute("rolDelUsu","analista");%>
<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>JSP Page</title>
        <link rel="stylesheet" href="../../styles/styles.css"/>
    </head>
    <body>
    <center>
        <form action="../../servletGestionAnalista">
        
            <input type="submit" name="accion" value="Comprobar partidos">
            <input type="submit" name="accion" value="Dar de alta un nuevo partido">
            <input type="submit" name="accion" value="Ver candidatos por localidad">
            <input type="submit" name="accion" value="Obtener participacion">
            <input type="submit" name="accion" value="Ver porcentaje de participacion">
            <input type="submit" name="accion" value="Crear cookie">
            <input type="submit" name="accion" value="Ver cookie">
        </form>
    </center>
    </body>
</html>
