<%--
    Panel principal del analista.
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    if (!Boolean.TRUE.equals(session.getAttribute("isValido"))) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    session.setAttribute("rolDelUsu", "analista");
    String tituloPagina = "Panel de analista - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1>Panel de analista</h1>
    <form action="<%= request.getContextPath() %>/servletGestionAnalista" class="acciones">
        <input type="submit" name="accion" value="Comprobar partidos">
        <input type="submit" name="accion" value="Dar de alta un nuevo partido">
        <input type="submit" name="accion" value="Ver candidatos por localidad">
        <input type="submit" name="accion" value="Obtener participacion">
        <input type="submit" name="accion" value="Ver porcentaje de participacion">
        <input type="submit" name="accion" value="Crear cookie">
        <input type="submit" name="accion" value="Ver cookie">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
