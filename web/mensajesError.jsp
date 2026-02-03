<%-- 
    Document   : mensajesError
    Created on : 30 oct 2025, 16:29:45
    Author     : ferre
--%>

<%@page contentType="text/html" pageEncoding="UTF-8"%>
<!DOCTYPE html>
<html>
    <head>
        <meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
        <title>Aplicacion agenda de contactos</title>
        <link rel="stylesheet" href="styles/styles.css">
    </head>
    <body>
    <center>
        <div>
            <h1>Feedback de la aplicación votos</h1>
        <h2 class="error">Ha ocurrido el siguiente error: <%=session.getAttribute("mensajeError")%></h2>
       <%
           
           
           if (((String)session.getAttribute("rolDelUsu")).equalsIgnoreCase("analista")) {%>
                          <form action="vistas/analista/panelAnalista.jsp">
                            <input type="submit" value="Volver al panel">
                    </form>
                     <% }
           if (((String)session.getAttribute("volver")).equalsIgnoreCase("index")) {
               session.setAttribute("volver", "normal");
                   %><form action="index.jsp">
                            <input type="submit" value="Volver al index">
                    </form><%
               }else{
            if (((String)session.getAttribute("rolDelUsu")).equalsIgnoreCase("admin")) {%>
                    <form action="vistas/admin/panelAdmin.jsp">
                            <input type="submit" value="Volver al panel">
                    </form>
            <%  } else if (((String)session.getAttribute("rolDelUsu")).equalsIgnoreCase("usuario")) {
                      %>
                    <form action="vistas/usuario/panelUsuario.jsp">
                            <input type="submit" value="Volver al panel">
                    </form>
            <%  
                  } else if (((String)session.getAttribute("rolDelUsu")).equalsIgnoreCase("nuevoregistrado")) {
                           %><form action="index.jsp">
                            <input type="submit" value="Volver al index">
                    </form><%
                      }
}
            %>
        </div>
    </center>
    </body>
</html>