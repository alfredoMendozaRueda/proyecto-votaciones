<%--
    Pagina de votacion.
--%>
<%@page import="java.sql.SQLException"%>
<%@page import="java.util.List"%>
<%@page import="modelos.Partido"%>
<%@page import="config.FabricaServicios"%>
<%@page import="excepciones.EleccionNoDisponibleExcepcion"%>
<%@page import="excepciones.SinPartidosDisponiblesExcepcion"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    List<Partido> listaPartidos;
    try {
        listaPartidos = FabricaServicios.votacionServicio().partidosParaVotar();
    } catch (EleccionNoDisponibleExcepcion | SinPartidosDisponiblesExcepcion e) {
        session.setAttribute("mensajeError", e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    } catch (SQLException e) {
        session.setAttribute("mensajeError", "Error de base de datos: " + e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String tituloPagina = "Votaciones - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container-ancho">
    <h1>Elige tu partido</h1>
    <div class="rejilla-partidos">
        <% for (Partido p : listaPartidos) { %>
        <div class="tarjeta-partido">
            <img src="<%= p.getImagen() %>" alt="Logotipo de <%= p.getSiglas() %>">
            <span class="siglas"><%= p.getSiglas() %></span>
            <form action="<%= request.getContextPath() %>/servletVotacion" method="post" accept-charset="UTF-8">
                <input type="hidden" name="siglas_partido" value="<%= p.getSiglas() %>">
                <input type="submit" value="Votar">
            </form>
        </div>
        <% } %>
    </div>
    <hr class="separador">
    <form action="panelUsuario.jsp">
        <input type="submit" value="Volver al panel">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
