package com.amr.votaciones.notificaciones;

import com.amr.votaciones.config.RabbitConfig;
import com.amr.votaciones.eventos.EventoElectoral;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;

/**
 * Consumidor de referencia: se suscribe a todos los eventos electorales
 * (routing key {@code #}) y los deja en el log, a modo de auditoria minima
 * y como prueba de que la infraestructura de mensajeria funciona de
 * extremo a extremo. Otros consumidores (envio de emails, un dashboard en
 * tiempo real...) pueden anadir su propia cola bindeada al mismo exchange
 * sin tocar el codigo que publica los eventos.
 */
@Component
public class EventoElectoralLogListener {

    private static final Logger LOG = LoggerFactory.getLogger(EventoElectoralLogListener.class);

    @RabbitListener(queues = RabbitConfig.COLA_LOG)
    public void escuchar(EventoElectoral evento) {
        LOG.info("Evento electoral recibido: {}", evento);
    }
}
