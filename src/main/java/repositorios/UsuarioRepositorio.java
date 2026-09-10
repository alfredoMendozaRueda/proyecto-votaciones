package repositorios;

import java.sql.SQLException;
import java.util.Optional;

/**
 * Acceso a las cuentas de acceso (tabla {@code usuarios}).
 */
public interface UsuarioRepositorio {

    boolean existe(String dni) throws SQLException;

    int registrarVotante(String dni, String contrasenaCifrada) throws SQLException;

    Optional<String> obtenerContrasenaCifrada(String dni) throws SQLException;

    Optional<String> obtenerRol(String dni) throws SQLException;

    boolean haVotado(String dni) throws SQLException;

    int marcarComoVotado(String dni) throws SQLException;

    void reiniciarTodosLosVotos() throws SQLException;
}
