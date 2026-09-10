<%--
    Pagina generica de feedback para errores.
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    String tituloPagina = "Error - Sistema de Votaciones";
    String mensajeError = (String) session.getAttribute("mensajeError");
    String rolActual = (String) session.getAttribute("rolDelUsu");
    boolean volverAlIndex = "index".equalsIgnoreCase((String) session.getAttribute("volver"));
    session.removeAttribute("volver");

    String destinoVolver;
    if (volverAlIndex || rolActual == null) {
        destinoVolver = request.getContextPath() + "/index.jsp";
    } else if ("admin".equalsIgnoreCase(rolActual)) {
        destinoVolver = request.getContextPath() + "/vistas/admin/panelAdmin.jsp";
    } else if ("analista".equalsIgnoreCase(rolActual)) {
        destinoVolver = request.getContextPath() + "/vistas/analista/panelAnalista.jsp";
    } else if ("usuario".equalsIgnoreCase(rolActual) || "nuevoregistrado".equalsIgnoreCase(rolActual)) {
        destinoVolver = request.getContextPath() + "/vistas/usuario/panelUsuario.jsp";
    } else {
        destinoVolver = request.getContextPath() + "/index.jsp";
    }
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1>Vaya, algo no ha ido bien</h1>
    <h2 class="error"><%= mensajeError != null ? mensajeError : "Se ha producido un error inesperado." %></h2>
    <form action="<%= destinoVolver %>">
        <input type="submit" value="Volver">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
