package com.amr.votaciones.notificaciones;

import com.amr.votaciones.config.RabbitConfig;
import com.amr.votaciones.eventos.EventoElectoral;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.AmqpException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;

/**
 * Publica los eventos electorales al exchange de RabbitMQ. Un fallo al
 * publicar (broker caido, credenciales invalidas...) se registra como aviso
 * pero nunca se propaga: la notificacion es un efecto secundario, no debe
 * hacer fallar la operacion de negocio (votar, habilitar una eleccion...)
 * que la origino.
 */
@Component
public class RabbitEventoElectoralPublicador implements EventoElectoralPublicador {

    private static final Logger LOG = LoggerFactory.getLogger(RabbitEventoElectoralPublicador.class);

    private final RabbitTemplate rabbitTemplate;

    public RabbitEventoElectoralPublicador(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    @Override
    public void publicar(EventoElectoral evento) {
        try {
            rabbitTemplate.convertAndSend(RabbitConfig.EXCHANGE_EVENTOS, evento.routingKey(), evento);
        } catch (AmqpException excepcion) {
            LOG.warn("No se ha podido publicar el evento {} en RabbitMQ: {}",
                    evento.routingKey(), excepcion.getMessage());
        }
    }
}
