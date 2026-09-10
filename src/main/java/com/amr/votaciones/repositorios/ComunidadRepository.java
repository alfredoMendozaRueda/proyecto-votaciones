package com.amr.votaciones.repositorios;

import com.amr.votaciones.modelos.Comunidad;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ComunidadRepository extends JpaRepository<Comunidad, String> {

    @Query("SELECT c.nombreComunidad FROM Comunidad c ORDER BY c.nombreComunidad")
    List<String> listarNombresRaw();

    Optional<Comunidad> findByNombreComunidad(String nombreComunidad);

    default List<String> listarNombresComunidades() {
        return listarNombresRaw();
    }

    default Optional<String> idDeComunidad(String nombreComunidad) {
        return findByNombreComunidad(nombreComunidad).map(Comunidad::getIdComunidad);
    }
}
