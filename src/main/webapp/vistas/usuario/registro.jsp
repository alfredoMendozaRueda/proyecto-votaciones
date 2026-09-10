<%--
    Alta de una cuenta de votante.
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    session.setAttribute("rolDelUsu", "nuevoregistrado");
    String tituloPagina = "Crear usuario - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1>Crear usuario</h1>
    <p>Debes figurar en el censo electoral para poder registrarte.</p>
    <form action="<%= request.getContextPath() %>/servletRegistrarUsuario" method="post" accept-charset="UTF-8">
        <label for="dni">DNI del usuario</label>
        <input type="text" id="dni" name="dni" maxlength="9" required>

        <label for="contrasena">Contraseña</label>
        <input type="password" id="contrasena" name="contrasena" autocomplete="new-password" required>

        <input type="submit" value="Registrarse">
    </form>
    <hr class="separador">
    <form action="<%= request.getContextPath() %>/index.jsp">
        <input type="submit" value="Volver al inicio">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
