package excepciones;

/**
 * Se lanza al intentar votar dos veces con el mismo usuario.
 */
public class YaHaVotadoExcepcion extends Exception {

    public YaHaVotadoExcepcion(String mensaje) {
        super(mensaje);
    }
}
