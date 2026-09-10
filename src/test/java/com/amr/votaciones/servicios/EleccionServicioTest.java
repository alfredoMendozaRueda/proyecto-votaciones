package com.amr.votaciones.servicios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.amr.votaciones.eventos.EleccionDeshabilitadaEvento;
import com.amr.votaciones.eventos.EleccionHabilitadaEvento;
import com.amr.votaciones.excepciones.EleccionYaExisteExcepcion;
import com.amr.votaciones.modelos.Eleccion;
import com.amr.votaciones.notificaciones.EventoElectoralPublicador;
import com.amr.votaciones.repositorios.EleccionRepository;
import com.amr.votaciones.repositorios.UsuarioRepository;
import com.amr.votaciones.repositorios.VotoRepository;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class EleccionServicioTest {

    private static final String ID_ELECCION = "E1";

    @Mock
    private EleccionRepository eleccionRepository;
    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private VotoRepository votoRepository;
    @Mock
    private EventoElectoralPublicador eventoElectoralPublicador;

    private EleccionServicio eleccionServicio;

    @BeforeEach
    void crearServicio() {
        eleccionServicio = new EleccionServicio(eleccionRepository, usuarioRepository, votoRepository,
                eventoElectoralPublicador);
    }

    @Test
    void creaLaEleccionCuandoNoExisteNinguna() throws Exception {
        when(eleccionRepository.existeAlguna()).thenReturn(false);

        eleccionServicio.crearEleccion(ID_ELECCION, "Elección de prueba", LocalDate.now().plusDays(5));

        verify(eleccionRepository, times(1)).registrar(any(Eleccion.class));
    }

    @Test
    void rechazaCrearUnaSegundaEleccion() {
        when(eleccionRepository.existeAlguna()).thenReturn(true);

        assertThatThrownBy(() -> eleccionServicio.crearEleccion(ID_ELECCION, "Otra", LocalDate.now().plusDays(5)))
                .isInstanceOf(EleccionYaExisteExcepcion.class);

        verify(eleccionRepository, never()).registrar(any());
    }

    @Test
    void alEliminarLaEleccionTambienReiniciaVotosYUsuarios() {
        when(eleccionRepository.eliminar(ID_ELECCION)).thenReturn(true);

        boolean eliminada = eleccionServicio.eliminar(ID_ELECCION);

        assertThat(eliminada).isTrue();
        verify(usuarioRepository, times(1)).reiniciarTodosLosVotos();
        verify(votoRepository, times(1)).borrarTodos();
    }

    @Test
    void siNoSeEliminaLaEleccionNoTocaVotosNiUsuarios() {
        when(eleccionRepository.eliminar(ID_ELECCION)).thenReturn(false);

        boolean eliminada = eleccionServicio.eliminar(ID_ELECCION);

        assertThat(eliminada).isFalse();
        verify(usuarioRepository, never()).reiniciarTodosLosVotos();
        verify(votoRepository, never()).borrarTodos();
    }

    @Test
    void alHabilitarPublicaElEvento() {
        when(eleccionRepository.habilitar(ID_ELECCION)).thenReturn(1);

        boolean habilitada = eleccionServicio.habilitar(ID_ELECCION);

        assertThat(habilitada).isTrue();
        verify(eventoElectoralPublicador, times(1)).publicar(any(EleccionHabilitadaEvento.class));
    }

    @Test
    void siNoSeHabilitaNoPublicaElEvento() {
        when(eleccionRepository.habilitar(ID_ELECCION)).thenReturn(0);

        boolean habilitada = eleccionServicio.habilitar(ID_ELECCION);

        assertThat(habilitada).isFalse();
        verify(eventoElectoralPublicador, never()).publicar(any());
    }

    @Test
    void alDeshabilitarPublicaElEvento() {
        when(eleccionRepository.deshabilitar(ID_ELECCION)).thenReturn(1);

        boolean deshabilitada = eleccionServicio.deshabilitar(ID_ELECCION);

        assertThat(deshabilitada).isTrue();
        verify(eventoElectoralPublicador, times(1)).publicar(any(EleccionDeshabilitadaEvento.class));
    }

    @Test
    void siNoSeDeshabilitaNoPublicaElEvento() {
        when(eleccionRepository.deshabilitar(ID_ELECCION)).thenReturn(0);

        boolean deshabilitada = eleccionServicio.deshabilitar(ID_ELECCION);

        assertThat(deshabilitada).isFalse();
        verify(eventoElectoralPublicador, never()).publicar(any());
    }

    @Test
    void estaHabilitadaSoloCuandoElEstadoLoEsExactamente() {
        when(eleccionRepository.estadoDe(ID_ELECCION)).thenReturn(Optional.of("HABILITADA"));

        assertThat(eleccionServicio.estaHabilitada(ID_ELECCION)).isTrue();
    }

    @Test
    void noEstaHabilitadaCuandoNoHayEstadoRegistrado() {
        when(eleccionRepository.estadoDe(ID_ELECCION)).thenReturn(Optional.empty());

        assertThat(eleccionServicio.estaHabilitada(ID_ELECCION)).isFalse();
    }
}
