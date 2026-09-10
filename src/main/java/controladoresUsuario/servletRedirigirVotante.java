package controladoresUsuario;

import java.io.IOException;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import web.ManejadorRespuesta;

/**
 * Enruta las opciones del panel de votante a su vista correspondiente.
 */
public class servletRedirigirVotante extends HttpServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        procesar(request, response);
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        procesar(request, response);
    }

    private void procesar(HttpServletRequest request, HttpServletResponse response) throws IOException {
        response.setContentType("text/html;charset=UTF-8");
        request.setCharacterEncoding("UTF-8");
        response.setCharacterEncoding("UTF-8");

        HttpSession sesion = request.getSession(true);
        String accion = request.getParameter("accion");
        String destino = destinoDe(accion);
        if (destino == null) {
            ManejadorRespuesta.error(sesion, response, "Intruso");
            return;
        }
        response.sendRedirect(destino);
    }

    private String destinoDe(String accion) {
        if (accion == null) {
            return null;
        }
        if (accion.equalsIgnoreCase("Votar")) {
            return "vistas/usuario/votacion.jsp";
        } else if (accion.equalsIgnoreCase("Ver resultados de las elecciones")) {
            return "vistas/usuario/verElecciones.jsp";
        } else if (accion.equalsIgnoreCase("Ver ganador de las elecciones")) {
            return "vistas/usuario/verGanadorElecciones.jsp";
        } else if (accion.equalsIgnoreCase("Salir de la aplicacion")) {
            return "salida.jsp";
        }
        return null;
    }
}
