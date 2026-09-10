package com.amr.votaciones.repositorios;

import com.amr.votaciones.modelos.ResultadoPartido;
import com.amr.votaciones.modelos.Voto;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

/**
 * Los recuentos de resultados se calculan en el servidor de base de datos
 * (consultas SQL agregadas) en lugar de sumar uno a uno desde Java.
 */
public interface VotoRepository extends JpaRepository<Voto, Long> {

    long countByIdLocalidad(String idLocalidad);

    @Query(value = "SELECT p.siglas AS siglas, p.descripcion AS descripcion, COUNT(v.id_voto) AS votos "
            + "FROM partidos p LEFT JOIN votos v ON v.siglas_partido = p.siglas "
            + "GROUP BY p.siglas, p.descripcion ORDER BY p.siglas", nativeQuery = true)
    List<Object[]> resultadosGlobalesRaw();

    @Query(value = "SELECT p.siglas AS siglas, p.descripcion AS descripcion, COUNT(v.id_voto) AS votos "
            + "FROM partidos p LEFT JOIN votos v ON v.siglas_partido = p.siglas AND v.id_localidad = :idLocalidad "
            + "GROUP BY p.siglas, p.descripcion ORDER BY p.siglas", nativeQuery = true)
    List<Object[]> resultadosPorLocalidadRaw(@Param("idLocalidad") String idLocalidad);

    @Query(value = "SELECT p.siglas AS siglas, p.descripcion AS descripcion, COUNT(v.id_voto) AS votos "
            + "FROM partidos p LEFT JOIN votos v ON v.siglas_partido = p.siglas "
            + "  AND v.id_localidad IN (SELECT id_localidad FROM localidades WHERE id_comunidad = :idComunidad) "
            + "GROUP BY p.siglas, p.descripcion ORDER BY p.siglas", nativeQuery = true)
    List<Object[]> resultadosPorComunidadRaw(@Param("idComunidad") String idComunidad);

    @Modifying
    @Query(value = "DELETE FROM votos", nativeQuery = true)
    void borrarTodosRaw();

    default int registrar(Voto voto) {
        save(voto);
        return 1;
    }

    default List<Voto> listarTodos() {
        return findAll();
    }

    default int votosEnLocalidad(String idLocalidad) {
        return (int) countByIdLocalidad(idLocalidad);
    }

    default List<ResultadoPartido> resultadosGlobales() {
        return mapearResultados(resultadosGlobalesRaw());
    }

    default List<ResultadoPartido> resultadosPorLocalidad(String idLocalidad) {
        return mapearResultados(resultadosPorLocalidadRaw(idLocalidad));
    }

    default List<ResultadoPartido> resultadosPorComunidad(String idComunidad) {
        return mapearResultados(resultadosPorComunidadRaw(idComunidad));
    }

    default void borrarTodos() {
        borrarTodosRaw();
    }

    static List<ResultadoPartido> mapearResultados(List<Object[]> filas) {
        List<ResultadoPartido> resultados = new ArrayList<>();
        for (Object[] fila : filas) {
            resultados.add(new ResultadoPartido((String) fila[0], (String) fila[1], ((Number) fila[2]).intValue()));
        }
        return resultados;
    }
}
