package com.amr.votaciones.web.dto;

import java.time.LocalDate;

public record EleccionRequest(String idElecciones, String descripcion, LocalDate fechaFin) {
}
