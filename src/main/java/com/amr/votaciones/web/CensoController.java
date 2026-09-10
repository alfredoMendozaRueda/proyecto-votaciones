package com.amr.votaciones.web;

import com.amr.votaciones.excepciones.ElementoNoEncontradoExcepcion;
import com.amr.votaciones.modelos.Censo;
import com.amr.votaciones.servicios.CensoServicio;
import com.amr.votaciones.web.dto.CensoResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Consulta del censo electoral, completo o filtrado por ambito geografico.
 */
@RestController
public class CensoController {

    private final CensoServicio censoServicio;

    public CensoController(CensoServicio censoServicio) {
        this.censoServicio = censoServicio;
    }

    @GetMapping("/api/censo")
    public List<CensoResponse> censo(@RequestParam(required = false) String localidad,
                                      @RequestParam(required = false) String comunidad)
            throws ElementoNoEncontradoExcepcion {
        if (localidad != null) {
            return mapear(censoServicio.censoPorLocalidad(localidad));
        }
        if (comunidad != null) {
            return mapear(censoServicio.censoPorComunidad(comunidad));
        }
        return mapear(censoServicio.censoCompleto());
    }

    private List<CensoResponse> mapear(List<Censo> censo) {
        return censo.stream().map(CensoResponse::de).toList();
    }
}
