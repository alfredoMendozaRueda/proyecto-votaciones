package com.amr.votaciones.repositorios;

import com.amr.votaciones.modelos.Eleccion;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface EleccionRepository extends JpaRepository<Eleccion, String> {

    @Modifying
    @Query("UPDATE Eleccion e SET e.estado = :estado WHERE e.idElecciones = :id")
    int actualizarEstadoRaw(@Param("id") String id, @Param("estado") String estado);

    default int registrar(Eleccion eleccion) {
        save(eleccion);
        return 1;
    }

    default boolean existeAlguna() {
        return count() > 0;
    }

    default Optional<String> idDeLaEleccionActual() {
        return findAll().stream().findFirst().map(Eleccion::getIdElecciones);
    }

    default boolean eliminar(String idElecciones) {
        if (existsById(idElecciones)) {
            deleteById(idElecciones);
            return true;
        }
        return false;
    }

    default int habilitar(String idElecciones) {
        return actualizarEstadoRaw(idElecciones, Eleccion.ESTADO_HABILITADA);
    }

    default int deshabilitar(String idElecciones) {
        return actualizarEstadoRaw(idElecciones, Eleccion.ESTADO_INHABILITADA);
    }

    default Optional<String> estadoDe(String idElecciones) {
        return findById(idElecciones).map(Eleccion::getEstado);
    }
}
