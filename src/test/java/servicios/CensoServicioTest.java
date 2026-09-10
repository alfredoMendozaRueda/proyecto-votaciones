package servicios;

import static java.util.Arrays.asList;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import excepciones.ElementoNoEncontradoExcepcion;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import modelos.Censo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import repositorios.CensoRepositorio;
import repositorios.LocalidadRepositorio;

@ExtendWith(MockitoExtension.class)
class CensoServicioTest {

    @Mock
    private CensoRepositorio censoRepositorio;
    @Mock
    private LocalidadRepositorio localidadRepositorio;

    private CensoServicio censoServicio;

    @BeforeEach
    void crearServicio() {
        censoServicio = new CensoServicio(censoRepositorio, localidadRepositorio);
    }

    @Test
    void devuelveElCensoDeUnaLocalidadConocida() throws Exception {
        List<Censo> censo = Collections.singletonList(
                new Censo("12345678Z", "Laura Martínez", LocalDate.of(1990, 5, 12), "Calle Mayor 15", "ALB"));
        when(localidadRepositorio.idDeLocalidad("Albacete")).thenReturn(Optional.of("ALB"));
        when(censoRepositorio.listarPorLocalidad("ALB")).thenReturn(censo);

        assertThat(censoServicio.censoPorLocalidad("Albacete")).isEqualTo(censo);
    }

    @Test
    void rechazaUnaLocalidadDesconocida() throws Exception {
        when(localidadRepositorio.idDeLocalidad("Marte")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> censoServicio.censoPorLocalidad("Marte"))
                .isInstanceOf(ElementoNoEncontradoExcepcion.class);
    }

    @Test
    void devuelveElCensoDeUnaComunidadResolviendoSusLocalidades() throws Exception {
        List<String> idsLocalidad = asList("ALB", "CUEN", "TOLE");
        when(localidadRepositorio.idDeComunidad("Castilla-La Mancha")).thenReturn(Optional.of("CM"));
        when(localidadRepositorio.idsLocalidadesDeComunidad("CM")).thenReturn(idsLocalidad);
        List<Censo> censo = Collections.emptyList();
        when(censoRepositorio.listarPorLocalidades(idsLocalidad)).thenReturn(censo);

        assertThat(censoServicio.censoPorComunidad("Castilla-La Mancha")).isEqualTo(censo);
    }

    @Test
    void rechazaUnaComunidadDesconocida() throws Exception {
        when(localidadRepositorio.idDeComunidad("Marte")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> censoServicio.censoPorComunidad("Marte"))
                .isInstanceOf(ElementoNoEncontradoExcepcion.class);
    }
}
