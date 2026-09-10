package controladoresAdmin;

import java.io.IOException;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import web.AtributosSesion;
import web.ManejadorRespuesta;

/**
 * Enruta las opciones del panel de administracion a su vista correspondiente.
 */
public class servletRedirigirAccion extends HttpServlet {

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
        request.setCharacterEncoding("UTF-8");
        response.setCharacterEncoding("UTF-8");
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
            case "Gestion de partidos":
                return "vistas/admin/gestionPartidos.jsp";
            case "Gestion de candidatos":
                return "vistas/admin/gestionCandidatos.jsp";
            case "Anadir elecciones":
                return "vistas/admin/aniadirElecciones.jsp";
            case "Habilitar, deshabilitar o eliminar elecciones":
                return "vistas/admin/habilitarElecciones.jsp";
            case "Ver resultado de las elecciones":
                return "vistas/admin/verElecciones.jsp";
            case "Ver presidente ganador":
                return "vistas/admin/verGanadorElecciones.jsp";
            case "Votar":
                return "vistas/admin/votacion.jsp";
            case "Ver censo":
                return "vistas/admin/verCenso.jsp";
            case "Salir de la aplicacion":
                return "salida.jsp";
            default:
                return null;
        }
    }
}
