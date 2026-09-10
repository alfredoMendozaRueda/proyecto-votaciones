<%--
    Presidente ganador de la eleccion.
--%>
<%@page import="java.sql.SQLException"%>
<%@page import="java.util.Optional"%>
<%@page import="config.FabricaServicios"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    String presidenteGanador;
    try {
        String idEleccion = FabricaServicios.eleccionServicio().idEleccionActual().orElse(null);
        if (idEleccion == null || FabricaServicios.eleccionServicio().estaHabilitada(idEleccion)) {
            session.setAttribute("mensajeError", "Las elecciones todavía están habilitadas o no existen");
            response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
            return;
        }
        Optional<String> ganador = FabricaServicios.resultadosServicio().presidenteGanador();
        if (!ganador.isPresent()) {
            session.setAttribute("mensajeError", "No se encuentra ningún presidente ganador");
            response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
            return;
        }
        presidenteGanador = ganador.get();
    } catch (SQLException e) {
        session.setAttribute("mensajeError", "Error de base de datos: " + e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String tituloPagina = "Presidente ganador - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1>Presidente ganador</h1>
    <p class="success"><%= presidenteGanador %></p>
    <form action="panelUsuario.jsp">
        <input type="submit" value="Volver al panel">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
