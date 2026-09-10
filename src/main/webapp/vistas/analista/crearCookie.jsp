<%--
    Crea una cookie con el partido ganador, una vez cerrada la eleccion.
--%>
<%@page import="java.sql.SQLException"%>
<%@page import="java.util.Optional"%>
<%@page import="config.FabricaServicios"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    if (!Boolean.TRUE.equals(session.getAttribute("isValido"))) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    try {
        String idEleccion = FabricaServicios.eleccionServicio().idEleccionActual().orElse(null);
        if (idEleccion != null && FabricaServicios.eleccionServicio().estaHabilitada(idEleccion)) {
            session.setAttribute("mensajeError", "Las elecciones aún están habilitadas, no se puede crear la cookie");
            response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
            return;
        }
        Optional<String> ganador = FabricaServicios.resultadosServicio().partidoGanador()
                .map(resultado -> resultado.getSiglas());
        if (ganador.isPresent()) {
            Cookie cookieGanador = new Cookie("ganador", ganador.get());
            cookieGanador.setMaxAge(60 * 5);
            response.addCookie(cookieGanador);
        }
    } catch (SQLException e) {
        session.setAttribute("mensajeError", "Error de base de datos: " + e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String tituloPagina = "Cookie creada - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1 class="success">Cookie creada con éxito</h1>
    <form action="panelAnalista.jsp">
        <input type="submit" value="Volver al panel">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
