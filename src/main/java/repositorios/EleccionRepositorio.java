package repositorios;

import java.sql.SQLException;
import java.util.Optional;
import modelos.Eleccion;

/**
 * Acceso a los procesos electorales (tabla {@code elecciones}).
 */
public interface EleccionRepositorio {

    int registrar(Eleccion eleccion) throws SQLException;

    boolean existeAlguna() throws SQLException;

    Optional<String> idDeLaEleccionActual() throws SQLException;

    boolean eliminar(String idElecciones) throws SQLException;

    int habilitar(String idElecciones) throws SQLException;

    int deshabilitar(String idElecciones) throws SQLException;

    Optional<String> estadoDe(String idElecciones) throws SQLException;
}
