<%@page import="java.sql.SQLException"%>
<%@page import="java.util.ArrayList"%>
<%@page import="modelos.Partido"%>
<%@page import="dao.ConexionBBDD"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%!ArrayList<Partido> listaPartidos;%>
<%
if (!(Boolean)session.getAttribute("isValido")) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect("../../mensajesError.jsp");
    }
%>
<%
    HttpSession miSesion = request.getSession(true);
    try {
        ConexionBBDD bbdd = new ConexionBBDD();
        String idEleccion = bbdd.getIdEleccion();
        if (!bbdd.getEstadoEleccion(idEleccion).equals("habilitada")) {
            miSesion.setAttribute("mensajeError", "Elecciones deshabilitadas");
            response.sendRedirect("../../mensajesError.jsp");
            return;
        }

        listaPartidos = bbdd.getListaPartidos(); 
        if (listaPartidos.isEmpty()) {
            miSesion.setAttribute("mensajeError", "No hay partidos añadidos aún");
            response.sendRedirect("../../mensajesError.jsp");
            return;
        }
        bbdd.cerrarConexion();
        } catch (ClassNotFoundException e1) {
        session.setAttribute("mensajeError", e1.getMessage());
        response.sendRedirect("../../mensajesError.jsp");
    } catch (SQLException e2) {
        session.setAttribute("mensajeError", e2.getMessage());
        response.sendRedirect("../../mensajesError.jsp");
    }
%>
<!DOCTYPE html>
<html>
    <head>
        <meta charset="UTF-8">
        <title>Votaciones</title>
        <link rel="stylesheet" href="../../styles/styles.css"/>
    </head>
    <body>
    <center>
        <h1>Página de votaciones</h1>
        <br>
        <table border="1">
            <tr>
                <th>Siglas</th>
                <th>Imagen</th>
                <th>Votar</th>
            </tr>
            <% for (int i = 0; i < listaPartidos.size(); i++) {
                   Partido p = listaPartidos.get(i);
            %>
            <tr>
                <td><%= p.getSiglas() %></td>
                <td>
                    <img src="<%= p.getImagen() %>" width="100" height="60">
                </td>
                <td>
                    <form action="../../servletVotacion" accept-charset="UTF-8">
                        <input type="hidden" name="siglas_partido" value="<%= p.getSiglas() %>">
                        <input type="submit" value="Votar">
                    </form>
                </td>
            </tr>
            <% } %>
        </table>
        <br>
        <form action="panelAdmin.jsp">
            <input type="submit" value="Volver al panel">
        </form>
    </center>
    </body>
</html>
<%
    
%>