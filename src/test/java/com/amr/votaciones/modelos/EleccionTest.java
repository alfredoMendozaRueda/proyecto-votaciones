package com.amr.votaciones.modelos;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.LocalDate;
import org.junit.jupiter.api.Test;

class EleccionTest {

    @Test
    void unaEleccionNuevaEmpiezaInhabilitada() {
        Eleccion eleccion = new Eleccion("E1", "Elección de prueba", LocalDate.now().plusDays(5));

        assertThat(eleccion.getEstado()).isEqualTo(Eleccion.ESTADO_INHABILITADA);
        assertThat(eleccion.estaHabilitada()).isFalse();
        assertThat(eleccion.getFechaInicio()).isEqualTo(LocalDate.now());
    }

    @Test
    void estaHabilitadaEsInsensibleAMayusculas() {
        Eleccion eleccion = new Eleccion("E1", "Elección", LocalDate.now(), LocalDate.now().plusDays(1), "HABILITADA");

        assertThat(eleccion.estaHabilitada()).isTrue();
    }

    @Test
    void dosEleccionesConElMismoIdSonIguales() {
        Eleccion primera = new Eleccion("E1", "Descripción A", LocalDate.now().plusDays(1));
        Eleccion segunda = new Eleccion("E1", "Descripción B", LocalDate.now().plusDays(2));

        assertThat(primera).isEqualTo(segunda);
        assertThat(primera.hashCode()).isEqualTo(segunda.hashCode());
    }
}
