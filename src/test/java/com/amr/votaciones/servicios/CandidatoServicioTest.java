package com.amr.votaciones.servicios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.amr.votaciones.excepciones.CandidatoYaRegistradoExcepcion;
import com.amr.votaciones.excepciones.DniNoEnCensoExcepcion;
import com.amr.votaciones.excepciones.ElementoNoEncontradoExcepcion;
import com.amr.votaciones.modelos.Candidato;
import com.amr.votaciones.modelos.Censo;
import com.amr.votaciones.repositorios.CandidatoRepository;
import com.amr.votaciones.repositorios.CensoRepository;
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
class CandidatoServicioTest {

    private static final String DNI = "10101010J";

    @Mock
    private CandidatoRepository candidatoRepository;
    @Mock
    private CensoRepository censoRepository;
    @Mock
    private LocalidadRepository localidadRepository;

    private CandidatoServicio candidatoServicio;

    @BeforeEach
    void crearServicio() {
        candidatoServicio = new CandidatoServicio(candidatoRepository, censoRepository, localidadRepository);
    }

    @Test
    void registraUnCandidatoCensadoYNoDuplicado() throws Exception {
        Candidato candidato = new Candidato(DNI, "Sergio Domínguez", "VOX", 1);
        when(censoRepository.obtenerPorDni(DNI))
                .thenReturn(Optional.of(new Censo(DNI, "Sergio Domínguez", LocalDate.of(1987, 8, 14), "Calle 1", "ALB")));
        when(candidatoRepository.existe(DNI)).thenReturn(false);

        candidatoServicio.registrarCandidato(candidato);

        verify(candidatoRepository, times(1)).registrar(candidato);
    }

    @Test
    void rechazaUnCandidatoQueNoEstaEnElCenso() {
        Candidato candidato = new Candidato(DNI, "Sergio Domínguez", "VOX", 1);
        when(censoRepository.obtenerPorDni(DNI)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> candidatoServicio.registrarCandidato(candidato))
                .isInstanceOf(DniNoEnCensoExcepcion.class);

        verify(candidatoRepository, never()).registrar(any());
    }

    @Test
    void rechazaUnCandidatoDuplicado() throws Exception {
        Candidato candidato = new Candidato(DNI, "Sergio Domínguez", "VOX", 1);
        when(censoRepository.obtenerPorDni(DNI))
                .thenReturn(Optional.of(new Censo(DNI, "Sergio Domínguez", LocalDate.of(1987, 8, 14), "Calle 1", "ALB")));
        when(candidatoRepository.existe(DNI)).thenReturn(true);

        assertThatThrownBy(() -> candidatoServicio.registrarCandidato(candidato))
                .isInstanceOf(CandidatoYaRegistradoExcepcion.class);

        verify(candidatoRepository, never()).registrar(any());
    }

    @Test
    void devuelveLosCandidatosDeUnaLocalidadConocida() throws Exception {
        List<Candidato> candidatos = Collections.singletonList(new Candidato(DNI, "Sergio Domínguez", "VOX", 1));
        when(localidadRepository.idDeLocalidad("Albacete")).thenReturn(Optional.of("ALB"));
        when(candidatoRepository.listarPorLocalidad("ALB")).thenReturn(candidatos);

        assertThat(candidatoServicio.candidatosDeLocalidad("Albacete")).containsExactlyElementsOf(candidatos);
    }

    @Test
    void rechazaUnaLocalidadDesconocida() {
        when(localidadRepository.idDeLocalidad("Marte")).thenReturn(Optional.empty());

        assertThatThrownBy(() -> candidatoServicio.candidatosDeLocalidad("Marte"))
                .isInstanceOf(ElementoNoEncontradoExcepcion.class);
    }
}
