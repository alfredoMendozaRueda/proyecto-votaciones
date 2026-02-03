<%-- 
    Document   : verCensoComunidades
    Created on : 11 nov 2025, 16:35:57
    Author     : ferre
--%>

<%@page import="modelos.Censo"%>
<%@page contentType="text/html" pageEncoding="UTF-8"%>
<%@page import="dao.ConexionBBDD"%>
<%@page import="java.sql.SQLException"%>
<%@page import="java.util.ArrayList"%>
<%!ArrayList<Censo> listaCenso;%>
<%!String id_com;%>
<%
if (!(Boolean)session.getAttribute("isValido")) {
        session.setAttribute("mensajeError", "Intruso");
        response.sendRedirect("../../mensajesError.jsp");
    }
%>
<%
    try {
        ConexionBBDD bbdd = new ConexionBBDD();
        id_com=bbdd.getId_com((String)session.getAttribute("nombre_comunidad"));
        ArrayList<String> idLocalidadesDeComunidad=bbdd.getId_localidadesDeComunidades(id_com);
        listaCenso = bbdd.getCensoComunidades(idLocalidadesDeComunidad);
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
        <title>JSP Page</title>
        <link rel="stylesheet" href="../../styles/styles.css"/>
    </head>
    <body>
        <center>
        <h1>Censo por comunidades</h1>
        <h2><%=(String)session.getAttribute("nombre_comunidad")%></h2>
        <table border="1px">
            <tr>
                <td>DNI</td>
                <td>NOMBRE COMPLETO</td>
                <td>FECHA DE NACIMIENTO</td>
                <td>DIRECCION</td>
                <td>ID DE SU LOCALIDAD</td>
            </tr>
            <%
                for (int i = 0; i < listaCenso.size(); i++) {

            %><tr> <td><%=listaCenso.get(i).getDni()%></td>
                <td><%=listaCenso.get(i).getNombre_completo()%></td>
                <td><%=listaCenso.get(i).getFecha_nacimiento()%></td>
                <td><%=listaCenso.get(i).getDireccion()%></td>
                <td><%=listaCenso.get(i).getId_loc()%></td>
            </tr>
            <%}
            %>
        </table>
        <form action="panelAdmin.jsp">
            <input type="submit" value="Volver panel">
        </form>
    </center>
    </body>
</html>
