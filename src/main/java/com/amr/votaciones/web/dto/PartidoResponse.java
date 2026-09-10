package com.amr.votaciones.web.dto;

import com.amr.votaciones.modelos.Partido;

public record PartidoResponse(String siglas, String descripcion, String imagen) {

    public static PartidoResponse de(Partido partido) {
        return new PartidoResponse(partido.getSiglas(), partido.getDescripcion(), partido.getImagen());
    }
}
