package com.amr.votaciones.servicios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.amr.votaciones.excepciones.MinimoPartidosPoliticosExcepcion;
import com.amr.votaciones.modelos.Partido;
import com.amr.votaciones.repositorios.PartidoRepository;
import java.util.Collections;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class PartidoServicioTest {

    @Mock
    private PartidoRepository partidoRepository;

    private PartidoServicio partidoServicio;

    @BeforeEach
    void crearServicio() {
        partidoServicio = new PartidoServicio(partidoRepository);
    }

    @Test
    void creaUnPartidoDelegandoEnElRepositorio() {
        partidoServicio.crearPartido("PP", "Partido Popular", "../../imagenes/pp.jpg");

        verify(partidoRepository, times(1)).registrar(any(Partido.class));
    }

    @Test
    void devuelveLosPartidosCuandoSeAlcanzaElMinimoLegal() throws Exception {
        when(partidoRepository.contar()).thenReturn(7);
        List<Partido> partidos = Collections.singletonList(new Partido("PP", "Partido Popular", "pp.jpg"));
        when(partidoRepository.listarTodos()).thenReturn(partidos);

        assertThat(partidoServicio.partidosConMinimoRequerido()).isEqualTo(partidos);
    }

    @Test
    void rechazaCuandoNoSeAlcanzaElMinimoLegal() {
        when(partidoRepository.contar()).thenReturn(6);

        assertThatThrownBy(() -> partidoServicio.partidosConMinimoRequerido())
                .isInstanceOf(MinimoPartidosPoliticosExcepcion.class);
    }
}
