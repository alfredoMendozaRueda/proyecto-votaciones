<%-- 
    Document   : obtenerParticipacion
    Created on : 2 dic 2025, 11:28:25
    Author     : ferre
--%>

<%@page import="modelos.Participacion"%>
<%@page import="java.util.ArrayList"%>
<%@page import="java.sql.SQLException"%>
<%@page import="dao.ConexionBBDD"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%
 try {
        ConexionBBDD bbdd = new ConexionBBDD();
         bbdd.borrarTodasLasParticipaciones();
         ArrayList<String> Nomlocalidades= bbdd.getLocalidades();
        ArrayList<String> localidades= bbdd.getIds_loc(Nomlocalidades);
        
        bbdd.cerrarConexion();
       for (int i = 0; i < localidades.size(); i++) {
           String localidad=localidades.get(i);
           bbdd = new ConexionBBDD();
           int numCensados=bbdd.numCensadosLoc(localidad);
           bbdd.cerrarConexion();
           bbdd = new ConexionBBDD();
           int votosLoc=bbdd.votosPorLoc(localidad);
           bbdd.cerrarConexion();
           Participacion p= new Participacion(localidad,numCensados,votosLoc);
           bbdd = new ConexionBBDD(); 
           int filas=bbdd.registrarParticipacion(p);
               if (filas<1) {
                        session.setAttribute("mensajeError", "Error al registrar participaciones");
                        response.sendRedirect("../../mensajesError.jsp");
                   }
               bbdd.cerrarConexion();
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
        <title>JSP Page</title>
        <link rel="stylesheet" href="../../styles/styles.css"/>
    </head>
    <body>

        <h1>participaciones registradas con exito</h1>
        <a href="panelAnalista.jsp">Volver</a>
    </body>
</html>
