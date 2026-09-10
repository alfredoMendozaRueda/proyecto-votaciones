<%--
    Resultados de la eleccion filtrados por localidad (admin).
--%>
<%@page import="java.sql.SQLException"%>
<%@page import="java.util.List"%>
<%@page import="config.FabricaServicios"%>
<%@page import="excepciones.ElementoNoEncontradoExcepcion"%>
<%@page import="modelos.ResultadoPartido"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    if (!Boolean.TRUE.equals(session.getAttribute("isValido"))) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String nombreLocalidad = (String) session.getAttribute("nombre_localidad");
    List<ResultadoPartido> resultados;
    try {
        resultados = FabricaServicios.resultadosServicio().resultadosPorLocalidad(nombreLocalidad);
    } catch (ElementoNoEncontradoExcepcion e) {
        session.setAttribute("mensajeError", e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    } catch (SQLException e) {
        session.setAttribute("mensajeError", "Error de base de datos: " + e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String tituloPagina = "Resultados por localidad - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container-ancho">
    <h1>Resultados en <%= nombreLocalidad %></h1>
    <div class="tabla-responsive">
        <table>
            <thead>
                <tr>
                    <th>Partido político</th>
                    <th>Número de votos</th>
                </tr>
            </thead>
            <tbody>
                <% for (ResultadoPartido resultado : resultados) { %>
                <tr>
                    <td><%= resultado.getSiglas() %></td>
                    <td><%= resultado.getVotos() %></td>
                </tr>
                <% } %>
            </tbody>
        </table>
    </div>
    <form action="panelAdmin.jsp">
        <input type="submit" value="Volver al panel">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
