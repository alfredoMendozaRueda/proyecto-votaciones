package com.amr.votaciones.web;

import com.amr.votaciones.excepciones.ElementoNoEncontradoExcepcion;
import com.amr.votaciones.servicios.CensoServicio;
import com.amr.votaciones.servicios.EleccionServicio;
import com.amr.votaciones.servicios.ResultadosServicio;
import java.util.Optional;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;

/**
 * Consulta de resultados y del presidente ganador, compartida por los
 * roles ADMIN y VOTANTE.
 */
@Controller
public class ResultadosController {

    private final ResultadosServicio resultadosServicio;
    private final CensoServicio censoServicio;
    private final EleccionServicio eleccionServicio;

    public ResultadosController(ResultadosServicio resultadosServicio, CensoServicio censoServicio,
                                 EleccionServicio eleccionServicio) {
        this.resultadosServicio = resultadosServicio;
        this.censoServicio = censoServicio;
        this.eleccionServicio = eleccionServicio;
    }

    @GetMapping("/resultados")
    public String selector(Model model) {
        model.addAttribute("localidades", censoServicio.localidades());
        model.addAttribute("comunidades", censoServicio.comunidades());
        return "resultados/selector";
    }

    @GetMapping("/resultados/todo")
    public String todo(Model model) {
        model.addAttribute("resultados", resultadosServicio.resultadosGlobales());
        model.addAttribute("titulo", "Resultados generales");
        return "resultados/resultado";
    }

    @GetMapping("/resultados/localidad")
    public String porLocalidad(@RequestParam String nombre, Model model) throws ElementoNoEncontradoExcepcion {
        model.addAttribute("resultados", resultadosServicio.resultadosPorLocalidad(nombre));
        model.addAttribute("titulo", "Resultados en " + nombre);
        return "resultados/resultado";
    }

    @GetMapping("/resultados/comunidad")
    public String porComunidad(@RequestParam String nombre, Model model) throws ElementoNoEncontradoExcepcion {
        model.addAttribute("resultados", resultadosServicio.resultadosPorComunidad(nombre));
        model.addAttribute("titulo", "Resultados en " + nombre);
        return "resultados/resultado";
    }

    @GetMapping("/ganador")
    public String ganador(Model model) {
        String idEleccion = eleccionServicio.idEleccionActual().orElse(null);
        boolean habilitada = idEleccion != null && eleccionServicio.estaHabilitada(idEleccion);
        Optional<String> presidenteGanador = habilitada ? Optional.empty() : resultadosServicio.presidenteGanador();

        model.addAttribute("eleccionesTodaviaHabilitadas", habilitada);
        model.addAttribute("presidenteGanador", presidenteGanador.orElse(null));
        return "ganador";
    }
}
