<%-- 
    Document   : verCandidatosLocalidad
    Created on : 2 dic 2025, 10:31:31
    Author     : ferre
--%>

<%@page import="java.sql.SQLException"%>
<%@page import="dao.ConexionBBDD"%>
<%@page import="java.util.ArrayList"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%!ArrayList<String> localidades;%>
<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>JSP Page</title>
        <link rel="stylesheet" href="../../styles/styles.css"/>
    </head>
    <body>
    <center>
        <form action="verCandidatos.jsp">
            <select name="localidad">
                <%try {
                        ConexionBBDD bbdd = new ConexionBBDD();
                        localidades = bbdd.getLocalidades();
                        bbdd.cerrarConexion();
                    } catch (ClassNotFoundException e1) {
                        session.setAttribute("mensajeError", e1.getMessage());
                        response.sendRedirect("../../mensajesError.jsp");
                    } catch (SQLException e2) {
                        session.setAttribute("mensajeError", e2.getMessage());
                        response.sendRedirect("../../mensajesError.jsp");
                    }
                %>
                <% for (int i = 0; i < localidades.size(); i++) {%>
                <option value="<%= localidades.get(i)%>"><%= localidades.get(i)%></option>
                <% }%>
            </select>
            <input type="submit" value="Ver">
        </form>
    </center>
</body>
</html>
