package controladores;

import config.FabricaServicios;
import excepciones.DniNoEnCensoExcepcion;
import excepciones.YaHaVotadoExcepcion;
import java.io.IOException;
import java.sql.SQLException;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import web.AtributosSesion;
import web.ManejadorRespuesta;

/**
 * Registra el voto del usuario autenticado.
 */
public class servletVotacion extends HttpServlet {

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
        response.setCharacterEncoding("UTF-8");
        request.setCharacterEncoding("UTF-8");

        HttpSession sesion = request.getSession(true);
        String dni = (String) sesion.getAttribute(AtributosSesion.DNI_USUARIO);
        String siglasPartido = request.getParameter("siglas_partido");

        try {
            FabricaServicios.votacionServicio().votar(dni, siglasPartido);
            ManejadorRespuesta.exito(sesion, response, "Voto registrado con éxito");
        } catch (YaHaVotadoExcepcion | DniNoEnCensoExcepcion e) {
            ManejadorRespuesta.error(sesion, response, e.getMessage());
        } catch (SQLException e) {
            ManejadorRespuesta.error(sesion, response, "Error de base de datos: " + e.getMessage());
        }
    }
}
