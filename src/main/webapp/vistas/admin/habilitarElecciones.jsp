<%--
    Habilitar, deshabilitar o eliminar la eleccion.
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    if (!Boolean.TRUE.equals(session.getAttribute("isValido"))) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String tituloPagina = "Gestionar elecciones - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1>Habilitar, deshabilitar o eliminar elecciones</h1>
    <form action="<%= request.getContextPath() %>/servletHabilitacionElecciones" method="post">
        <label for="id_eleccion">ID de la elección</label>
        <input type="text" id="id_eleccion" name="id_eleccion" placeholder="Escriba el id de elección" required>
        <div class="acciones">
            <input type="submit" name="accion" value="habilitar">
            <input type="submit" name="accion" value="deshabilitar">
            <input type="submit" name="accion" value="eliminar">
        </div>
    </form>
    <hr class="separador">
    <form action="panelAdmin.jsp">
        <input type="submit" value="Volver al panel">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
