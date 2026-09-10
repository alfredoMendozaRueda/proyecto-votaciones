package com.amr.votaciones.repositorios;

import com.amr.votaciones.modelos.Censo;
import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CensoRepository extends JpaRepository<Censo, String> {

    List<Censo> findByIdLocalidad(String idLocalidad);

    List<Censo> findByIdLocalidadIn(List<String> idsLocalidad);

    long countByIdLocalidad(String idLocalidad);

    default int contarCensadosEnLocalidad(String idLocalidad) {
        return (int) countByIdLocalidad(idLocalidad);
    }

    default Optional<Censo> obtenerPorDni(String dni) {
        return findById(dni);
    }

    default List<Censo> listarTodo() {
        return findAll();
    }

    default List<Censo> listarPorLocalidad(String idLocalidad) {
        return findByIdLocalidad(idLocalidad);
    }

    default List<Censo> listarPorLocalidades(List<String> idsLocalidad) {
        return findByIdLocalidadIn(idsLocalidad);
    }
}
