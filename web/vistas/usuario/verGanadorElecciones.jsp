<%-- 
    Document   : verGanadorElecciones
    Created on : 4 nov 2025, 13:41:08
    Author     : ferre
--%>
<%@page import="java.sql.SQLException"%>
<%@page import="dao.ConexionBBDD"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%!String presiGanador;%>
<%
    try {
        ConexionBBDD bbdd = new ConexionBBDD();
        if (bbdd.getEstadoEleccion(bbdd.getIdEleccion()).equals("habilitada")) {
            response.sendRedirect("../../mensajesError.jsp");
            session.setAttribute("mensajeError", "Elecciones aun habilitadas");
        }
        String ganadorElecciones=bbdd.partidoGanador();
        presiGanador=bbdd.presi(ganadorElecciones);
        bbdd.cerrarConexion();
    } catch (ClassNotFoundException e1) {
        session.setAttribute("mensajeError", e1.getMessage());
        response.sendRedirect("../../mensajesError.jsp");
    } catch (SQLException e2) {
        session.setAttribute("mensajeError", e2.getMessage());
        response.sendRedirect("../../mensajesError.jsp");
    }
    
    if (presiGanador.equals("")) {
        session.setAttribute("mensajeError", "No se encuentra ningun presidente ganador");
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
        <h1>Presidente ganador: <%=presiGanador%></h1>
        <h2></h2>
        <form action="panelUsuario.jsp">
            <input type="submit" value="Volver al panel">
        </form>
    </center>
</body>
</html>
