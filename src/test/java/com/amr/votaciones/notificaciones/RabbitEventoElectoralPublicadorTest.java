package com.amr.votaciones.notificaciones;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import com.amr.votaciones.config.RabbitConfig;
import com.amr.votaciones.eventos.VotoRegistradoEvento;
import java.time.Instant;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.AmqpConnectException;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

@ExtendWith(MockitoExtension.class)
class RabbitEventoElectoralPublicadorTest {

    @Mock
    private RabbitTemplate rabbitTemplate;

    private RabbitEventoElectoralPublicador publicador;

    @Test
    void publicaElEventoEnElExchangeConSuRoutingKey() {
        publicador = new RabbitEventoElectoralPublicador(rabbitTemplate);
        VotoRegistradoEvento evento = new VotoRegistradoEvento("CUEN", "VOX", Instant.now());

        publicador.publicar(evento);

        verify(rabbitTemplate, times(1))
                .convertAndSend(eq(RabbitConfig.EXCHANGE_EVENTOS), eq(VotoRegistradoEvento.ROUTING_KEY), eq(evento));
    }

    @Test
    void unFalloAlPublicarNoSePropaga() {
        publicador = new RabbitEventoElectoralPublicador(rabbitTemplate);
        doThrow(new AmqpConnectException(new RuntimeException("broker caido")))
                .when(rabbitTemplate).convertAndSend(any(String.class), any(String.class), any(Object.class));

        VotoRegistradoEvento evento = new VotoRegistradoEvento("CUEN", "VOX", Instant.now());

        publicador.publicar(evento);
    }
}
