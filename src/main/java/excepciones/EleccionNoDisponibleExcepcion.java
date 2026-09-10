package excepciones;

/**
 * Se lanza cuando una operacion requiere que la eleccion este en un estado
 * (habilitada/inhabilitada) distinto del actual, o que no exista ninguna.
 */
public class EleccionNoDisponibleExcepcion extends Exception {

    public EleccionNoDisponibleExcepcion(String mensaje) {
        super(mensaje);
    }
}
