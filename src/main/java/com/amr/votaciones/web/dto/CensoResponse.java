package com.amr.votaciones.web.dto;

import com.amr.votaciones.modelos.Censo;
import java.time.LocalDate;

public record CensoResponse(String dni, String nombreCompleto, LocalDate fechaNacimiento, String direccion,
                             String idLocalidad) {

    public static CensoResponse de(Censo censo) {
        return new CensoResponse(censo.getDni(), censo.getNombreCompleto(), censo.getFechaNacimiento(),
                censo.getDireccion(), censo.getIdLocalidad());
    }
}
