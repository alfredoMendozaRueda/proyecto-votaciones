package com.amr.votaciones.web;

import com.amr.votaciones.excepciones.CandidatoYaRegistradoExcepcion;
import com.amr.votaciones.excepciones.DniNoEnCensoExcepcion;
import com.amr.votaciones.excepciones.ElementoNoEncontradoExcepcion;
import com.amr.votaciones.modelos.Candidato;
import com.amr.votaciones.servicios.CandidatoServicio;
import com.amr.votaciones.web.dto.CandidatoRequest;
import com.amr.votaciones.web.dto.CandidatoResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Alta y consulta de candidaturas.
 */
@RestController
public class CandidatoController {

    private final CandidatoServicio candidatoServicio;

    public CandidatoController(CandidatoServicio candidatoServicio) {
        this.candidatoServicio = candidatoServicio;
    }

    @PostMapping("/api/candidatos")
    public CandidatoResponse registrar(@RequestBody CandidatoRequest peticion)
            throws DniNoEnCensoExcepcion, CandidatoYaRegistradoExcepcion {
        Candidato candidato = new Candidato(peticion.dni(), peticion.nombreCompleto(),
                peticion.siglasPartido(), peticion.orden());
        candidatoServicio.registrarCandidato(candidato);
        return CandidatoResponse.de(candidato);
    }

    @GetMapping("/api/candidatos")
    public List<CandidatoResponse> porLocalidad(@RequestParam String localidad) throws ElementoNoEncontradoExcepcion {
        return candidatoServicio.candidatosDeLocalidad(localidad).stream().map(CandidatoResponse::de).toList();
    }
}
