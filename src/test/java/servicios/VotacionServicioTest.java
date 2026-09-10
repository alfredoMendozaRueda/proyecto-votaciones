package servicios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import excepciones.DniNoEnCensoExcepcion;
import excepciones.EleccionNoDisponibleExcepcion;
import excepciones.SinPartidosDisponiblesExcepcion;
import excepciones.YaHaVotadoExcepcion;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import modelos.Censo;
import modelos.Eleccion;
import modelos.Partido;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import repositorios.CensoRepositorio;
import repositorios.EleccionRepositorio;
import repositorios.PartidoRepositorio;
import repositorios.UsuarioRepositorio;
import repositorios.VotoRepositorio;

@ExtendWith(MockitoExtension.class)
class VotacionServicioTest {

    private static final String DNI = "12121212K";
    private static final String ID_ELECCION = "E1";

    @Mock
    private EleccionRepositorio eleccionRepositorio;
    @Mock
    private PartidoRepositorio partidoRepositorio;
    @Mock
    private CensoRepositorio censoRepositorio;
    @Mock
    private UsuarioRepositorio usuarioRepositorio;
    @Mock
    private VotoRepositorio votoRepositorio;

    private VotacionServicio votacionServicio;

    @BeforeEach
    void crearServicio() {
        votacionServicio = new VotacionServicio(eleccionRepositorio, partidoRepositorio, censoRepositorio,
                usuarioRepositorio, votoRepositorio);
    }

    @Test
    void devuelveLosPartidosCuandoLaEleccionEstaHabilitada() throws Exception {
        when(eleccionRepositorio.idDeLaEleccionActual()).thenReturn(Optional.of(ID_ELECCION));
        when(eleccionRepositorio.estadoDe(ID_ELECCION)).thenReturn(Optional.of(Eleccion.ESTADO_HABILITADA));
        List<Partido> partidos = Collections.singletonList(new Partido("PP", "Partido Popular", "pp.jpg"));
        when(partidoRepositorio.listarTodos()).thenReturn(partidos);

        assertThat(votacionServicio.partidosParaVotar()).isEqualTo(partidos);
    }

    @Test
    void rechazaVotarSiNoHayEleccionEnCurso() throws Exception {
        when(eleccionRepositorio.idDeLaEleccionActual()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> votacionServicio.partidosParaVotar())
                .isInstanceOf(EleccionNoDisponibleExcepcion.class);
    }

    @Test
    void rechazaVotarSiLaEleccionEstaDeshabilitada() throws Exception {
        when(eleccionRepositorio.idDeLaEleccionActual()).thenReturn(Optional.of(ID_ELECCION));
        when(eleccionRepositorio.estadoDe(ID_ELECCION)).thenReturn(Optional.of(Eleccion.ESTADO_INHABILITADA));

        assertThatThrownBy(() -> votacionServicio.partidosParaVotar())
                .isInstanceOf(EleccionNoDisponibleExcepcion.class);
    }

    @Test
    void rechazaVotarSiNoHayPartidos() throws Exception {
        when(eleccionRepositorio.idDeLaEleccionActual()).thenReturn(Optional.of(ID_ELECCION));
        when(eleccionRepositorio.estadoDe(ID_ELECCION)).thenReturn(Optional.of(Eleccion.ESTADO_HABILITADA));
        when(partidoRepositorio.listarTodos()).thenReturn(Collections.emptyList());

        assertThatThrownBy(() -> votacionServicio.partidosParaVotar())
                .isInstanceOf(SinPartidosDisponiblesExcepcion.class);
    }

    @Test
    void registraElVotoYMarcaAlUsuarioComoVotado() throws Exception {
        when(usuarioRepositorio.haVotado(DNI)).thenReturn(false);
        when(censoRepositorio.obtenerPorDni(DNI))
                .thenReturn(Optional.of(new Censo(DNI, "Nuria Cano", LocalDate.of(1994, 2, 10), "Calle 1", "CUEN")));

        votacionServicio.votar(DNI, "VOX");

        verify(votoRepositorio, times(1)).registrar(any());
        verify(usuarioRepositorio, times(1)).marcarComoVotado(DNI);
    }

    @Test
    void impideVotarDosVeces() throws Exception {
        when(usuarioRepositorio.haVotado(DNI)).thenReturn(true);

        assertThatThrownBy(() -> votacionServicio.votar(DNI, "VOX"))
                .isInstanceOf(YaHaVotadoExcepcion.class);

        verify(votoRepositorio, never()).registrar(any());
    }

    @Test
    void impideVotarAQuienNoEstaEnElCenso() throws Exception {
        when(usuarioRepositorio.haVotado(DNI)).thenReturn(false);
        when(censoRepositorio.obtenerPorDni(DNI)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> votacionServicio.votar(DNI, "VOX"))
                .isInstanceOf(DniNoEnCensoExcepcion.class);

        verify(votoRepositorio, never()).registrar(any());
    }
}
