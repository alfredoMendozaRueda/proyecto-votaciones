package com.amr.votaciones.eventos;

/**
 * Marca los eventos de dominio que se publican a RabbitMQ cuando ocurre
 * algo relevante en el proceso electoral (un voto, un cambio de estado de
 * la eleccion...). La routing key identifica el tipo de evento dentro del
 * exchange de tipo topic.
 */
public sealed interface EventoElectoral permits VotoRegistradoEvento, EleccionHabilitadaEvento, EleccionDeshabilitadaEvento {

    String routingKey();
}
