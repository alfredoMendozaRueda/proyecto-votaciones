package com.amr.votaciones.repositorios;

import com.amr.votaciones.modelos.Localidad;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface LocalidadRepository extends JpaRepository<Localidad, String> {

    @Query("SELECT l.nombreLocalidad FROM Localidad l ORDER BY l.nombreLocalidad")
    List<String> listarNombresRaw();

    @Query("SELECT l.idLocalidad FROM Localidad l")
    List<String> listarIdsRaw();

    Optional<Localidad> findByNombreLocalidad(String nombreLocalidad);

    List<Localidad> findByIdComunidad(String idComunidad);

    default List<String> listarNombresLocalidades() {
        return listarNombresRaw();
    }

    default List<String> listarIdsLocalidades() {
        return listarIdsRaw();
    }

    default Optional<String> idDeLocalidad(String nombreLocalidad) {
        return findByNombreLocalidad(nombreLocalidad).map(Localidad::getIdLocalidad);
    }

    default List<String> idsLocalidadesDeComunidad(String idComunidad) {
        return findByIdComunidad(idComunidad).stream()
                .map(Localidad::getIdLocalidad)
                .collect(Collectors.toList());
    }
}
