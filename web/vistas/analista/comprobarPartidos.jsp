<%-- 
    Document   : comprobarPartidos
    Created on : 2 dic 2025, 10:11:28
    Author     : ferre
--%>

<%@page import="modelos.Partido"%>
<%@page import="java.util.ArrayList"%>
<%@page import="modelos.MinimoPartidosPoliticosExcepcion"%>
<%@page import="java.sql.SQLException"%>
<%@page import="dao.ConexionBBDD"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%!int numPartidos;%>
<%!ArrayList<Partido> listaPartidos;%>

<%
    try {
        ConexionBBDD bbdd = new ConexionBBDD();
        numPartidos= bbdd.numPartidos();
        listaPartidos = bbdd.getListaPartidos(); 
        if (!(numPartidos>=7)) {
                throw new MinimoPartidosPoliticosExcepcion("No se llega a 7 partidos");
            }
       bbdd.cerrarConexion();
    } catch (ClassNotFoundException e1) {
        session.setAttribute("mensajeError", e1.getMessage());
        response.sendRedirect("../../mensajesError.jsp");
    } catch (SQLException e2) {
        session.setAttribute("mensajeError", e2.getMessage());
        response.sendRedirect("../../mensajesError.jsp");
    } catch (MinimoPartidosPoliticosExcepcion e3){
        session.setAttribute("mensajeError", e3.getMessage());
        response.sendRedirect("../../mensajesError.jsp");
    }
%>
<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>JSP Page</title>
         <link rel="stylesheet" href="../../styles/styles.css"/>
    </head>
    <body>
    <center>
        <h1>Puedes votar a: 
       <% for (int i = 0; i < listaPartidos.size(); i++) {
                   Partido p = listaPartidos.get(i);
       %> <%=p.getSiglas()%> , <%
}%>
    </center>
    </body>
</html>
