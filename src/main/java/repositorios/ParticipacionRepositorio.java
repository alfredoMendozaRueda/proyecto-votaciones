package repositorios;

import java.sql.SQLException;
import modelos.Participacion;

/**
 * Acceso a la fotografia de participacion por localidad (tabla
 * {@code participacion}).
 */
public interface ParticipacionRepositorio {

    int registrar(Participacion participacion) throws SQLException;

    void borrarTodas() throws SQLException;
}
