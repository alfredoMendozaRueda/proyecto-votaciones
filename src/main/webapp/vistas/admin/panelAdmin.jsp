<%--
    Panel principal del administrador.
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    if (!Boolean.TRUE.equals(session.getAttribute("isValido"))) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    session.setAttribute("rolDelUsu", "admin");
    String tituloPagina = "Panel de administración - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1>Panel de administración</h1>
    <form action="<%= request.getContextPath() %>/servletRedirigirAccion" accept-charset="UTF-8" class="acciones">
        <input type="submit" name="accion" value="Gestion de partidos">
        <input type="submit" name="accion" value="Gestion de candidatos">
        <input type="submit" name="accion" value="Anadir elecciones">
        <input type="submit" name="accion" value="Habilitar, deshabilitar o eliminar elecciones">
        <input type="submit" name="accion" value="Votar">
        <input type="submit" name="accion" value="Ver resultado de las elecciones">
        <input type="submit" name="accion" value="Ver presidente ganador">
        <input type="submit" name="accion" value="Ver censo">
        <input type="submit" name="accion" value="Salir de la aplicacion">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
