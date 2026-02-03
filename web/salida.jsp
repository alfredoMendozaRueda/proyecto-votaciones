<%-- 
    Document   : salida
    Created on : 11 nov 2025, 13:24:19
    Author     : ferre
--%>

<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%@page import="java.net.URLDecoder"%>
<%!String nombre;%>
<%!String nombreDecodificado;%>
<%
    Cookie[] cookies = request.getCookies();
    for (int i = 0; i < cookies.length; i++) {
        if (cookies[i].getName().equalsIgnoreCase("nombre")) {
            nombre = cookies[i].getValue();
        }
    }
    nombreDecodificado=URLDecoder.decode(nombre, "UTF-8");
    %>
<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Pagina de despedida</title>
        <link rel="stylesheet" href="styles/styles.css"/>
    </head>
    <body>
    <center>
        <h1>Hasta la proxima, <%=nombreDecodificado%></h1>
        </center>
    </body>
</html>
