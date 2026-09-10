package com.amr.votaciones.servicios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.amr.votaciones.eventos.VotoRegistradoEvento;
import com.amr.votaciones.excepciones.DniNoEnCensoExcepcion;
import com.amr.votaciones.excepciones.EleccionNoDisponibleExcepcion;
import com.amr.votaciones.excepciones.SinPartidosDisponiblesExcepcion;
import com.amr.votaciones.excepciones.YaHaVotadoExcepcion;
import com.amr.votaciones.modelos.Censo;
import com.amr.votaciones.modelos.Eleccion;
import com.amr.votaciones.modelos.Partido;
import com.amr.votaciones.notificaciones.EventoElectoralPublicador;
import com.amr.votaciones.repositorios.CensoRepository;
import com.amr.votaciones.repositorios.EleccionRepository;
import com.amr.votaciones.repositorios.PartidoRepository;
import com.amr.votaciones.repositorios.UsuarioRepository;
import com.amr.votaciones.repositorios.VotoRepository;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class VotacionServicioTest {

    private static final String DNI = "12121212K";
    private static final String ID_ELECCION = "E1";

    @Mock
    private EleccionRepository eleccionRepository;
    @Mock
    private PartidoRepository partidoRepository;
    @Mock
    private CensoRepository censoRepository;
    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private VotoRepository votoRepository;
    @Mock
    private EventoElectoralPublicador eventoElectoralPublicador;

    private VotacionServicio votacionServicio;

    @BeforeEach
    void crearServicio() {
        votacionServicio = new VotacionServicio(eleccionRepository, partidoRepository, censoRepository,
                usuarioRepository, votoRepository, eventoElectoralPublicador);
    }

    @Test
    void devuelveLosPartidosCuandoLaEleccionEstaHabilitada() throws Exception {
        when(eleccionRepository.idDeLaEleccionActual()).thenReturn(Optional.of(ID_ELECCION));
        when(eleccionRepository.estadoDe(ID_ELECCION)).thenReturn(Optional.of(Eleccion.ESTADO_HABILITADA));
        List<Partido> partidos = Collections.singletonList(new Partido("PP", "Partido Popular", "pp.jpg"));
        when(partidoRepository.listarTodos()).thenReturn(partidos);

        assertThat(votacionServicio.partidosParaVotar()).isEqualTo(partidos);
    }

    @Test
    void rechazaVotarSiNoHayEleccionEnCurso() {
        when(eleccionRepository.idDeLaEleccionActual()).thenReturn(Optional.empty());

        assertThatThrownBy(() -> votacionServicio.partidosParaVotar())
                .isInstanceOf(EleccionNoDisponibleExcepcion.class);
    }

    @Test
    void rechazaVotarSiLaEleccionEstaDeshabilitada() {
        when(eleccionRepository.idDeLaEleccionActual()).thenReturn(Optional.of(ID_ELECCION));
        when(eleccionRepository.estadoDe(ID_ELECCION)).thenReturn(Optional.of(Eleccion.ESTADO_INHABILITADA));

        assertThatThrownBy(() -> votacionServicio.partidosParaVotar())
                .isInstanceOf(EleccionNoDisponibleExcepcion.class);
    }

    @Test
    void rechazaVotarSiNoHayPartidos() {
        when(eleccionRepository.idDeLaEleccionActual()).thenReturn(Optional.of(ID_ELECCION));
        when(eleccionRepository.estadoDe(ID_ELECCION)).thenReturn(Optional.of(Eleccion.ESTADO_HABILITADA));
        when(partidoRepository.listarTodos()).thenReturn(Collections.emptyList());

        assertThatThrownBy(() -> votacionServicio.partidosParaVotar())
                .isInstanceOf(SinPartidosDisponiblesExcepcion.class);
    }

    @Test
    void registraElVotoYMarcaAlUsuarioComoVotado() throws Exception {
        when(usuarioRepository.haVotado(DNI)).thenReturn(false);
        when(censoRepository.obtenerPorDni(DNI))
                .thenReturn(Optional.of(new Censo(DNI, "Nuria Cano", LocalDate.of(1994, 2, 10), "Calle 1", "CUEN")));

        votacionServicio.votar(DNI, "VOX");

        verify(votoRepository, times(1)).registrar(any());
        verify(usuarioRepository, times(1)).marcarComoVotado(DNI);
        verify(eventoElectoralPublicador, times(1)).publicar(any(VotoRegistradoEvento.class));
    }

    @Test
    void impideVotarDosVeces() {
        when(usuarioRepository.haVotado(DNI)).thenReturn(true);

        assertThatThrownBy(() -> votacionServicio.votar(DNI, "VOX"))
                .isInstanceOf(YaHaVotadoExcepcion.class);

        verify(votoRepository, never()).registrar(any());
        verify(eventoElectoralPublicador, never()).publicar(any());
    }

    @Test
    void impideVotarAQuienNoEstaEnElCenso() {
        when(usuarioRepository.haVotado(DNI)).thenReturn(false);
        when(censoRepository.obtenerPorDni(DNI)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> votacionServicio.votar(DNI, "VOX"))
                .isInstanceOf(DniNoEnCensoExcepcion.class);

        verify(votoRepository, never()).registrar(any());
        verify(eventoElectoralPublicador, never()).publicar(any());
    }
}
