<%--
    Resultados globales de la eleccion.
--%>
<%@page import="java.sql.SQLException"%>
<%@page import="java.util.List"%>
<%@page import="config.FabricaServicios"%>
<%@page import="modelos.ResultadoPartido"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    List<ResultadoPartido> resultados;
    try {
        resultados = FabricaServicios.resultadosServicio().resultadosGlobales();
    } catch (SQLException e) {
        session.setAttribute("mensajeError", "Error de base de datos: " + e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String tituloPagina = "Resultados generales - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container-ancho">
    <h1>Resultados generales</h1>
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
    <form action="panelUsuario.jsp">
        <input type="submit" value="Volver al panel">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
