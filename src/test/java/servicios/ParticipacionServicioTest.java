package servicios;

import static java.util.Arrays.asList;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import excepciones.ElementoNoEncontradoExcepcion;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import repositorios.CensoRepositorio;
import repositorios.LocalidadRepositorio;
import repositorios.ParticipacionRepositorio;
import repositorios.VotoRepositorio;

@ExtendWith(MockitoExtension.class)
class ParticipacionServicioTest {

    @Mock
    private CensoRepositorio censoRepositorio;
    @Mock
    private VotoRepositorio votoRepositorio;
    @Mock
    private LocalidadRepositorio localidadRepositorio;
    @Mock
    private ParticipacionRepositorio participacionRepositorio;

    private ParticipacionServicio participacionServicio;

    @BeforeEach
    void crearServicio() {
        participacionServicio = new ParticipacionServicio(censoRepositorio, votoRepositorio, localidadRepositorio,
                participacionRepositorio);
    }

    @Test
    void calculaElPorcentajeComoVotosEntreCensados() throws Exception {
        when(localidadRepositorio.idDeLocalidad("Albacete")).thenReturn(Optional.of("ALB"));
        when(censoRepositorio.contarCensadosEnLocalidad("ALB")).thenReturn(5);
        when(votoRepositorio.votosEnLocalidad("ALB")).thenReturn(1);

        assertThat(participacionServicio.porcentajeParticipacion("Albacete")).isCloseTo(20.0, within(0.0001));
    }

    @Test
    void devuelveCeroSiNoHayNadieCensado() throws Exception {
        when(localidadRepositorio.idDeLocalidad("Albacete")).thenReturn(Optional.of("ALB"));
        when(censoRepositorio.contarCensadosEnLocalidad("ALB")).thenReturn(0);

        assertThat(participacionServicio.porcentajeParticipacion("Albacete")).isZero();
    }

    @Test
    void rechazaUnaLocalidadDesconocida() throws Exception {
        when(localidadRepositorio.idDeLocalidad("Marte")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> participacionServicio.porcentajeParticipacion("Marte"))
                .isInstanceOf(ElementoNoEncontradoExcepcion.class);
    }

    @Test
    void recalcularParticipacionBorraLoAnteriorYRegistraCadaLocalidad() throws Exception {
        List<String> ids = asList("ALB", "CUEN");
        when(localidadRepositorio.listarIdsLocalidades()).thenReturn(ids);
        when(censoRepositorio.contarCensadosEnLocalidad("ALB")).thenReturn(5);
        when(votoRepositorio.votosEnLocalidad("ALB")).thenReturn(1);
        when(censoRepositorio.contarCensadosEnLocalidad("CUEN")).thenReturn(3);
        when(votoRepositorio.votosEnLocalidad("CUEN")).thenReturn(1);

        participacionServicio.recalcularParticipacion();

        verify(participacionRepositorio, times(1)).borrarTodas();
        verify(participacionRepositorio, times(2)).registrar(any());
    }
}
