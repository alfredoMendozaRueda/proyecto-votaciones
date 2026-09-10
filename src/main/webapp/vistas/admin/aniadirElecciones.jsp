<%--
    Alta de la eleccion.
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    if (!Boolean.TRUE.equals(session.getAttribute("isValido"))) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String tituloPagina = "Añadir elecciones - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1>Añadir elección</h1>
    <form action="<%= request.getContextPath() %>/servletCreacionElecciones" method="post">
        <label for="id_elecciones">ID de elección</label>
        <input type="text" id="id_elecciones" name="id_elecciones" required>

        <label for="descripcion">Descripción</label>
        <input type="text" id="descripcion" name="descripcion" required>

        <label for="fecha_fin">Fecha en la que finalizará</label>
        <input type="date" id="fecha_fin" name="fecha_fin" required>

        <input type="submit" value="Crear nueva elección">
    </form>
    <hr class="separador">
    <form action="panelAdmin.jsp">
        <input type="submit" value="Volver al panel">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
