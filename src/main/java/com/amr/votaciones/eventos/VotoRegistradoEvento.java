package com.amr.votaciones.eventos;

import java.time.Instant;

/**
 * Se publica cuando se registra un voto. No incluye el DNI del votante
 * a proposito: el voto es anonimo, igual que en la entidad {@code Voto}.
 */
public record VotoRegistradoEvento(String idLocalidad, String siglasPartido, Instant fecha) implements EventoElectoral {

    public static final String ROUTING_KEY = "voto.registrado";

    @Override
    public String routingKey() {
        return ROUTING_KEY;
    }
}
