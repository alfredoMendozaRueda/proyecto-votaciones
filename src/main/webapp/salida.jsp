<%--
    Pagina de despedida al cerrar sesion.
--%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%@page import="java.net.URLDecoder"%>
<%
    session.invalidate();
    String nombreDecodificado = "";
    Cookie[] cookies = request.getCookies();
    if (cookies != null) {
        for (Cookie cookie : cookies) {
            if ("nombre".equalsIgnoreCase(cookie.getName())) {
                nombreDecodificado = URLDecoder.decode(cookie.getValue(), "UTF-8");
            }
        }
    }
    String tituloPagina = "Hasta pronto - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1><%= nombreDecodificado.isEmpty() ? "Hasta la próxima" : "Hasta la próxima, " + nombreDecodificado %></h1>
    <p><a href="<%= request.getContextPath() %>/index.jsp">Volver al inicio de sesión</a></p>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
