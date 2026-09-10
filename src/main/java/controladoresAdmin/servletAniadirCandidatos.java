package controladoresAdmin;

import config.FabricaServicios;
import excepciones.CandidatoYaRegistradoExcepcion;
import excepciones.DniNoEnCensoExcepcion;
import java.io.IOException;
import java.sql.SQLException;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import modelos.Candidato;
import web.ManejadorRespuesta;

/**
 * Alta de un candidato para un partido.
 */
public class servletAniadirCandidatos extends HttpServlet {

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
        String dni = request.getParameter("dni");
        if (dni == null || dni.isEmpty()) {
            ManejadorRespuesta.error(sesion, response, "El DNI es obligatorio");
            return;
        }

        try {
            String nombreCompleto = request.getParameter("nombre_completo");
            String siglasPartido = request.getParameter("siglas_partido");
            int orden = Integer.parseInt(request.getParameter("orden"));

            Candidato candidato = new Candidato(dni, nombreCompleto, siglasPartido, orden);
            FabricaServicios.candidatoServicio().registrarCandidato(candidato);
            ManejadorRespuesta.exito(sesion, response, "Candidato registrado con éxito");
        } catch (NumberFormatException e) {
            ManejadorRespuesta.error(sesion, response, "El orden debe ser un número");
        } catch (DniNoEnCensoExcepcion | CandidatoYaRegistradoExcepcion e) {
            ManejadorRespuesta.error(sesion, response, e.getMessage());
        } catch (SQLException e) {
            ManejadorRespuesta.error(sesion, response, "Error de base de datos: " + e.getMessage());
        }
    }
}
