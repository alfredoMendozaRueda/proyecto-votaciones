package com.amr.votaciones.config;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitAdmin;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Infraestructura de mensajeria para los eventos electorales: un exchange
 * de tipo topic, con una cola de auditoria que se suscribe a todos los
 * eventos ({@link EventoElectoralLogListener}).
 *
 * <p>El {@link RabbitAdmin} se declara explicitamente con
 * {@code ignoreDeclarationExceptions(true)} para que, si RabbitMQ no esta
 * disponible (por ejemplo en desarrollo local sin el broker levantado, o
 * en un despliegue que no lo necesita), la aplicacion arranque igualmente:
 * las notificaciones son un canal informativo, nunca deben impedir que
 * funcione el resto de la app.</p>
 */
@Configuration
public class RabbitConfig {

    public static final String EXCHANGE_EVENTOS = "elecciones.eventos";
    public static final String COLA_LOG = "elecciones.eventos.log";

    @Bean
    public RabbitAdmin rabbitAdmin(ConnectionFactory connectionFactory) {
        RabbitAdmin rabbitAdmin = new RabbitAdmin(connectionFactory);
        rabbitAdmin.setIgnoreDeclarationExceptions(true);
        return rabbitAdmin;
    }

    @Bean
    public TopicExchange eventosExchange() {
        return new TopicExchange(EXCHANGE_EVENTOS, true, false);
    }

    @Bean
    public Queue eventosLogQueue() {
        return new Queue(COLA_LOG, true);
    }

    @Bean
    public Binding eventosLogBinding(Queue eventosLogQueue, TopicExchange eventosExchange) {
        return BindingBuilder.bind(eventosLogQueue).to(eventosExchange).with("#");
    }

    @Bean
    public Jackson2JsonMessageConverter jackson2JsonMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }
}
