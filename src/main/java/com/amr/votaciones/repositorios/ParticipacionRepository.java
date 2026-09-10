package com.amr.votaciones.repositorios;

import com.amr.votaciones.modelos.Participacion;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ParticipacionRepository extends JpaRepository<Participacion, String> {

    @Modifying
    @Query("DELETE FROM Participacion")
    void borrarTodas();

    default int registrar(Participacion participacion) {
        save(participacion);
        return 1;
    }
}
