package com.amr.votaciones.web;

import com.amr.votaciones.excepciones.ElementoNoEncontradoExcepcion;
import com.amr.votaciones.servicios.CensoServicio;
import com.amr.votaciones.servicios.ParticipacionServicio;
import com.amr.votaciones.web.dto.MensajeResponse;
import com.amr.votaciones.web.dto.PorcentajeResponse;
import java.util.ArrayList;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Recalculo y consulta de la participacion electoral por localidad, para
 * el rol ANALISTA.
 */
@RestController
public class ParticipacionController {

    private final ParticipacionServicio participacionServicio;
    private final CensoServicio censoServicio;

    public ParticipacionController(ParticipacionServicio participacionServicio, CensoServicio censoServicio) {
        this.participacionServicio = participacionServicio;
        this.censoServicio = censoServicio;
    }

    @PostMapping("/api/participacion/recalcular")
    public MensajeResponse recalcular() {
        participacionServicio.recalcularParticipacion();
        return new MensajeResponse("Participación registrada con éxito");
    }

    @GetMapping("/api/participacion/porcentajes")
    public List<PorcentajeResponse> porcentajes() {
        List<PorcentajeResponse> porcentajes = new ArrayList<>();
        for (String localidad : censoServicio.localidades()) {
            try {
                porcentajes.add(new PorcentajeResponse(localidad, participacionServicio.porcentajeParticipacion(localidad)));
            } catch (ElementoNoEncontradoExcepcion ignorada) {
                // No debería ocurrir: la localidad viene de censoServicio.localidades().
            }
        }
        return porcentajes;
    }
}
