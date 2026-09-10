package repositorios;

import java.sql.SQLException;
import java.util.List;
import modelos.Candidato;

/**
 * Acceso a las candidaturas (tabla {@code candidatos}).
 */
public interface CandidatoRepositorio {

    int registrar(Candidato candidato) throws SQLException;

    boolean existe(String dni) throws SQLException;

    /**
     * Candidatos censados en una localidad, con su nombre completo ya
     * resuelto (join con censo) en una unica consulta.
     */
    List<Candidato> listarPorLocalidad(String idLocalidad) throws SQLException;
}
