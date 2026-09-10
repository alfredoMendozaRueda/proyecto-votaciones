<%--
    Selector de ambito para consultar resultados (admin).
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
    List<String> comunidades;
    try {
        String idEleccion = FabricaServicios.eleccionServicio().idEleccionActual().orElse(null);
        if (idEleccion == null || !FabricaServicios.eleccionServicio().estaHabilitada(idEleccion)) {
            session.setAttribute("mensajeError", "Las elecciones todavía están habilitadas o no existen");
            response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
            return;
        }
        localidades = FabricaServicios.censoServicio().localidades();
        comunidades = FabricaServicios.censoServicio().comunidades();
    } catch (SQLException e) {
        session.setAttribute("mensajeError", "Error de base de datos: " + e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String tituloPagina = "Ver resultados - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1>Ver resultados de</h1>
    <form action="<%= request.getContextPath() %>/servletVerResultados" accept-charset="UTF-8">
        <div class="acciones">
            <input type="submit" name="accion" value="todo">
        </div>
        <hr class="separador">
        <label for="localidad">Por localidad</label>
        <select id="localidad" name="localidad">
            <% for (String localidad : localidades) { %>
            <option value="<%= localidad %>"><%= localidad %></option>
            <% } %>
        </select>
        <input type="submit" name="accion" value="localidades">

        <hr class="separador">
        <label for="comunidad">Por comunidad</label>
        <select id="comunidad" name="comunidad">
            <% for (String comunidad : comunidades) { %>
            <option value="<%= comunidad %>"><%= comunidad %></option>
            <% } %>
        </select>
        <input type="submit" name="accion" value="comunidades">
    </form>
    <hr class="separador">
    <form action="panelAdmin.jsp">
        <input type="submit" value="Volver al panel">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
