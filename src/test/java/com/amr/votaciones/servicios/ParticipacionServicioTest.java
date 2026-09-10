package com.amr.votaciones.servicios;

import static java.util.Arrays.asList;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.amr.votaciones.excepciones.ElementoNoEncontradoExcepcion;
import com.amr.votaciones.repositorios.CensoRepository;
import com.amr.votaciones.repositorios.LocalidadRepository;
import com.amr.votaciones.repositorios.ParticipacionRepository;
import com.amr.votaciones.repositorios.VotoRepository;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ParticipacionServicioTest {

    @Mock
    private CensoRepository censoRepository;
    @Mock
    private VotoRepository votoRepository;
    @Mock
    private LocalidadRepository localidadRepository;
    @Mock
    private ParticipacionRepository participacionRepository;

    private ParticipacionServicio participacionServicio;

    @BeforeEach
    void crearServicio() {
        participacionServicio = new ParticipacionServicio(censoRepository, votoRepository, localidadRepository,
                participacionRepository);
    }

    @Test
    void calculaElPorcentajeComoVotosEntreCensados() throws Exception {
        when(localidadRepository.idDeLocalidad("Albacete")).thenReturn(Optional.of("ALB"));
        when(censoRepository.contarCensadosEnLocalidad("ALB")).thenReturn(5);
        when(votoRepository.votosEnLocalidad("ALB")).thenReturn(1);

        assertThat(participacionServicio.porcentajeParticipacion("Albacete")).isCloseTo(20.0, within(0.0001));
    }

    @Test
    void devuelveCeroSiNoHayNadieCensado() throws Exception {
        when(localidadRepository.idDeLocalidad("Albacete")).thenReturn(Optional.of("ALB"));
        when(censoRepository.contarCensadosEnLocalidad("ALB")).thenReturn(0);

        assertThat(participacionServicio.porcentajeParticipacion("Albacete")).isZero();
    }

    @Test
    void rechazaUnaLocalidadDesconocida() {
        when(localidadRepository.idDeLocalidad("Marte")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> participacionServicio.porcentajeParticipacion("Marte"))
                .isInstanceOf(ElementoNoEncontradoExcepcion.class);
    }

    @Test
    void recalcularParticipacionBorraLoAnteriorYRegistraCadaLocalidad() {
        List<String> ids = asList("ALB", "CUEN");
        when(localidadRepository.listarIdsLocalidades()).thenReturn(ids);
        when(censoRepository.contarCensadosEnLocalidad("ALB")).thenReturn(5);
        when(votoRepository.votosEnLocalidad("ALB")).thenReturn(1);
        when(censoRepository.contarCensadosEnLocalidad("CUEN")).thenReturn(3);
        when(votoRepository.votosEnLocalidad("CUEN")).thenReturn(1);

        participacionServicio.recalcularParticipacion();

        verify(participacionRepository, times(1)).borrarTodas();
        verify(participacionRepository, times(2)).registrar(any());
    }
}
