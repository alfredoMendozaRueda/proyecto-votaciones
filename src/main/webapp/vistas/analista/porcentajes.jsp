<%--
    Porcentaje de participacion por localidad.
--%>
<%@page import="java.sql.SQLException"%>
<%@page import="java.util.List"%>
<%@page import="config.FabricaServicios"%>
<%@page import="excepciones.ElementoNoEncontradoExcepcion"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    if (!Boolean.TRUE.equals(session.getAttribute("isValido"))) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    List<String> localidades;
    try {
        localidades = FabricaServicios.censoServicio().localidades();
    } catch (SQLException e) {
        session.setAttribute("mensajeError", "Error de base de datos: " + e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String tituloPagina = "Porcentaje de participación - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container-ancho">
    <h1>Porcentaje de participación</h1>
    <div class="tabla-responsive">
        <table>
            <thead>
                <tr>
                    <th>Localidad</th>
                    <th>Participación</th>
                </tr>
            </thead>
            <tbody>
                <%
                    for (String localidad : localidades) {
                        double porcentaje;
                        try {
                            porcentaje = FabricaServicios.participacionServicio().porcentajeParticipacion(localidad);
                        } catch (ElementoNoEncontradoExcepcion | SQLException e) {
                            continue;
                        }
                %>
                <tr>
                    <td><%= localidad %></td>
                    <td><%= String.format("%.2f%%", porcentaje) %></td>
                </tr>
                <% } %>
            </tbody>
        </table>
    </div>
    <form action="panelAnalista.jsp">
        <input type="submit" value="Volver al panel">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
