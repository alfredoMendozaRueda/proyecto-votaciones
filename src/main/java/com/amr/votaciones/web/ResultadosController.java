package com.amr.votaciones.web;

import com.amr.votaciones.excepciones.ElementoNoEncontradoExcepcion;
import com.amr.votaciones.servicios.EleccionServicio;
import com.amr.votaciones.servicios.ResultadosServicio;
import com.amr.votaciones.web.dto.GanadorResponse;
import com.amr.votaciones.web.dto.ResultadoResponse;
import java.util.List;
import java.util.Optional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * Consulta de resultados y del presidente ganador, compartida por los
 * roles ADMIN y VOTANTE.
 */
@RestController
public class ResultadosController {

    private final ResultadosServicio resultadosServicio;
    private final EleccionServicio eleccionServicio;

    public ResultadosController(ResultadosServicio resultadosServicio, EleccionServicio eleccionServicio) {
        this.resultadosServicio = resultadosServicio;
        this.eleccionServicio = eleccionServicio;
    }

    @GetMapping("/api/resultados")
    public List<ResultadoResponse> resultados(@RequestParam(required = false) String localidad,
                                               @RequestParam(required = false) String comunidad)
            throws ElementoNoEncontradoExcepcion {
        if (localidad != null) {
            return mapear(resultadosServicio.resultadosPorLocalidad(localidad));
        }
        if (comunidad != null) {
            return mapear(resultadosServicio.resultadosPorComunidad(comunidad));
        }
        return mapear(resultadosServicio.resultadosGlobales());
    }

    @GetMapping("/api/ganador")
    public GanadorResponse ganador() {
        String idEleccion = eleccionServicio.idEleccionActual().orElse(null);
        boolean habilitada = idEleccion != null && eleccionServicio.estaHabilitada(idEleccion);
        Optional<String> presidenteGanador = habilitada ? Optional.empty() : resultadosServicio.presidenteGanador();
        return new GanadorResponse(habilitada, presidenteGanador.orElse(null));
    }

    private List<ResultadoResponse> mapear(List<com.amr.votaciones.modelos.ResultadoPartido> resultados) {
        return resultados.stream().map(ResultadoResponse::de).toList();
    }
}
