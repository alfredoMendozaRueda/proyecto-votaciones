package com.amr.votaciones.web.dto;

import com.amr.votaciones.modelos.Candidato;

public record CandidatoResponse(String dni, String nombreCompleto, String siglasPartido, int orden) {

    public static CandidatoResponse de(Candidato candidato) {
        return new CandidatoResponse(candidato.getDni(), candidato.getNombreCompleto(),
                candidato.getSiglasPartido(), candidato.getOrden());
    }
}
