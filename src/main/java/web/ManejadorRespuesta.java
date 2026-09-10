package web;

import java.io.IOException;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

/**
 * Punto unico para redirigir a las paginas de feedback (exito/error),
 * evitando repetir en cada servlet el mismo bloque de "guardar mensaje en
 * sesion y redirigir".
 */
public final class ManejadorRespuesta {

    private ManejadorRespuesta() {
    }

    public static void error(HttpSession sesion, HttpServletResponse response, String mensaje) throws IOException {
        sesion.setAttribute(AtributosSesion.MENSAJE_ERROR, mensaje);
        response.sendRedirect("mensajesError.jsp");
    }

    /**
     * Como {@link #error}, pero fuerza la vuelta al index (para errores que
     * ocurren antes de que el usuario tenga una sesion valida, p.ej. en el
     * login o el registro).
     */
    public static void errorVolviendoAlIndex(HttpSession sesion, HttpServletResponse response, String mensaje)
            throws IOException {
        sesion.setAttribute(AtributosSesion.VOLVER_AL_INDEX, "index");
        error(sesion, response, mensaje);
    }

    public static void exito(HttpSession sesion, HttpServletResponse response, String mensaje) throws IOException {
        sesion.setAttribute(AtributosSesion.MENSAJE_BUENO, mensaje);
        response.sendRedirect("mensajesBueno.jsp");
    }
}
