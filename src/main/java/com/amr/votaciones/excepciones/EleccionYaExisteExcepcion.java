package com.amr.votaciones.excepciones;

/**
 * Se lanza al intentar crear una eleccion cuando ya existe una registrada
 * (la aplicacion solo gestiona un proceso electoral a la vez).
 */
public class EleccionYaExisteExcepcion extends Exception {

    public EleccionYaExisteExcepcion(String mensaje) {
        super(mensaje);
    }
}
