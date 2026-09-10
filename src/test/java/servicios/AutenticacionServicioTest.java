package servicios;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

import excepciones.CredencialesInvalidasExcepcion;
import excepciones.DniNoEnCensoExcepcion;
import java.time.LocalDate;
import java.util.Optional;
import modelos.Censo;
import modelos.Rol;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import repositorios.CensoRepositorio;
import repositorios.UsuarioRepositorio;
import seguridad.EncriptadorContrasena;

@ExtendWith(MockitoExtension.class)
class AutenticacionServicioTest {

    private static final String DNI = "12345678Z";

    @Mock
    private CensoRepositorio censoRepositorio;
    @Mock
    private UsuarioRepositorio usuarioRepositorio;
    @Mock
    private EncriptadorContrasena encriptador;

    private AutenticacionServicio autenticacionServicio;

    @BeforeEach
    void crearServicio() {
        autenticacionServicio = new AutenticacionServicio(censoRepositorio, usuarioRepositorio, encriptador);
    }

    private Censo personaCensada() {
        return new Censo(DNI, "Laura Martínez", LocalDate.of(1990, 5, 12), "Calle Mayor 15", "ALB");
    }

    @Test
    void autenticaCorrectamenteCuandoLasCredencialesSonValidas() throws Exception {
        when(censoRepositorio.obtenerPorDni(DNI)).thenReturn(Optional.of(personaCensada()));
        when(usuarioRepositorio.obtenerContrasenaCifrada(DNI)).thenReturn(Optional.of("hash"));
        when(encriptador.coincide("clave", "hash")).thenReturn(true);
        when(usuarioRepositorio.obtenerRol(DNI)).thenReturn(Optional.of(Rol.ADMIN));

        ResultadoLogin resultado = autenticacionServicio.autenticar(DNI, "clave");

        assertThat(resultado.getDni()).isEqualTo(DNI);
        assertThat(resultado.getNombreCompleto()).isEqualTo("Laura Martínez");
        assertThat(resultado.getRol()).isEqualTo(Rol.ADMIN);
    }

    @Test
    void asignaRolVotantePorDefectoCuandoNoHayRolGuardado() throws Exception {
        when(censoRepositorio.obtenerPorDni(DNI)).thenReturn(Optional.of(personaCensada()));
        when(usuarioRepositorio.obtenerContrasenaCifrada(DNI)).thenReturn(Optional.of("hash"));
        when(encriptador.coincide("clave", "hash")).thenReturn(true);
        when(usuarioRepositorio.obtenerRol(DNI)).thenReturn(Optional.empty());

        ResultadoLogin resultado = autenticacionServicio.autenticar(DNI, "clave");

        assertThat(resultado.getRol()).isEqualTo(Rol.VOTANTE);
    }

    @Test
    void rechazaAUnDniQueNoEstaEnElCenso() throws Exception {
        when(censoRepositorio.obtenerPorDni(DNI)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> autenticacionServicio.autenticar(DNI, "clave"))
                .isInstanceOf(DniNoEnCensoExcepcion.class);
    }

    @Test
    void rechazaUnaContrasenaIncorrecta() throws Exception {
        when(censoRepositorio.obtenerPorDni(DNI)).thenReturn(Optional.of(personaCensada()));
        when(usuarioRepositorio.obtenerContrasenaCifrada(DNI)).thenReturn(Optional.of("hash"));
        when(encriptador.coincide("incorrecta", "hash")).thenReturn(false);

        assertThatThrownBy(() -> autenticacionServicio.autenticar(DNI, "incorrecta"))
                .isInstanceOf(CredencialesInvalidasExcepcion.class);
    }

    @Test
    void rechazaUnDniSinCuentaDeAcceso() throws Exception {
        when(censoRepositorio.obtenerPorDni(DNI)).thenReturn(Optional.of(personaCensada()));
        when(usuarioRepositorio.obtenerContrasenaCifrada(DNI)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> autenticacionServicio.autenticar(DNI, "clave"))
                .isInstanceOf(CredencialesInvalidasExcepcion.class);
    }
}
