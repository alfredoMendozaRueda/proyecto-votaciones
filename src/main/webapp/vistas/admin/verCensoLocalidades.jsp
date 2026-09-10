<%--
    Censo filtrado por localidad.
--%>
<%@page import="java.sql.SQLException"%>
<%@page import="java.util.List"%>
<%@page import="config.FabricaServicios"%>
<%@page import="excepciones.ElementoNoEncontradoExcepcion"%>
<%@page import="modelos.Censo"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
    if (!Boolean.TRUE.equals(session.getAttribute("isValido"))) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String nombreLocalidad = (String) session.getAttribute("nombre_localidad");
    List<Censo> listaCenso;
    try {
        listaCenso = FabricaServicios.censoServicio().censoPorLocalidad(nombreLocalidad);
    } catch (ElementoNoEncontradoExcepcion e) {
        session.setAttribute("mensajeError", e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    } catch (SQLException e) {
        session.setAttribute("mensajeError", "Error de base de datos: " + e.getMessage());
        response.sendRedirect(request.getContextPath() + "/mensajesError.jsp");
        return;
    }
    String tituloPagina = "Censo por localidad - Sistema de Votaciones";
%>
<%@ include file="/WEB-INF/incluidos/cabecera.jspf" %>
<div class="container-ancho">
    <h1>Censo en <%= nombreLocalidad %></h1>
    <div class="tabla-responsive">
        <table>
            <thead>
                <tr>
                    <th>DNI</th>
                    <th>Nombre completo</th>
                    <th>Fecha de nacimiento</th>
                    <th>Dirección</th>
                    <th>Localidad</th>
                </tr>
            </thead>
            <tbody>
                <% for (Censo persona : listaCenso) { %>
                <tr>
                    <td><%= persona.getDni() %></td>
                    <td><%= persona.getNombreCompleto() %></td>
                    <td><%= persona.getFechaNacimiento() %></td>
                    <td><%= persona.getDireccion() %></td>
                    <td><%= persona.getIdLocalidad() %></td>
                </tr>
                <% } %>
            </tbody>
        </table>
    </div>
    <form action="panelAdmin.jsp">
        <input type="submit" value="Volver al panel">
    </form>
</div>
<%@ include file="/WEB-INF/incluidos/pie.jspf" %>
