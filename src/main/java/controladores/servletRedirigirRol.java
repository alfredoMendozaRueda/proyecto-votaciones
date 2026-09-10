package controladores;

import config.FabricaServicios;
import excepciones.CredencialesInvalidasExcepcion;
import excepciones.DniNoEnCensoExcepcion;
import java.io.IOException;
import java.net.URLEncoder;
import java.sql.SQLException;
import javax.servlet.ServletException;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import modelos.Rol;
import servicios.ResultadoLogin;
import web.AtributosSesion;
import web.ManejadorRespuesta;

/**
 * Valida el login y redirige a cada usuario al panel de su rol.
 */
public class servletRedirigirRol extends HttpServlet {

    private static final int DURACION_COOKIE_NOMBRE_SEGUNDOS = 60 * 3;

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
        String boton = request.getParameter("boton");
        if (!"Iniciar sesion".equalsIgnoreCase(boton)) {
            ManejadorRespuesta.errorVolviendoAlIndex(sesion, response, "Has entrado de manera ilegítima");
            return;
        }

        String dni = request.getParameter("dni");
        String contrasena = request.getParameter("contrasena");
        if (dni == null || dni.isEmpty()) {
            ManejadorRespuesta.errorVolviendoAlIndex(sesion, response, "Rellena los campos");
            return;
        }

        try {
            ResultadoLogin login = FabricaServicios.autenticacionServicio().autenticar(dni, contrasena);

            Cookie cookieNombre = new Cookie("nombre", URLEncoder.encode(login.getNombreCompleto(), "UTF-8"));
            cookieNombre.setMaxAge(DURACION_COOKIE_NOMBRE_SEGUNDOS);
            response.addCookie(cookieNombre);

            sesion.setAttribute(AtributosSesion.DNI_USUARIO, login.getDni());
            sesion.setAttribute(AtributosSesion.ES_VALIDO, true);
            sesion.setAttribute(AtributosSesion.ROL_USUARIO, login.getRol());

            if (Rol.ADMIN.equals(login.getRol())) {
                response.sendRedirect("vistas/admin/panelAdmin.jsp");
            } else if (Rol.ANALISTA.equals(login.getRol())) {
                response.sendRedirect("vistas/analista/panelAnalista.jsp");
            } else {
                response.sendRedirect("vistas/usuario/panelUsuario.jsp");
            }
        } catch (DniNoEnCensoExcepcion | CredencialesInvalidasExcepcion e) {
            ManejadorRespuesta.errorVolviendoAlIndex(sesion, response, e.getMessage());
        } catch (SQLException e) {
            ManejadorRespuesta.errorVolviendoAlIndex(sesion, response, "Error de base de datos: " + e.getMessage());
        }
    }
}
