package com.amr.votaciones.repositorios;

import com.amr.votaciones.modelos.Partido;
import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface PartidoRepository extends JpaRepository<Partido, String> {

    @Query("SELECT p.siglas FROM Partido p")
    List<String> listarSiglasRaw();

    default int registrar(Partido partido) {
        save(partido);
        return 1;
    }

    default int contar() {
        return (int) count();
    }

    default List<String> listarSiglas() {
        return listarSiglasRaw();
    }

    default List<Partido> listarTodos() {
        return findAll();
    }
}
