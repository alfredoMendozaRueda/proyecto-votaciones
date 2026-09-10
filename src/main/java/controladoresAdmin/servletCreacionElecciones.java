package controladoresAdmin;

import config.FabricaServicios;
import excepciones.EleccionYaExisteExcepcion;
import java.io.IOException;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.format.DateTimeParseException;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import web.ManejadorRespuesta;

/**
 * Alta de la eleccion (unica) que gestiona la aplicacion.
 */
public class servletCreacionElecciones extends HttpServlet {

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
            String idElecciones = request.getParameter("id_elecciones");
            String descripcion = request.getParameter("descripcion");
            LocalDate fechaFin = LocalDate.parse(request.getParameter("fecha_fin"));

            FabricaServicios.eleccionServicio().crearEleccion(idElecciones, descripcion, fechaFin);
            ManejadorRespuesta.exito(sesion, response, "Elección registrada con éxito");
        } catch (DateTimeParseException e) {
            ManejadorRespuesta.error(sesion, response, "La fecha de fin no es válida");
        } catch (EleccionYaExisteExcepcion e) {
            ManejadorRespuesta.error(sesion, response, e.getMessage());
        } catch (SQLException e) {
            ManejadorRespuesta.error(sesion, response, "Error de base de datos: " + e.getMessage());
        }
    }
}
