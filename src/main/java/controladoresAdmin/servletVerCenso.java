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
 * Enruta la consulta del censo (global, por localidad o por comunidad).
 */
public class servletVerCenso extends HttpServlet {

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
        if ("todo".equals(accion)) {
            response.sendRedirect("vistas/admin/verCensoTodo.jsp");
        } else if ("localidades".equals(accion)) {
            sesion.setAttribute(AtributosSesion.NOMBRE_LOCALIDAD, request.getParameter("localidad"));
            response.sendRedirect("vistas/admin/verCensoLocalidades.jsp");
        } else if ("comunidades".equals(accion)) {
            sesion.setAttribute(AtributosSesion.NOMBRE_COMUNIDAD, request.getParameter("comunidad"));
            response.sendRedirect("vistas/admin/verCensoComunidades.jsp");
        } else {
            ManejadorRespuesta.error(sesion, response, "Acción no reconocida");
        }
    }
}
