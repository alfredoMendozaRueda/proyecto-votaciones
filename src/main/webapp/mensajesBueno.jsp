<%--
    Pagina generica de feedback para operaciones correctas.
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    String tituloPagina = "Operación correcta - Sistema de Votaciones";
    String mensajeBueno = (String) session.getAttribute("mensajeBueno");
    String rolActual = (String) session.getAttribute("rolDelUsu");

    String destinoVolver;
    if ("admin".equalsIgnoreCase(rolActual)) {
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
    <h1>¡Todo correcto!</h1>
    <h2 class="success"><%= mensajeBueno != null ? mensajeBueno : "Operación realizada." %></h2>
    <form action="<%= destinoVolver %>">
        <input type="submit" value="Volver">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
