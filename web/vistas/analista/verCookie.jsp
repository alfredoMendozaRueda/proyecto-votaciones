<%-- 
    Document   : verCookie
    Created on : 2 dic 2025, 12:33:01
    Author     : ferre
--%>

<%@page import="java.sql.SQLException"%>
<%@page import="dao.ConexionBBDD"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%!String nombre;%>
<%Cookie[] cookies = request.getCookies();
    for (int i = 0; i < cookies.length; i++) {
        if (cookies[i].getName().equalsIgnoreCase("ganador")) {
            nombre = cookies[i].getValue();
        }
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
        <h1><%=nombre%></h1>
        <a href="panelAnalista.jsp">Volver</a>
    </body>
</html>
