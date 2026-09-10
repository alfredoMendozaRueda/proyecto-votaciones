package excepciones;

/**
 * Se lanza al intentar registrar un usuario cuyo DNI ya tiene cuenta.
 */
public class UsuarioYaRegistradoExcepcion extends Exception {

    public UsuarioYaRegistradoExcepcion(String mensaje) {
        super(mensaje);
    }
}
