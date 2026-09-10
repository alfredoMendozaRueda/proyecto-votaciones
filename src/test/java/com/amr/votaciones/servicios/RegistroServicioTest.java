package com.amr.votaciones.servicios;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.amr.votaciones.excepciones.DniNoEnCensoExcepcion;
import com.amr.votaciones.excepciones.MenorDeEdadExcepcion;
import com.amr.votaciones.excepciones.UsuarioYaRegistradoExcepcion;
import com.amr.votaciones.modelos.Censo;
import com.amr.votaciones.repositorios.CensoRepository;
import com.amr.votaciones.repositorios.UsuarioRepository;
import com.amr.votaciones.seguridad.EncriptadorContrasena;
import java.time.LocalDate;
import java.util.Optional;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

@ExtendWith(MockitoExtension.class)
class RegistroServicioTest {

    private static final String DNI = "49432145Q";

    @Mock
    private CensoRepository censoRepository;
    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private EncriptadorContrasena encriptador;

    private RegistroServicio registroServicio;

    @BeforeEach
    void crearServicio() {
        registroServicio = new RegistroServicio(censoRepository, usuarioRepository, encriptador);
    }

    private Censo personaMayorDeEdad() {
        return new Censo(DNI, "Alguien Mayor", LocalDate.now().minusYears(30), "Calle 1", "ALB");
    }

    private Censo personaMenorDeEdad() {
        return new Censo(DNI, "Alguien Menor", LocalDate.now().minusYears(10), "Calle 1", "ALB");
    }

    @Test
    void registraAUnaPersonaMayorDeEdadYaCensada() throws Exception {
        when(usuarioRepository.existe(DNI)).thenReturn(false);
        when(censoRepository.obtenerPorDni(DNI)).thenReturn(Optional.of(personaMayorDeEdad()));
        when(encriptador.cifrar("clave123")).thenReturn("hash123");

        registroServicio.registrarVotante(DNI, "clave123");

        verify(usuarioRepository, times(1)).registrarVotante(eq(DNI), eq("hash123"));
    }

    @Test
    void rechazaAUnUsuarioQueYaTieneCuenta() throws Exception {
        when(usuarioRepository.existe(DNI)).thenReturn(true);

        assertThatThrownBy(() -> registroServicio.registrarVotante(DNI, "clave123"))
                .isInstanceOf(UsuarioYaRegistradoExcepcion.class);

        verify(usuarioRepository, never()).registrarVotante(any(), any());
    }

    @Test
    void rechazaAUnDniQueNoEstaEnElCenso() throws Exception {
        when(usuarioRepository.existe(DNI)).thenReturn(false);
        when(censoRepository.obtenerPorDni(DNI)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> registroServicio.registrarVotante(DNI, "clave123"))
                .isInstanceOf(DniNoEnCensoExcepcion.class);

        verify(usuarioRepository, never()).registrarVotante(any(), any());
    }

    @Test
    void rechazaAUnaPersonaMenorDeEdad() throws Exception {
        when(usuarioRepository.existe(DNI)).thenReturn(false);
        when(censoRepository.obtenerPorDni(DNI)).thenReturn(Optional.of(personaMenorDeEdad()));

        assertThatThrownBy(() -> registroServicio.registrarVotante(DNI, "clave123"))
                .isInstanceOf(MenorDeEdadExcepcion.class);

        verify(usuarioRepository, never()).registrarVotante(any(), any());
    }

    @Test
    void unaPersonaQueCumpleHoy18AniosPuedeRegistrarse() throws Exception {
        Censo justoDieciocho = new Censo(DNI, "Cumple Hoy", LocalDate.now().minusYears(18), "Calle 1", "ALB");
        when(usuarioRepository.existe(DNI)).thenReturn(false);
        when(censoRepository.obtenerPorDni(DNI)).thenReturn(Optional.of(justoDieciocho));
        when(encriptador.cifrar("clave123")).thenReturn("hash123");

        registroServicio.registrarVotante(DNI, "clave123");

        verify(usuarioRepository).registrarVotante(eq(DNI), eq("hash123"));
    }
}
