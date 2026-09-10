package com.amr.votaciones.web.dto;

import com.amr.votaciones.modelos.ResultadoPartido;

public record ResultadoResponse(String siglas, String descripcion, int votos) {

    public static ResultadoResponse de(ResultadoPartido resultado) {
        return new ResultadoResponse(resultado.getSiglas(), resultado.getDescripcion(), resultado.getVotos());
    }
}
