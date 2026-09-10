package servicios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import excepciones.MinimoPartidosPoliticosExcepcion;
import java.util.Collections;
import java.util.List;
import modelos.Partido;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import repositorios.PartidoRepositorio;

@ExtendWith(MockitoExtension.class)
class PartidoServicioTest {

    @Mock
    private PartidoRepositorio partidoRepositorio;

    private PartidoServicio partidoServicio;

    @BeforeEach
    void crearServicio() {
        partidoServicio = new PartidoServicio(partidoRepositorio);
    }

    @Test
    void creaUnPartidoDelegandoEnElRepositorio() throws Exception {
        partidoServicio.crearPartido("PP", "Partido Popular", "../../imagenes/pp.jpg");

        verify(partidoRepositorio, times(1)).registrar(any(Partido.class));
    }

    @Test
    void devuelveLosPartidosCuandoSeAlcanzaElMinimoLegal() throws Exception {
        when(partidoRepositorio.contar()).thenReturn(7);
        List<Partido> partidos = Collections.singletonList(new Partido("PP", "Partido Popular", "pp.jpg"));
        when(partidoRepositorio.listarTodos()).thenReturn(partidos);

        assertThat(partidoServicio.partidosConMinimoRequerido()).isEqualTo(partidos);
    }

    @Test
    void rechazaCuandoNoSeAlcanzaElMinimoLegal() throws Exception {
        when(partidoRepositorio.contar()).thenReturn(6);

        assertThatThrownBy(() -> partidoServicio.partidosConMinimoRequerido())
                .isInstanceOf(MinimoPartidosPoliticosExcepcion.class);
    }
}
