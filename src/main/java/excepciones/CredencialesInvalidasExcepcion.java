package excepciones;

/**
 * Se lanza cuando el DNI y contrasena introducidos no son correctos.
 */
public class CredencialesInvalidasExcepcion extends Exception {

    public CredencialesInvalidasExcepcion(String mensaje) {
        super(mensaje);
    }
}
