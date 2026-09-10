package web;

/**
 * Nombres centralizados de los atributos guardados en sesion, para no
 * repetir literales de texto (y arriesgarse a errores tipograficos) en
 * cada servlet y JSP.
 */
public final class AtributosSesion {

    public static final String DNI_USUARIO = "dniUsu";
    public static final String ES_VALIDO = "isValido";
    public static final String ROL_USUARIO = "rolDelUsu";
    public static final String MENSAJE_ERROR = "mensajeError";
    public static final String MENSAJE_BUENO = "mensajeBueno";
    public static final String VOLVER_AL_INDEX = "volver";
    public static final String NOMBRE_LOCALIDAD = "nombre_localidad";
    public static final String NOMBRE_COMUNIDAD = "nombre_comunidad";

    private AtributosSesion() {
    }
}
