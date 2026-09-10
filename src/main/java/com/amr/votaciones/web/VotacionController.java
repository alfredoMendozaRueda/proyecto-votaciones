package com.amr.votaciones.web;

import com.amr.votaciones.excepciones.DniNoEnCensoExcepcion;
import com.amr.votaciones.excepciones.EleccionNoDisponibleExcepcion;
import com.amr.votaciones.excepciones.SinPartidosDisponiblesExcepcion;
import com.amr.votaciones.excepciones.YaHaVotadoExcepcion;
import com.amr.votaciones.servicios.VotacionServicio;
import com.amr.votaciones.web.dto.MensajeResponse;
import com.amr.votaciones.web.dto.PartidoResponse;
import com.amr.votaciones.web.dto.VotarRequest;
import java.security.Principal;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Voto del usuario autenticado, compartido por los roles ADMIN y VOTANTE.
 */
@RestController
public class VotacionController {

    private final VotacionServicio votacionServicio;

    public VotacionController(VotacionServicio votacionServicio) {
        this.votacionServicio = votacionServicio;
    }

    @GetMapping("/api/votacion/partidos")
    public List<PartidoResponse> partidosParaVotar() throws EleccionNoDisponibleExcepcion, SinPartidosDisponiblesExcepcion {
        return votacionServicio.partidosParaVotar().stream().map(PartidoResponse::de).toList();
    }

    @PostMapping("/api/votacion")
    public MensajeResponse votar(@RequestBody VotarRequest peticion, Principal principal)
            throws YaHaVotadoExcepcion, DniNoEnCensoExcepcion {
        votacionServicio.votar(principal.getName(), peticion.siglasPartido());
        return new MensajeResponse("Voto registrado con éxito");
    }
}
