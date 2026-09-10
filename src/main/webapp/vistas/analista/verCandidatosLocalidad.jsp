<%--
    Selector de localidad para ver sus candidatos.
--%>
<%@page import="java.sql.SQLException"%>
<%@page import="java.util.List"%>
<%@page import="config.FabricaServicios"%>
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
    String tituloPagina = "Candidatos por localidad - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1>Candidatos por localidad</h1>
    <form action="verCandidatos.jsp">
        <label for="localidad">Localidad</label>
        <select id="localidad" name="localidad">
            <% for (String localidad : localidades) { %>
            <option value="<%= localidad %>"><%= localidad %></option>
            <% } %>
        </select>
        <input type="submit" value="Ver">
    </form>
    <hr class="separador">
    <form action="panelAnalista.jsp">
        <input type="submit" value="Volver al panel">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
