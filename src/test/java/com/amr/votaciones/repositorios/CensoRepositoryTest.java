package com.amr.votaciones.repositorios;

import static org.assertj.core.api.Assertions.assertThat;

import com.amr.votaciones.modelos.Censo;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;

/**
 * Test de integracion de la capa JPA contra una base de datos H2 en memoria,
 * verificando que el mapeo de la entidad y las consultas derivadas
 * funcionan de extremo a extremo (no son mocks).
 */
@DataJpaTest
class CensoRepositoryTest {

    @Autowired
    private CensoRepository censoRepository;

    @BeforeEach
    void sembrarDatos() {
        censoRepository.save(new Censo("12345678Z", "Laura Martínez", LocalDate.of(1990, 5, 12), "Calle Mayor 15", "ALB"));
        censoRepository.save(new Censo("22222222B", "Javier Ruiz", LocalDate.of(1985, 3, 20), "Av. Castilla 45", "CUEN"));
        censoRepository.save(new Censo("33333333C", "Ana Martínez", LocalDate.of(1992, 7, 8), "Calle Luna 8", "TOLE"));
    }

    @Test
    void encuentraUnaPersonaPorDni() {
        Optional<Censo> persona = censoRepository.obtenerPorDni("12345678Z");

        assertThat(persona).isPresent();
        assertThat(persona.get().getNombreCompleto()).isEqualTo("Laura Martínez");
        assertThat(persona.get().getIdLocalidad()).isEqualTo("ALB");
    }

    @Test
    void devuelveVacioParaUnDniNoRegistrado() {
        assertThat(censoRepository.obtenerPorDni("00000000A")).isEmpty();
    }

    @Test
    void filtraElCensoPorLocalidad() {
        List<Censo> resultado = censoRepository.listarPorLocalidad("ALB");

        assertThat(resultado).extracting(Censo::getDni).containsExactly("12345678Z");
    }

    @Test
    void filtraElCensoPorVariasLocalidades() {
        List<Censo> resultado = censoRepository.listarPorLocalidades(List.of("CUEN", "TOLE"));

        assertThat(resultado).extracting(Censo::getDni).containsExactlyInAnyOrder("22222222B", "33333333C");
    }

    @Test
    void cuentaLosCensadosDeUnaLocalidad() {
        assertThat(censoRepository.contarCensadosEnLocalidad("ALB")).isEqualTo(1);
        assertThat(censoRepository.contarCensadosEnLocalidad("MADRID")).isZero();
    }
}
