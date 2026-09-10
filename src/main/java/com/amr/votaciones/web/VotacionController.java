package com.amr.votaciones.web;

import com.amr.votaciones.excepciones.DniNoEnCensoExcepcion;
import com.amr.votaciones.excepciones.EleccionNoDisponibleExcepcion;
import com.amr.votaciones.excepciones.SinPartidosDisponiblesExcepcion;
import com.amr.votaciones.excepciones.YaHaVotadoExcepcion;
import com.amr.votaciones.servicios.VotacionServicio;
import java.security.Principal;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

/**
 * Pagina de votacion, compartida por los roles ADMIN y VOTANTE.
 */
@Controller
public class VotacionController {

    private final VotacionServicio votacionServicio;

    public VotacionController(VotacionServicio votacionServicio) {
        this.votacionServicio = votacionServicio;
    }

    @GetMapping("/votacion")
    public String formulario(Model model) throws EleccionNoDisponibleExcepcion, SinPartidosDisponiblesExcepcion {
        model.addAttribute("partidos", votacionServicio.partidosParaVotar());
        return "votacion";
    }

    @PostMapping("/votacion")
    public String votar(@RequestParam String siglasPartido, Principal principal,
                         RedirectAttributes redirectAttributes) throws YaHaVotadoExcepcion, DniNoEnCensoExcepcion {
        votacionServicio.votar(principal.getName(), siglasPartido);
        redirectAttributes.addFlashAttribute("mensaje", "Voto registrado con éxito");
        return "redirect:/exito";
    }
}
