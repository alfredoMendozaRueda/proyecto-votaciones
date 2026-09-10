package servicios;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import excepciones.DniNoEnCensoExcepcion;
import excepciones.MenorDeEdadExcepcion;
import excepciones.UsuarioYaRegistradoExcepcion;
import java.time.LocalDate;
import java.util.Optional;
import modelos.Censo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import repositorios.CensoRepositorio;
import repositorios.UsuarioRepositorio;
import seguridad.EncriptadorContrasena;

@ExtendWith(MockitoExtension.class)
class RegistroServicioTest {

    private static final String DNI = "49432145Q";

    @Mock
    private CensoRepositorio censoRepositorio;
    @Mock
    private UsuarioRepositorio usuarioRepositorio;
    @Mock
    private EncriptadorContrasena encriptador;

    private RegistroServicio registroServicio;

    @BeforeEach
    void crearServicio() {
        registroServicio = new RegistroServicio(censoRepositorio, usuarioRepositorio, encriptador);
    }

    private Censo personaMayorDeEdad() {
        return new Censo(DNI, "Alguien Mayor", LocalDate.now().minusYears(30), "Calle 1", "ALB");
    }

    private Censo personaMenorDeEdad() {
        return new Censo(DNI, "Alguien Menor", LocalDate.now().minusYears(10), "Calle 1", "ALB");
    }

    @Test
    void registraAUnaPersonaMayorDeEdadYaCensada() throws Exception {
        when(usuarioRepositorio.existe(DNI)).thenReturn(false);
        when(censoRepositorio.obtenerPorDni(DNI)).thenReturn(Optional.of(personaMayorDeEdad()));
        when(encriptador.cifrar("clave123")).thenReturn("hash123");

        registroServicio.registrarVotante(DNI, "clave123");

        verify(usuarioRepositorio, times(1)).registrarVotante(eq(DNI), eq("hash123"));
    }

    @Test
    void rechazaAUnUsuarioQueYaTieneCuenta() throws Exception {
        when(usuarioRepositorio.existe(DNI)).thenReturn(true);

        assertThatThrownBy(() -> registroServicio.registrarVotante(DNI, "clave123"))
                .isInstanceOf(UsuarioYaRegistradoExcepcion.class);

        verify(usuarioRepositorio, never()).registrarVotante(any(), any());
    }

    @Test
    void rechazaAUnDniQueNoEstaEnElCenso() throws Exception {
        when(usuarioRepositorio.existe(DNI)).thenReturn(false);
        when(censoRepositorio.obtenerPorDni(DNI)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> registroServicio.registrarVotante(DNI, "clave123"))
                .isInstanceOf(DniNoEnCensoExcepcion.class);

        verify(usuarioRepositorio, never()).registrarVotante(any(), any());
    }

    @Test
    void rechazaAUnaPersonaMenorDeEdad() throws Exception {
        when(usuarioRepositorio.existe(DNI)).thenReturn(false);
        when(censoRepositorio.obtenerPorDni(DNI)).thenReturn(Optional.of(personaMenorDeEdad()));

        assertThatThrownBy(() -> registroServicio.registrarVotante(DNI, "clave123"))
                .isInstanceOf(MenorDeEdadExcepcion.class);

        verify(usuarioRepositorio, never()).registrarVotante(any(), any());
    }

    @Test
    void unaPersonaQueCumpleHoy18AniosPuedeRegistrarse() throws Exception {
        Censo justoDieciocho = new Censo(DNI, "Cumple Hoy", LocalDate.now().minusYears(18), "Calle 1", "ALB");
        when(usuarioRepositorio.existe(DNI)).thenReturn(false);
        when(censoRepositorio.obtenerPorDni(DNI)).thenReturn(Optional.of(justoDieciocho));
        when(encriptador.cifrar("clave123")).thenReturn("hash123");

        registroServicio.registrarVotante(DNI, "clave123");

        verify(usuarioRepositorio).registrarVotante(eq(DNI), eq("hash123"));
    }
}
