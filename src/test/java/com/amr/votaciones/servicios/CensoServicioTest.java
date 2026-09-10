package com.amr.votaciones.servicios;

import static java.util.Arrays.asList;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import com.amr.votaciones.excepciones.ElementoNoEncontradoExcepcion;
import com.amr.votaciones.modelos.Censo;
import com.amr.votaciones.repositorios.CensoRepository;
import com.amr.votaciones.repositorios.ComunidadRepository;
import com.amr.votaciones.repositorios.LocalidadRepository;
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
class CensoServicioTest {

    @Mock
    private CensoRepository censoRepository;
    @Mock
    private LocalidadRepository localidadRepository;
    @Mock
    private ComunidadRepository comunidadRepository;

    private CensoServicio censoServicio;

    @BeforeEach
    void crearServicio() {
        censoServicio = new CensoServicio(censoRepository, localidadRepository, comunidadRepository);
    }

    @Test
    void devuelveElCensoDeUnaLocalidadConocida() throws Exception {
        List<Censo> censo = Collections.singletonList(
                new Censo("12345678Z", "Laura Martínez", LocalDate.of(1990, 5, 12), "Calle Mayor 15", "ALB"));
        when(localidadRepository.idDeLocalidad("Albacete")).thenReturn(Optional.of("ALB"));
        when(censoRepository.listarPorLocalidad("ALB")).thenReturn(censo);

        assertThat(censoServicio.censoPorLocalidad("Albacete")).isEqualTo(censo);
    }

    @Test
    void rechazaUnaLocalidadDesconocida() {
        when(localidadRepository.idDeLocalidad("Marte")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> censoServicio.censoPorLocalidad("Marte"))
                .isInstanceOf(ElementoNoEncontradoExcepcion.class);
    }

    @Test
    void devuelveElCensoDeUnaComunidadResolviendoSusLocalidades() throws Exception {
        List<String> idsLocalidad = asList("ALB", "CUEN", "TOLE");
        when(comunidadRepository.idDeComunidad("Castilla-La Mancha")).thenReturn(Optional.of("CM"));
        when(localidadRepository.idsLocalidadesDeComunidad("CM")).thenReturn(idsLocalidad);
        List<Censo> censo = Collections.emptyList();
        when(censoRepository.listarPorLocalidades(idsLocalidad)).thenReturn(censo);

        assertThat(censoServicio.censoPorComunidad("Castilla-La Mancha")).isEqualTo(censo);
    }

    @Test
    void rechazaUnaComunidadDesconocida() {
        when(comunidadRepository.idDeComunidad("Marte")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> censoServicio.censoPorComunidad("Marte"))
                .isInstanceOf(ElementoNoEncontradoExcepcion.class);
    }
}
