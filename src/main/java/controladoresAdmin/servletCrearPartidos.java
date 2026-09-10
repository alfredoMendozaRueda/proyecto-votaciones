package controladoresAdmin;

import config.FabricaServicios;
import java.io.IOException;
import java.sql.SQLException;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import web.ManejadorRespuesta;

/**
 * Alta de un partido politico.
 */
public class servletCrearPartidos extends HttpServlet {

    private static final String RUTA_IMAGENES = "../../imagenes/";

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
        try {
            String siglas = request.getParameter("siglas");
            String descripcion = request.getParameter("descripcion");
            String imagen = RUTA_IMAGENES + request.getParameter("imagen");

            FabricaServicios.partidoServicio().crearPartido(siglas, descripcion, imagen);
            ManejadorRespuesta.exito(sesion, response, "Partido registrado con éxito");
        } catch (SQLException e) {
            ManejadorRespuesta.error(sesion, response, "No se ha podido registrar el partido: " + e.getMessage());
        }
    }
}
