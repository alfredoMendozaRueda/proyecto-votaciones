package com.amr.votaciones.repositorios;

import com.amr.votaciones.modelos.Candidato;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface CandidatoRepository extends JpaRepository<Candidato, String> {

    @Query("SELECT new com.amr.votaciones.modelos.Candidato(c.dni, cen.nombreCompleto, c.siglasPartido, c.orden) "
            + "FROM Candidato c JOIN Censo cen ON cen.dni = c.dni "
            + "WHERE cen.idLocalidad = :idLocalidad ORDER BY c.siglasPartido, c.orden")
    List<Candidato> listarPorLocalidadRaw(@Param("idLocalidad") String idLocalidad);

    @Query("SELECT c.nombreCompleto FROM Candidato c WHERE c.siglasPartido = :siglas AND c.orden = 1")
    Optional<String> buscarPresidente(@Param("siglas") String siglas);

    default int registrar(Candidato candidato) {
        save(candidato);
        return 1;
    }

    default boolean existe(String dni) {
        return existsById(dni);
    }

    default List<Candidato> listarPorLocalidad(String idLocalidad) {
        return listarPorLocalidadRaw(idLocalidad);
    }

    default Optional<String> presidenteDe(String siglas) {
        return buscarPresidente(siglas);
    }
}
