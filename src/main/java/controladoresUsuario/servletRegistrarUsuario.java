package controladoresUsuario;

import config.FabricaServicios;
import excepciones.DniNoEnCensoExcepcion;
import excepciones.MenorDeEdadExcepcion;
import excepciones.UsuarioYaRegistradoExcepcion;
import java.io.IOException;
import java.sql.SQLException;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import web.ManejadorRespuesta;

/**
 * Alta de una cuenta de votante para una persona ya censada.
 */
public class servletRegistrarUsuario extends HttpServlet {

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
        String dni = request.getParameter("dni");
        String contrasena = request.getParameter("contrasena");

        try {
            FabricaServicios.registroServicio().registrarVotante(dni, contrasena);
            ManejadorRespuesta.exito(sesion, response, "Usuario registrado con éxito");
        } catch (UsuarioYaRegistradoExcepcion | DniNoEnCensoExcepcion | MenorDeEdadExcepcion e) {
            ManejadorRespuesta.errorVolviendoAlIndex(sesion, response, e.getMessage());
        } catch (SQLException e) {
            ManejadorRespuesta.errorVolviendoAlIndex(sesion, response, "Error de base de datos: " + e.getMessage());
        }
    }
}
