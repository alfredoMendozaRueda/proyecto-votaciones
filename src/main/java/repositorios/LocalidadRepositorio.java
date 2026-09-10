package repositorios;

import java.sql.SQLException;
import java.util.List;
import java.util.Optional;

/**
 * Acceso a las tablas geograficas {@code localidades} y {@code comunidades}.
 */
public interface LocalidadRepositorio {

    List<String> listarNombresLocalidades() throws SQLException;

    List<String> listarIdsLocalidades() throws SQLException;

    List<String> listarNombresComunidades() throws SQLException;

    Optional<String> idDeLocalidad(String nombreLocalidad) throws SQLException;

    Optional<String> idDeComunidad(String nombreComunidad) throws SQLException;

    List<String> idsLocalidadesDeComunidad(String idComunidad) throws SQLException;
}
