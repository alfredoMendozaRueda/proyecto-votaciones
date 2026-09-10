package repositorios;

import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import modelos.Censo;

/**
 * Acceso a los datos censales (tabla {@code censo}).
 */
public interface CensoRepositorio {

    Optional<Censo> obtenerPorDni(String dni) throws SQLException;

    List<Censo> listarTodo() throws SQLException;

    List<Censo> listarPorLocalidad(String idLocalidad) throws SQLException;

    List<Censo> listarPorLocalidades(List<String> idsLocalidad) throws SQLException;

    int contarCensadosEnLocalidad(String idLocalidad) throws SQLException;
}
