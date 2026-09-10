package com.amr.votaciones.excepciones;

/**
 * Se lanza cuando se busca una localidad, comunidad u otro elemento de
 * referencia que no existe en la base de datos.
 */
public class ElementoNoEncontradoExcepcion extends Exception {

    public ElementoNoEncontradoExcepcion(String mensaje) {
        super(mensaje);
    }
}
