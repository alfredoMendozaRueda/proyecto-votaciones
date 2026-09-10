package com.amr.votaciones.servicios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.amr.votaciones.excepciones.ElementoNoEncontradoExcepcion;
import com.amr.votaciones.modelos.ResultadoPartido;
import com.amr.votaciones.repositorios.CandidatoRepository;
import com.amr.votaciones.repositorios.ComunidadRepository;
import com.amr.votaciones.repositorios.LocalidadRepository;
import com.amr.votaciones.repositorios.VotoRepository;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class ResultadosServicioTest {

    @Mock
    private VotoRepository votoRepository;
    @Mock
    private LocalidadRepository localidadRepository;
    @Mock
    private ComunidadRepository comunidadRepository;
    @Mock
    private CandidatoRepository candidatoRepository;

    private ResultadosServicio resultadosServicio;

    @BeforeEach
    void crearServicio() {
        resultadosServicio = new ResultadosServicio(votoRepository, localidadRepository, comunidadRepository,
                candidatoRepository);
    }

    @Test
    void elGanadorEsElPartidoConMasVotos() {
        List<ResultadoPartido> resultados = Arrays.asList(
                new ResultadoPartido("PP", "Partido Popular", 3),
                new ResultadoPartido("VOX", "VOX", 7),
                new ResultadoPartido("PSOE", "PSOE", 5));
        when(votoRepository.resultadosGlobales()).thenReturn(resultados);

        Optional<ResultadoPartido> ganador = resultadosServicio.partidoGanador();

        assertThat(ganador).isPresent();
        assertThat(ganador.get().getSiglas()).isEqualTo("VOX");
    }

    @Test
    void enUnEmpateGanaElPrimeroEncontrado() {
        List<ResultadoPartido> resultados = Arrays.asList(
                new ResultadoPartido("PP", "Partido Popular", 5),
                new ResultadoPartido("VOX", "VOX", 5));
        when(votoRepository.resultadosGlobales()).thenReturn(resultados);

        Optional<ResultadoPartido> ganador = resultadosServicio.partidoGanador();

        assertThat(ganador).isPresent();
        assertThat(ganador.get().getSiglas()).isEqualTo("PP");
    }

    @Test
    void noHayGanadorSiNadieHaVotadoTodavia() {
        List<ResultadoPartido> resultados = Arrays.asList(
                new ResultadoPartido("PP", "Partido Popular", 0),
                new ResultadoPartido("VOX", "VOX", 0));
        when(votoRepository.resultadosGlobales()).thenReturn(resultados);

        assertThat(resultadosServicio.partidoGanador()).isEmpty();
    }

    @Test
    void noHayGanadorSiNoHayNingunPartido() {
        when(votoRepository.resultadosGlobales()).thenReturn(Collections.emptyList());

        assertThat(resultadosServicio.partidoGanador()).isEmpty();
    }

    @Test
    void elPresidenteGanadorEsElDelPartidoGanador() {
        when(votoRepository.resultadosGlobales())
                .thenReturn(Collections.singletonList(new ResultadoPartido("VOX", "VOX", 4)));
        when(candidatoRepository.presidenteDe("VOX")).thenReturn(Optional.of("Sergio Domínguez"));

        assertThat(resultadosServicio.presidenteGanador()).contains("Sergio Domínguez");
    }

    @Test
    void resultadosPorLocalidadRechazaUnaLocalidadDesconocida() {
        when(localidadRepository.idDeLocalidad("Marte")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resultadosServicio.resultadosPorLocalidad("Marte"))
                .isInstanceOf(ElementoNoEncontradoExcepcion.class);
    }

    @Test
    void resultadosPorComunidadRechazaUnaComunidadDesconocida() {
        when(comunidadRepository.idDeComunidad("Marte")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resultadosServicio.resultadosPorComunidad("Marte"))
                .isInstanceOf(ElementoNoEncontradoExcepcion.class);
    }
}
