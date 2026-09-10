<%--
    Pagina de inicio de sesion.
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    session.removeAttribute("volver");
    session.removeAttribute("isValido");
    session.removeAttribute("rolDelUsu");
    String tituloPagina = "Inicio de sesión - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1>Inicio de sesión</h1>
    <form action="<%= request.getContextPath() %>/servletRedirigirRol" method="post" accept-charset="UTF-8">
        <label for="dni">DNI</label>
        <input type="text" id="dni" name="dni" maxlength="9" autocomplete="username" required>

        <label for="contrasena">Contraseña</label>
        <input type="password" id="contrasena" name="contrasena" autocomplete="current-password" required>

        <input type="submit" name="boton" value="Iniciar sesion">
    </form>
    <p>Si no tiene cuenta, regístrese <a href="vistas/usuario/registro.jsp">aquí</a></p>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
