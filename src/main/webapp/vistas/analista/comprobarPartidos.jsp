<%--
    Comprobacion del minimo de partidos necesarios para una eleccion.
--%>
<%@page import="java.sql.SQLException"%>
<%@page import="java.util.List"%>
<%@page import="config.FabricaServicios"%>
<%@page import="excepciones.MinimoPartidosPoliticosExcepcion"%>
<%@page import="modelos.Partido"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    if (!Boolean.TRUE.equals(session.getAttribute("isValido"))) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    List<Partido> listaPartidos;
    try {
        listaPartidos = FabricaServicios.partidoServicio().partidosConMinimoRequerido();
    } catch (MinimoPartidosPoliticosExcepcion e) {
        session.setAttribute("mensajeError", e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    } catch (SQLException e) {
        session.setAttribute("mensajeError", "Error de base de datos: " + e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String tituloPagina = "Partidos disponibles - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container">
    <h1>Puedes votar a</h1>
    <p>
        <% for (int i = 0; i < listaPartidos.size(); i++) { %>
            <%= listaPartidos.get(i).getSiglas() %><%= i < listaPartidos.size() - 1 ? ", " : "" %>
        <% } %>
    </p>
    <form action="panelAnalista.jsp">
        <input type="submit" value="Volver al panel">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
