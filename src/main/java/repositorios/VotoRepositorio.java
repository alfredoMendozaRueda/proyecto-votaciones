package repositorios;

import java.sql.SQLException;
import java.util.List;
import modelos.ResultadoPartido;
import modelos.Voto;

/**
 * Acceso a los votos emitidos (tabla {@code votos}) y a los recuentos
 * agregados por partido, calculados en el servidor de base de datos en una
 * unica consulta en lugar de sumar uno a uno desde Java.
 */
public interface VotoRepositorio {

    int registrar(Voto voto) throws SQLException;

    List<Voto> listarTodos() throws SQLException;

    int votosEnLocalidad(String idLocalidad) throws SQLException;

    List<ResultadoPartido> resultadosGlobales() throws SQLException;

    List<ResultadoPartido> resultadosPorLocalidad(String idLocalidad) throws SQLException;

    List<ResultadoPartido> resultadosPorComunidad(String idComunidad) throws SQLException;

    void borrarTodos() throws SQLException;
}
