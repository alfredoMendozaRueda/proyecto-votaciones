package repositorios;

import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import modelos.Partido;

/**
 * Acceso a los partidos politicos (tabla {@code partidos}).
 */
public interface PartidoRepositorio {

    int registrar(Partido partido) throws SQLException;

    int contar() throws SQLException;

    List<String> listarSiglas() throws SQLException;

    List<Partido> listarTodos() throws SQLException;

    Optional<String> presidenteDe(String siglas) throws SQLException;
}
