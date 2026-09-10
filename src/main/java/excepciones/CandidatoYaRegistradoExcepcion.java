package excepciones;

/**
 * Se lanza al intentar registrar dos veces al mismo candidato (mismo DNI).
 */
public class CandidatoYaRegistradoExcepcion extends Exception {

    public CandidatoYaRegistradoExcepcion(String mensaje) {
        super(mensaje);
    }
}
