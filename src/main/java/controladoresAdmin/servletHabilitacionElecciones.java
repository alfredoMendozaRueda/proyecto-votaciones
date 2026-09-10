package controladoresAdmin;

import config.FabricaServicios;
import java.io.IOException;
import java.sql.SQLException;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import servicios.EleccionServicio;
import web.ManejadorRespuesta;

/**
 * Habilita, deshabilita o elimina la eleccion en curso.
 */
public class servletHabilitacionElecciones extends HttpServlet {

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
        String accion = request.getParameter("accion");
        String idEleccion = request.getParameter("id_eleccion");

        try {
            EleccionServicio eleccionServicio = FabricaServicios.eleccionServicio();
            boolean exito;
            String verboExito;
            String verboFallo;

            if ("habilitar".equalsIgnoreCase(accion)) {
                exito = eleccionServicio.habilitar(idEleccion);
                verboExito = "Elección habilitada";
                verboFallo = "No se pudo habilitar";
            } else if ("deshabilitar".equalsIgnoreCase(accion)) {
                exito = eleccionServicio.deshabilitar(idEleccion);
                verboExito = "Elección deshabilitada";
                verboFallo = "No se pudo deshabilitar";
            } else if ("eliminar".equalsIgnoreCase(accion)) {
                exito = eleccionServicio.eliminar(idEleccion);
                verboExito = "Elección eliminada";
                verboFallo = "No se pudo eliminar";
            } else {
                ManejadorRespuesta.error(sesion, response, "Acción no reconocida");
                return;
            }

            if (exito) {
                ManejadorRespuesta.exito(sesion, response, verboExito);
            } else {
                ManejadorRespuesta.error(sesion, response, verboFallo);
            }
        } catch (SQLException e) {
            ManejadorRespuesta.error(sesion, response, "Error de base de datos: " + e.getMessage());
        }
    }
}
