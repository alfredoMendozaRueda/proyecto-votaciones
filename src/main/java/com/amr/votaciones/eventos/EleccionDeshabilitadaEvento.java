package com.amr.votaciones.eventos;

import java.time.Instant;

/**
 * Se publica cuando un administrador deshabilita una eleccion (termina la
 * votacion).
 */
public record EleccionDeshabilitadaEvento(String idElecciones, Instant fecha) implements EventoElectoral {

    public static final String ROUTING_KEY = "eleccion.deshabilitada";

    @Override
    public String routingKey() {
        return ROUTING_KEY;
    }
}
