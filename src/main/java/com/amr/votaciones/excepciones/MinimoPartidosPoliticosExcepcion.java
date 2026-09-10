package com.amr.votaciones.excepciones;

/**
 * Se lanza cuando no hay suficientes partidos politicos dados de alta para
 * poder celebrar una eleccion.
 */
public class MinimoPartidosPoliticosExcepcion extends Exception {

    public MinimoPartidosPoliticosExcepcion(String mensaje) {
        super(mensaje);
    }
}
