package com.amr.votaciones.notificaciones;

import com.amr.votaciones.eventos.EventoElectoral;

/**
 * Publica eventos de dominio electorales hacia un sistema de mensajeria.
 * Aislado detras de una interfaz, igual que {@code EncriptadorContrasena},
 * para que los servicios no dependan directamente de RabbitMQ ni de si el
 * broker esta disponible.
 */
public interface EventoElectoralPublicador {

    void publicar(EventoElectoral evento);
}
