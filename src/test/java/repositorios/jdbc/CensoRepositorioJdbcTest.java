package repositorios.jdbc;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

import config.FabricaConexiones;
import java.sql.Connection;
import java.sql.Date;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.time.LocalDate;
import java.util.Optional;
import modelos.Censo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

/**
 * Ejemplo de test de la capa JDBC mockeando el propio driver: comprueba que
 * la consulta se ejecuta con los parametros correctos y que el ResultSet se
 * traduce fielmente al modelo de dominio.
 */
@ExtendWith(MockitoExtension.class)
class CensoRepositorioJdbcTest {

    @Mock
    private FabricaConexiones fabricaConexiones;
    @Mock
    private Connection conexion;
    @Mock
    private PreparedStatement sentencia;
    @Mock
    private ResultSet resultado;

    private CensoRepositorioJdbc repositorio;

    @BeforeEach
    void crearRepositorio() throws Exception {
        repositorio = new CensoRepositorioJdbc(fabricaConexiones);
        when(fabricaConexiones.nuevaConexion()).thenReturn(conexion);
        when(conexion.prepareStatement(anyString())).thenReturn(sentencia);
        when(sentencia.executeQuery()).thenReturn(resultado);
    }

    @Test
    void mapeaUnaFilaDelResultSetAUnCenso() throws Exception {
        when(resultado.next()).thenReturn(true, false);
        when(resultado.getString("dni")).thenReturn("12345678Z");
        when(resultado.getString("nombre_completo")).thenReturn("Laura Martínez");
        when(resultado.getDate("fecha_nacimiento")).thenReturn(Date.valueOf(LocalDate.of(1990, 5, 12)));
        when(resultado.getString("direccion")).thenReturn("Calle Mayor 15");
        when(resultado.getString("id_localidad")).thenReturn("ALB");

        Optional<Censo> censo = repositorio.obtenerPorDni("12345678Z");

        assertThat(censo).isPresent();
        assertThat(censo.get().getNombreCompleto()).isEqualTo("Laura Martínez");
        assertThat(censo.get().getIdLocalidad()).isEqualTo("ALB");
        assertThat(censo.get().getFechaNacimiento()).isEqualTo(LocalDate.of(1990, 5, 12));
    }

    @Test
    void devuelveVacioCuandoNoHayNingunaFila() throws Exception {
        when(resultado.next()).thenReturn(false);

        assertThat(repositorio.obtenerPorDni("00000000A")).isEmpty();
    }

    @Test
    void contarCensadosEnLocalidadLeeElPrimerEnteroDelResultado() throws Exception {
        when(resultado.next()).thenReturn(true);
        when(resultado.getInt(1)).thenReturn(5);

        assertThat(repositorio.contarCensadosEnLocalidad("ALB")).isEqualTo(5);
    }
}
