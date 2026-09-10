package servicios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import excepciones.EleccionYaExisteExcepcion;
import java.time.LocalDate;
import java.util.Optional;
import modelos.Eleccion;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import repositorios.EleccionRepositorio;
import repositorios.UsuarioRepositorio;
import repositorios.VotoRepositorio;

@ExtendWith(MockitoExtension.class)
class EleccionServicioTest {

    private static final String ID_ELECCION = "E1";

    @Mock
    private EleccionRepositorio eleccionRepositorio;
    @Mock
    private UsuarioRepositorio usuarioRepositorio;
    @Mock
    private VotoRepositorio votoRepositorio;

    private EleccionServicio eleccionServicio;

    @BeforeEach
    void crearServicio() {
        eleccionServicio = new EleccionServicio(eleccionRepositorio, usuarioRepositorio, votoRepositorio);
    }

    @Test
    void creaLaEleccionCuandoNoExisteNinguna() throws Exception {
        when(eleccionRepositorio.existeAlguna()).thenReturn(false);

        eleccionServicio.crearEleccion(ID_ELECCION, "Elección de prueba", LocalDate.now().plusDays(5));

        verify(eleccionRepositorio, times(1)).registrar(any(Eleccion.class));
    }

    @Test
    void rechazaCrearUnaSegundaEleccion() throws Exception {
        when(eleccionRepositorio.existeAlguna()).thenReturn(true);

        assertThatThrownBy(() -> eleccionServicio.crearEleccion(ID_ELECCION, "Otra", LocalDate.now().plusDays(5)))
                .isInstanceOf(EleccionYaExisteExcepcion.class);

        verify(eleccionRepositorio, never()).registrar(any());
    }

    @Test
    void alEliminarLaEleccionTambienReiniciaVotosYUsuarios() throws Exception {
        when(eleccionRepositorio.eliminar(ID_ELECCION)).thenReturn(true);

        boolean eliminada = eleccionServicio.eliminar(ID_ELECCION);

        assertThat(eliminada).isTrue();
        verify(usuarioRepositorio, times(1)).reiniciarTodosLosVotos();
        verify(votoRepositorio, times(1)).borrarTodos();
    }

    @Test
    void siNoSeEliminaLaEleccionNoTocaVotosNiUsuarios() throws Exception {
        when(eleccionRepositorio.eliminar(ID_ELECCION)).thenReturn(false);

        boolean eliminada = eleccionServicio.eliminar(ID_ELECCION);

        assertThat(eliminada).isFalse();
        verify(usuarioRepositorio, never()).reiniciarTodosLosVotos();
        verify(votoRepositorio, never()).borrarTodos();
    }

    @Test
    void estaHabilitadaSoloCuandoElEstadoLoEsExactamente() throws Exception {
        when(eleccionRepositorio.estadoDe(ID_ELECCION)).thenReturn(Optional.of("HABILITADA"));

        assertThat(eleccionServicio.estaHabilitada(ID_ELECCION)).isTrue();
    }

    @Test
    void noEstaHabilitadaCuandoNoHayEstadoRegistrado() throws Exception {
        when(eleccionRepositorio.estadoDe(ID_ELECCION)).thenReturn(Optional.empty());

        assertThat(eleccionServicio.estaHabilitada(ID_ELECCION)).isFalse();
    }
}
