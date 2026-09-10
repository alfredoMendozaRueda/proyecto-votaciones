<%--
    Resultados de la eleccion filtrados por comunidad.
--%>
<%@page import="java.sql.SQLException"%>
<%@page import="java.util.List"%>
<%@page import="config.FabricaServicios"%>
<%@page import="excepciones.ElementoNoEncontradoExcepcion"%>
<%@page import="modelos.ResultadoPartido"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    String nombreComunidad = (String) session.getAttribute("nombre_comunidad");
    List<ResultadoPartido> resultados;
    try {
        resultados = FabricaServicios.resultadosServicio().resultadosPorComunidad(nombreComunidad);
    } catch (ElementoNoEncontradoExcepcion e) {
        session.setAttribute("mensajeError", e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    } catch (SQLException e) {
        session.setAttribute("mensajeError", "Error de base de datos: " + e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String tituloPagina = "Resultados por comunidad - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container-ancho">
    <h1>Resultados en <%= nombreComunidad %></h1>
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
