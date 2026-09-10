package com.amr.votaciones.web;

import com.amr.votaciones.servicios.CensoServicio;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Listados de referencia geografica, usados en los desplegables del front.
 */
@RestController
public class LocalidadController {

    private final CensoServicio censoServicio;

    public LocalidadController(CensoServicio censoServicio) {
        this.censoServicio = censoServicio;
    }

    @GetMapping("/api/localidades")
    public List<String> localidades() {
        return censoServicio.localidades();
    }

    @GetMapping("/api/comunidades")
    public List<String> comunidades() {
        return censoServicio.comunidades();
    }
}
