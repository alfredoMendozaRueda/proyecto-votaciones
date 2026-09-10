<%--
    Candidatos censados en una localidad.
--%>
<%@page import="java.sql.SQLException"%>
<%@page import="java.util.List"%>
<%@page import="config.FabricaServicios"%>
<%@page import="excepciones.ElementoNoEncontradoExcepcion"%>
<%@page import="modelos.Candidato"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    if (!Boolean.TRUE.equals(session.getAttribute("isValido"))) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String nombreLocalidad = request.getParameter("localidad");
    List<Candidato> candidatos;
    try {
        candidatos = FabricaServicios.candidatoServicio().candidatosDeLocalidad(nombreLocalidad);
    } catch (ElementoNoEncontradoExcepcion e) {
        session.setAttribute("mensajeError", e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    } catch (SQLException e) {
        session.setAttribute("mensajeError", "Error de base de datos: " + e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String tituloPagina = "Candidatos - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container-ancho">
    <h1>Candidatos en <%= nombreLocalidad %></h1>
    <% if (candidatos.isEmpty()) { %>
    <p>No hay candidatos censados en esta localidad.</p>
    <% } else { %>
    <div class="tabla-responsive">
        <table>
            <thead>
                <tr>
                    <th>DNI</th>
                    <th>Nombre completo</th>
                    <th>Partido</th>
                    <th>Orden</th>
                </tr>
            </thead>
            <tbody>
                <% for (Candidato candidato : candidatos) { %>
                <tr>
                    <td><%= candidato.getDni() %></td>
                    <td><%= candidato.getNombreCompleto() %></td>
                    <td><%= candidato.getSiglasPartido() %></td>
                    <td><%= candidato.getOrden() %></td>
                </tr>
                <% } %>
            </tbody>
        </table>
    </div>
    <% } %>
    <form action="panelAnalista.jsp">
        <input type="submit" value="Volver al panel">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
