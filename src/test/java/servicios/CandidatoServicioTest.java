package servicios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import excepciones.CandidatoYaRegistradoExcepcion;
import excepciones.DniNoEnCensoExcepcion;
import excepciones.ElementoNoEncontradoExcepcion;
import java.time.LocalDate;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import modelos.Candidato;
import modelos.Censo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import repositorios.CandidatoRepositorio;
import repositorios.CensoRepositorio;
import repositorios.LocalidadRepositorio;

@ExtendWith(MockitoExtension.class)
class CandidatoServicioTest {

    private static final String DNI = "10101010J";

    @Mock
    private CandidatoRepositorio candidatoRepositorio;
    @Mock
    private CensoRepositorio censoRepositorio;
    @Mock
    private LocalidadRepositorio localidadRepositorio;

    private CandidatoServicio candidatoServicio;

    @BeforeEach
    void crearServicio() {
        candidatoServicio = new CandidatoServicio(candidatoRepositorio, censoRepositorio, localidadRepositorio);
    }

    @Test
    void registraUnCandidatoCensadoYNoDuplicado() throws Exception {
        Candidato candidato = new Candidato(DNI, "Sergio Domínguez", "VOX", 1);
        when(censoRepositorio.obtenerPorDni(DNI))
                .thenReturn(Optional.of(new Censo(DNI, "Sergio Domínguez", LocalDate.of(1987, 8, 14), "Calle 1", "ALB")));
        when(candidatoRepositorio.existe(DNI)).thenReturn(false);

        candidatoServicio.registrarCandidato(candidato);

        verify(candidatoRepositorio, times(1)).registrar(candidato);
    }

    @Test
    void rechazaUnCandidatoQueNoEstaEnElCenso() throws Exception {
        Candidato candidato = new Candidato(DNI, "Sergio Domínguez", "VOX", 1);
        when(censoRepositorio.obtenerPorDni(DNI)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> candidatoServicio.registrarCandidato(candidato))
                .isInstanceOf(DniNoEnCensoExcepcion.class);

        verify(candidatoRepositorio, never()).registrar(any());
    }

    @Test
    void rechazaUnCandidatoDuplicado() throws Exception {
        Candidato candidato = new Candidato(DNI, "Sergio Domínguez", "VOX", 1);
        when(censoRepositorio.obtenerPorDni(DNI))
                .thenReturn(Optional.of(new Censo(DNI, "Sergio Domínguez", LocalDate.of(1987, 8, 14), "Calle 1", "ALB")));
        when(candidatoRepositorio.existe(DNI)).thenReturn(true);

        assertThatThrownBy(() -> candidatoServicio.registrarCandidato(candidato))
                .isInstanceOf(CandidatoYaRegistradoExcepcion.class);

        verify(candidatoRepositorio, never()).registrar(any());
    }

    @Test
    void devuelveLosCandidatosDeUnaLocalidadConocida() throws Exception {
        List<Candidato> candidatos = Collections.singletonList(new Candidato(DNI, "Sergio Domínguez", "VOX", 1));
        when(localidadRepositorio.idDeLocalidad("Albacete")).thenReturn(Optional.of("ALB"));
        when(candidatoRepositorio.listarPorLocalidad("ALB")).thenReturn(candidatos);

        assertThat(candidatoServicio.candidatosDeLocalidad("Albacete")).containsExactlyElementsOf(candidatos);
    }

    @Test
    void rechazaUnaLocalidadDesconocida() throws Exception {
        when(localidadRepositorio.idDeLocalidad("Marte")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> candidatoServicio.candidatosDeLocalidad("Marte"))
                .isInstanceOf(ElementoNoEncontradoExcepcion.class);
    }
}
