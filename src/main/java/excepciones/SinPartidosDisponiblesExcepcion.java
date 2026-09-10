package excepciones;

/**
 * Se lanza cuando una operacion necesita partidos politicos dados de alta
 * y todavia no hay ninguno.
 */
public class SinPartidosDisponiblesExcepcion extends Exception {

    public SinPartidosDisponiblesExcepcion(String mensaje) {
        super(mensaje);
    }
}
