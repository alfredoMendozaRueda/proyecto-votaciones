package com.amr.votaciones.web.dto;

public record CandidatoRequest(String dni, String nombreCompleto, String siglasPartido, int orden) {
}
