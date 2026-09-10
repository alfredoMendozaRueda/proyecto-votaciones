<%--
    Alta de partidos politicos.
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    if (!Boolean.TRUE.equals(session.getAttribute("isValido"))) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String tituloPagina = "Gestión de partidos - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1>Gestión de partidos</h1>
    <form action="<%= request.getContextPath() %>/servletCrearPartidos" method="post" accept-charset="UTF-8">
        <label for="siglas">Siglas</label>
        <input id="siglas" name="siglas" type="text" placeholder="p. ej. PP" required>

        <label for="descripcion">Descripción</label>
        <input id="descripcion" name="descripcion" type="text" placeholder="Nombre completo del partido" required>

        <label for="imagen">Imagen (archivo dentro de /imagenes)</label>
        <input id="imagen" name="imagen" type="text" placeholder="partido.jpg" required>

        <input type="submit" value="Crear partido">
    </form>
    <hr class="separador">
    <form action="panelAdmin.jsp">
        <input type="submit" value="Volver al panel">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
