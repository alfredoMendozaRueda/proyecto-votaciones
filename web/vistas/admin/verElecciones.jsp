<%-- 
    Document   : verElecciones
    Created on : 7 nov 2025, 16:21:58
    Author     : ferre
--%>

<%@page import="dao.ConexionBBDD"%>
<%@page import="java.sql.SQLException"%>
<%@page import="java.util.ArrayList"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%!ArrayList<String> localidades;%>
<%!ArrayList<String> comunidades;%>
<%!String partidoGanador;%>
<%
if (!(Boolean)session.getAttribute("isValido")) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect("../../mensajesError.jsp");
    }
%>
<%
    try {
        ConexionBBDD bbdd = new ConexionBBDD();
        partidoGanador=bbdd.partidoGanador();
        if (bbdd.getEstadoEleccion(bbdd.getIdEleccion()).equals("habilitada")) {
            response.sendRedirect("../../mensajesError.jsp");
            session.setAttribute("mensajeError", "Elecciones aun habilitadas");
        }
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
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Resultados</title>
        <link rel="stylesheet" href="../../styles/styles.css"/>
    </head>
    <body>
    <center>
        <h1>Ver resultados de:</h1>
        <form action="../../servletVerResultados" accept-charset="UTF-8">
        <br>
        <input type="submit" name="accion" value="todo">
        <br><br>

        <table>
            <tr>
                <td>
                    <select name="localidad">
                        <%
                            try {
                                ConexionBBDD bbdd = new ConexionBBDD();
                                localidades = bbdd.getLocalidades();
                                bbdd.cerrarConexion();
                            } catch (ClassNotFoundException e1) {
                                session.setAttribute("mensajeError", e1.getMessage());
                                response.sendRedirect("../../mensajesError.jsp");
                            } catch (SQLException e2) {
                                session.setAttribute("mensajeError", e2.getMessage());
                                response.sendRedirect("../../mensajesError.jsp");
                            }
                        %>
                        <% for (int i = 0; i < localidades.size(); i++) { %>
                            <option value="<%= localidades.get(i) %>"><%= localidades.get(i) %></option>
                        <% } %>
                    </select>
                </td>
                <td>
                    <input type="submit" name="accion" value="localidades">
                </td>
            </tr>
            <tr>
                <td>
                    <select name="comunidad">
                        <%
                            try {
                                ConexionBBDD bbdd = new ConexionBBDD();
                                comunidades = bbdd.getComunidades();
                            } catch (ClassNotFoundException e1) {
                                session.setAttribute("mensajeError", e1.getMessage());
                                response.sendRedirect("../../mensajesError.jsp");
                            } catch (SQLException e2) {
                                session.setAttribute("mensajeError", e2.getMessage());
                                response.sendRedirect("../../mensajesError.jsp");
                            }
                        %>
                        <% for (int i = 0; i < comunidades.size(); i++) { %>
                            <option value="<%= comunidades.get(i) %>"><%= comunidades.get(i) %></option>
                        <% } %>
                    </select>
                </td>
                <td>
                    <input type="submit" name="accion" value="comunidades">
                </td>
            </tr>
        </table>
    </form>
                    <form action="panelAdmin.jsp">
            <input type="submit" value="Volver panel">
        </form>
</center>
    </body>
</html>
