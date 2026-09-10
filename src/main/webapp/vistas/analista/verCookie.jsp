<%--
    Muestra el contenido de la cookie del partido ganador.
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    if (!Boolean.TRUE.equals(session.getAttribute("isValido"))) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String partidoGanador = null;
    Cookie[] cookies = request.getCookies();
    if (cookies != null) {
        for (Cookie cookie : cookies) {
            if ("ganador".equalsIgnoreCase(cookie.getName())) {
                partidoGanador = cookie.getValue();
            }
        }
    }
    String tituloPagina = "Cookie del ganador - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1><%= partidoGanador != null ? partidoGanador : "Todavía no se ha creado la cookie" %></h1>
    <form action="panelAnalista.jsp">
        <input type="submit" value="Volver al panel">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
