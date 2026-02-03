<%-- 
    Document   : verResultadosLocalidades
    Created on : 11 nov 2025, 23:31:36
    Author     : ferre
--%>

<%@page import="modelos.Censo"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%@page import="dao.ConexionBBDD"%>
<%@page import="java.sql.SQLException"%>
<%@page import="java.util.ArrayList"%>
<%!ArrayList<Censo> listaCenso;%>
<%!String id_loc;%>
<%
    try {
        ConexionBBDD bbdd = new ConexionBBDD();
         id_loc=bbdd.getId_loc((String)session.getAttribute("nombre_localidad"));
         
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
<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>JSP Page</title>
        <link rel="stylesheet" href="../../styles/styles.css"/>
    </head>
    <body>
        <center>
        <table>
            <tr>
                <th>Partido Politico</th>
                <th>Número de votos</th>
            </tr>
            <%
                try {
        ConexionBBDD bbdd=new ConexionBBDD();
        ArrayList<String> nomPartidos=bbdd.getNomPartidos();
        String id_localidad=bbdd.getId_loc((String)session.getAttribute("nombre_localidad"));
    
                for (int i = 0; i < nomPartidos.size(); i++) {
                    %><tr>
                        <th><%=nomPartidos.get(i)%></th>
                        <th><%=bbdd.cantidadVotoSegunLocalidad(nomPartidos.get(i),id_localidad)%></th>
                    
                    </tr>
                    <%}
                bbdd.cerrarConexion();
                } catch (ClassNotFoundException e1) {
                    session.setAttribute("mensajeError", e1.getMessage());
                    response.sendRedirect("../../mensajesError.jsp");
                } catch (SQLException e2) {
                     session.setAttribute("mensajeError", e2.getMessage());
                     response.sendRedirect("../../mensajesError.jsp");
                }
            %>
            
        </table>
            <form action="panelUsuario.jsp">
            <input type="submit" value="Volver al panel">
        </form>
    </center>
    </body>
</html>
