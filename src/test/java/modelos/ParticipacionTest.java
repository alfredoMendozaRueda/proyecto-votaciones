package modelos;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.within;

import org.junit.jupiter.api.Test;

class ParticipacionTest {

    @Test
    void calculaElPorcentajeDeParticipacion() {
        Participacion participacion = new Participacion("ALB", 5, 1);

        assertThat(participacion.getPorcentajeParticipacion()).isCloseTo(20.0, within(0.0001));
    }

    @Test
    void devuelveCeroSiNoHayNadieCensado() {
        Participacion participacion = new Participacion("ALB", 0, 0);

        assertThat(participacion.getPorcentajeParticipacion()).isZero();
    }

    @Test
    void elCienPorCienEsElMaximo() {
        Participacion participacion = new Participacion("ALB", 3, 3);

        assertThat(participacion.getPorcentajeParticipacion()).isCloseTo(100.0, within(0.0001));
    }
}
