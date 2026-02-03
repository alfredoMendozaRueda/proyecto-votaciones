<%-- 
    Document   : verCandidatos
    Created on : 2 dic 2025, 11:04:39
    Author     : ferre
--%>

<%@page import="java.sql.SQLException"%>
<%@page import="dao.ConexionBBDD"%>
<%@page import="java.util.ArrayList"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%!ArrayList<String> infoCandidatos;%>


<%
 try {
     String nombreLoc=request.getParameter("localidad");
        ConexionBBDD bbdd = new ConexionBBDD();
       String id_localidad=bbdd.getId_loc(nombreLoc);
       ArrayList<String> dnisLocalidad=bbdd.dnisLocalidad(id_localidad);
       ArrayList<String> dnisCandidatos=bbdd.dniCandidatos(dnisLocalidad);
       infoCandidatos=bbdd.infoCandidatos(dnisCandidatos);
        bbdd.cerrarConexion();
    } catch (ClassNotFoundException e1) {
        session.setAttribute("mensajeError", e1.getMessage());
        response.sendRedirect("../../mensajesError.jsp");
    } catch (SQLException e2) {
        session.setAttribute("mensajeError", e2.getMessage());
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
        
        <%
        for (int i = 0; i < infoCandidatos.size(); i++) {
                %><%=infoCandidatos.get(i)%><br><%
            }
        %> 
    </center>
    </body>
</html>
