package controladoresAnalista;

import java.io.IOException;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import web.AtributosSesion;
import web.ManejadorRespuesta;

/**
 * Enruta las opciones del panel de analista a su vista correspondiente.
 */
public class servletGestionAnalista extends HttpServlet {

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
        response.setCharacterEncoding("UTF-8");
        request.setCharacterEncoding("UTF-8");
        response.setContentType("text/html;charset=UTF-8");

        HttpSession sesion = request.getSession(true);
        String accion = request.getParameter("accion");
        sesion.setAttribute(AtributosSesion.ES_VALIDO, false);

        String destino = destinoDe(accion);
        if (destino == null) {
            ManejadorRespuesta.error(sesion, response, "Intruso");
            return;
        }

        sesion.setAttribute(AtributosSesion.ES_VALIDO, true);
        response.sendRedirect(destino);
    }

    private String destinoDe(String accion) {
        if (accion == null) {
            return null;
        }
        switch (accion) {
            case "Comprobar partidos":
                return "vistas/analista/comprobarPartidos.jsp";
            case "Dar de alta un nuevo partido":
                return "vistas/admin/gestionPartidos.jsp";
            case "Ver candidatos por localidad":
                return "vistas/analista/verCandidatosLocalidad.jsp";
            case "Obtener participacion":
                return "vistas/analista/obtenerParticipacion.jsp";
            case "Ver porcentaje de participacion":
                return "vistas/analista/porcentajes.jsp";
            case "Crear cookie":
                return "vistas/analista/crearCookie.jsp";
            case "Ver cookie":
                return "vistas/analista/verCookie.jsp";
            default:
                return null;
        }
    }
}
