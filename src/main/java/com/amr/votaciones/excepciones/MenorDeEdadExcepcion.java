package com.amr.votaciones.excepciones;

/**
 * Se lanza al intentar registrar como votante a una persona menor de edad.
 */
public class MenorDeEdadExcepcion extends Exception {

    public MenorDeEdadExcepcion(String mensaje) {
        super(mensaje);
    }
}
