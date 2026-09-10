package excepciones;

/**
 * Se lanza cuando se opera con un DNI que no figura en el censo electoral.
 */
public class DniNoEnCensoExcepcion extends Exception {

    public DniNoEnCensoExcepcion(String mensaje) {
        super(mensaje);
    }
}
