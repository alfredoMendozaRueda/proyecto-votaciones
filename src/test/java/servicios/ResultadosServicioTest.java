package servicios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import excepciones.ElementoNoEncontradoExcepcion;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import modelos.ResultadoPartido;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import repositorios.LocalidadRepositorio;
import repositorios.PartidoRepositorio;
import repositorios.VotoRepositorio;

@ExtendWith(MockitoExtension.class)
class ResultadosServicioTest {

    @Mock
    private VotoRepositorio votoRepositorio;
    @Mock
    private LocalidadRepositorio localidadRepositorio;
    @Mock
    private PartidoRepositorio partidoRepositorio;

    private ResultadosServicio resultadosServicio;

    @BeforeEach
    void crearServicio() {
        resultadosServicio = new ResultadosServicio(votoRepositorio, localidadRepositorio, partidoRepositorio);
    }

    @Test
    void elGanadorEsElPartidoConMasVotos() throws Exception {
        List<ResultadoPartido> resultados = Arrays.asList(
                new ResultadoPartido("PP", "Partido Popular", 3),
                new ResultadoPartido("VOX", "VOX", 7),
                new ResultadoPartido("PSOE", "PSOE", 5));
        when(votoRepositorio.resultadosGlobales()).thenReturn(resultados);

        Optional<ResultadoPartido> ganador = resultadosServicio.partidoGanador();

        assertThat(ganador).isPresent();
        assertThat(ganador.get().getSiglas()).isEqualTo("VOX");
    }

    @Test
    void enUnEmpateGanaElPrimeroEncontrado() throws Exception {
        List<ResultadoPartido> resultados = Arrays.asList(
                new ResultadoPartido("PP", "Partido Popular", 5),
                new ResultadoPartido("VOX", "VOX", 5));
        when(votoRepositorio.resultadosGlobales()).thenReturn(resultados);

        Optional<ResultadoPartido> ganador = resultadosServicio.partidoGanador();

        assertThat(ganador).isPresent();
        assertThat(ganador.get().getSiglas()).isEqualTo("PP");
    }

    @Test
    void noHayGanadorSiNadieHaVotadoTodavia() throws Exception {
        List<ResultadoPartido> resultados = Arrays.asList(
                new ResultadoPartido("PP", "Partido Popular", 0),
                new ResultadoPartido("VOX", "VOX", 0));
        when(votoRepositorio.resultadosGlobales()).thenReturn(resultados);

        assertThat(resultadosServicio.partidoGanador()).isEmpty();
    }

    @Test
    void noHayGanadorSiNoHayNingunPartido() throws Exception {
        when(votoRepositorio.resultadosGlobales()).thenReturn(Collections.emptyList());

        assertThat(resultadosServicio.partidoGanador()).isEmpty();
    }

    @Test
    void elPresidenteGanadorEsElDelPartidoGanador() throws Exception {
        when(votoRepositorio.resultadosGlobales())
                .thenReturn(Collections.singletonList(new ResultadoPartido("VOX", "VOX", 4)));
        when(partidoRepositorio.presidenteDe("VOX")).thenReturn(Optional.of("Sergio Domínguez"));

        assertThat(resultadosServicio.presidenteGanador()).contains("Sergio Domínguez");
    }

    @Test
    void resultadosPorLocalidadRechazaUnaLocalidadDesconocida() throws Exception {
        when(localidadRepositorio.idDeLocalidad("Marte")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resultadosServicio.resultadosPorLocalidad("Marte"))
                .isInstanceOf(ElementoNoEncontradoExcepcion.class);
    }

    @Test
    void resultadosPorComunidadRechazaUnaComunidadDesconocida() throws Exception {
        when(localidadRepositorio.idDeComunidad("Marte")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> resultadosServicio.resultadosPorComunidad("Marte"))
                .isInstanceOf(ElementoNoEncontradoExcepcion.class);
    }
}
