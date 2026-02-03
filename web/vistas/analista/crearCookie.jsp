<%-- 
    Document   : crearCookie
    Created on : 2 dic 2025, 12:25:49
    Author     : ferre
--%>

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
        if (bbdd.getEstadoEleccion(bbdd.getIdEleccion()).equals("habilitada")) {
            session.setAttribute("mensajeError", "elecciones aun habilitadas, no se puede crear la cookie");
            response.sendRedirect("../../mensajesError.jsp");
        }
        if (bbdd.getEstadoEleccion(bbdd.getIdEleccion()).equals("inhabilitada")) {
            
            
            
            
            
            String ganadorElecciones=bbdd.partidoGanador();
           
            
            
                        Cookie miCookie = new Cookie("ganador", ganadorElecciones);
                        miCookie.setMaxAge(60 * 5);
                        response.addCookie(miCookie);
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
        <h1>Cookie realizada con exito</h1>
        <br>
        <a href="panelAnalista.jsp">volver</a>
    </body>
</html>
