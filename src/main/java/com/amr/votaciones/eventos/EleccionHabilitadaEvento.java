package com.amr.votaciones.eventos;

import java.time.Instant;

/**
 * Se publica cuando un administrador habilita una eleccion (empieza la
 * votacion).
 */
public record EleccionHabilitadaEvento(String idElecciones, Instant fecha) implements EventoElectoral {

    public static final String ROUTING_KEY = "eleccion.habilitada";

    @Override
    public String routingKey() {
        return ROUTING_KEY;
    }
}
