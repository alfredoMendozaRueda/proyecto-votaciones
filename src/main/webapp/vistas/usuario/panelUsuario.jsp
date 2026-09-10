<%--
    Panel principal del votante.
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    if (!Boolean.TRUE.equals(session.getAttribute("isValido"))) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    session.setAttribute("rolDelUsu", "usuario");
    String tituloPagina = "Panel de usuario - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1>Panel de usuario</h1>
    <form action="<%= request.getContextPath() %>/servletRedirigirVotante" class="acciones">
        <input type="submit" name="accion" value="Votar">
        <input type="submit" name="accion" value="Ver resultados de las elecciones">
        <input type="submit" name="accion" value="Ver ganador de las elecciones">
        <input type="submit" name="accion" value="Salir de la aplicacion">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
