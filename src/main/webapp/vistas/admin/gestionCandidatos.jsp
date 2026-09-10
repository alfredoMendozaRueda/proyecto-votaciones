<%--
    Alta de candidatos.
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    if (!Boolean.TRUE.equals(session.getAttribute("isValido"))) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String tituloPagina = "Gestión de candidatos - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1>Gestión de candidatos</h1>
    <form action="<%= request.getContextPath() %>/servletAniadirCandidatos" method="post" accept-charset="UTF-8">
        <label for="dni">DNI</label>
        <input type="text" id="dni" name="dni" maxlength="9" required>

        <label for="nombre_completo">Nombre completo</label>
        <input type="text" id="nombre_completo" name="nombre_completo" required>

        <label for="siglas_partido">Siglas de su partido</label>
        <input type="text" id="siglas_partido" name="siglas_partido" required>

        <label for="orden">Orden en la candidatura</label>
        <input type="number" id="orden" name="orden" min="1" max="3" required>

        <input type="submit" value="Registrar candidato">
    </form>
    <hr class="separador">
    <form action="panelAdmin.jsp">
        <input type="submit" value="Volver al panel">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
