<%-- 
    Document   : verResultadosTodo
    Created on : 11 nov 2025, 23:06:35
    Author     : ferre
--%>

<%@page import="java.util.ArrayList"%>
<%@page import="dao.ConexionBBDD"%>
<%@page import="java.sql.SQLException"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
if (!(Boolean)session.getAttribute("isValido")) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect("../../mensajesError.jsp");
    }
%>
<%
try {
        ConexionBBDD bbdd=new ConexionBBDD();
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
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Resultados generales</title>
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
    
                for (int i = 0; i < nomPartidos.size(); i++) {
                    %><tr>
                        <th><%=nomPartidos.get(i)%></th>
                        <th><%=bbdd.cantidadVoto(nomPartidos.get(i))%></th>
                    
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
            <form action="panelAdmin.jsp">
            <input type="submit" value="Volver panel">
        </form>
    </center>
    </body>
</html>
