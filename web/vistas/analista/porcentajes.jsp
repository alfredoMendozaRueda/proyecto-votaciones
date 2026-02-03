<%-- 
    Document   : porcentajes
    Created on : 2 dic 2025, 13:22:59
    Author     : ferre
--%>

<%@page import="java.util.ArrayList"%>
<%@page import="java.sql.SQLException"%>
<%@page import="dao.ConexionBBDD"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>JSP Page</title>
        <link rel="stylesheet" href="../../styles/styles.css"/>
    </head>
    <body>
        
        
        
        
       <%
       try {
        ConexionBBDD bbdd = new ConexionBBDD();
        ArrayList<String> localidades= bbdd.getLocalidades();
        for (int i = 0; i < localidades.size(); i++) {
       %><p> La localidad: <%=localidades.get(i)%> tiene un porcentaje de: <%=bbdd.porcentajes(localidades.get(i))%></p><%
            }
       bbdd.cerrarConexion();
    } catch (ClassNotFoundException e1) {
        session.setAttribute("mensajeError", e1.getMessage());
        response.sendRedirect("../../mensajesError.jsp");
    } catch (SQLException e2) {
        session.setAttribute("mensajeError", e2.getMessage());
        response.sendRedirect("../../mensajesError.jsp");
    }
       
       %>
    </body>
</html>
