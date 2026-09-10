package com.amr.votaciones.web;

import com.amr.votaciones.excepciones.ElementoNoEncontradoExcepcion;
import com.amr.votaciones.excepciones.EleccionNoDisponibleExcepcion;
import com.amr.votaciones.excepciones.MinimoPartidosPoliticosExcepcion;
import com.amr.votaciones.modelos.ResultadoPartido;
import com.amr.votaciones.servicios.CandidatoServicio;
import com.amr.votaciones.servicios.CensoServicio;
import com.amr.votaciones.servicios.EleccionServicio;
import com.amr.votaciones.servicios.ParticipacionServicio;
import com.amr.votaciones.servicios.PartidoServicio;
import com.amr.votaciones.servicios.ResultadosServicio;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

/**
 * Panel de analista: comprobaciones sobre partidos, candidatos por
 * localidad, participacion electoral y la cookie con el partido ganador.
 */
@Controller
public class AnalistaController {

    private final PartidoServicio partidoServicio;
    private final CandidatoServicio candidatoServicio;
    private final CensoServicio censoServicio;
    private final ParticipacionServicio participacionServicio;
    private final EleccionServicio eleccionServicio;
    private final ResultadosServicio resultadosServicio;

    public AnalistaController(PartidoServicio partidoServicio, CandidatoServicio candidatoServicio,
                               CensoServicio censoServicio, ParticipacionServicio participacionServicio,
                               EleccionServicio eleccionServicio, ResultadosServicio resultadosServicio) {
        this.partidoServicio = partidoServicio;
        this.candidatoServicio = candidatoServicio;
        this.censoServicio = censoServicio;
        this.participacionServicio = participacionServicio;
        this.eleccionServicio = eleccionServicio;
        this.resultadosServicio = resultadosServicio;
    }

    @GetMapping("/analista/panel")
    public String panel() {
        return "analista/panel";
    }

    @GetMapping("/analista/partidos/comprobar")
    public String comprobarPartidos(Model model) throws MinimoPartidosPoliticosExcepcion {
        model.addAttribute("partidos", partidoServicio.partidosConMinimoRequerido());
        return "analista/comprobar-partidos";
    }

    @GetMapping("/analista/candidatos")
    public String selectorCandidatos(Model model) {
        model.addAttribute("localidades", censoServicio.localidades());
        return "analista/candidatos-localidad";
    }

    @GetMapping("/analista/candidatos/resultado")
    public String candidatosDeLocalidad(@RequestParam String localidad, Model model)
            throws ElementoNoEncontradoExcepcion {
        model.addAttribute("candidatos", candidatoServicio.candidatosDeLocalidad(localidad));
        model.addAttribute("nombreLocalidad", localidad);
        return "analista/candidatos-resultado";
    }

    @PostMapping("/analista/participacion/recalcular")
    public String recalcularParticipacion(RedirectAttributes redirectAttributes) {
        participacionServicio.recalcularParticipacion();
        redirectAttributes.addFlashAttribute("mensaje", "Participación registrada con éxito");
        return "redirect:/exito";
    }

    @GetMapping("/analista/participacion/porcentajes")
    public String porcentajes(Model model) {
        Map<String, Double> porcentajes = new LinkedHashMap<>();
        for (String localidad : censoServicio.localidades()) {
            try {
                porcentajes.put(localidad, participacionServicio.porcentajeParticipacion(localidad));
            } catch (ElementoNoEncontradoExcepcion ignorada) {
                // No debería ocurrir: la localidad viene de censoServicio.localidades().
            }
        }
        model.addAttribute("porcentajes", porcentajes);
        return "analista/porcentajes";
    }

    @PostMapping("/analista/cookie/crear")
    public String crearCookieGanador(HttpServletResponse response, RedirectAttributes redirectAttributes)
            throws EleccionNoDisponibleExcepcion {
        String idEleccion = eleccionServicio.idEleccionActual().orElse(null);
        if (idEleccion != null && eleccionServicio.estaHabilitada(idEleccion)) {
            throw new EleccionNoDisponibleExcepcion("Las elecciones aún están habilitadas, no se puede crear la cookie");
        }

        Optional<ResultadoPartido> ganador = resultadosServicio.partidoGanador();
        ganador.ifPresent(resultadoPartido -> {
            Cookie cookieGanador = new Cookie("ganador", resultadoPartido.getSiglas());
            cookieGanador.setMaxAge(60 * 5);
            cookieGanador.setPath("/");
            response.addCookie(cookieGanador);
        });

        redirectAttributes.addFlashAttribute("mensaje", "Cookie creada con éxito");
        return "redirect:/exito";
    }

    @GetMapping("/analista/cookie/ver")
    public String verCookieGanador(HttpServletRequest request, Model model) {
        String partidoGanador = null;
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("ganador".equalsIgnoreCase(cookie.getName())) {
                    partidoGanador = cookie.getValue();
                }
            }
        }
        model.addAttribute("partidoGanador", partidoGanador);
        return "analista/cookie";
    }
}
