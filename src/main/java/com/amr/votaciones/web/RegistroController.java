package com.amr.votaciones.web;

import com.amr.votaciones.excepciones.DniNoEnCensoExcepcion;
import com.amr.votaciones.excepciones.MenorDeEdadExcepcion;
import com.amr.votaciones.excepciones.UsuarioYaRegistradoExcepcion;
import com.amr.votaciones.servicios.RegistroServicio;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

/**
 * Alta de una cuenta de votante para una persona ya censada.
 */
@Controller
public class RegistroController {

    private final RegistroServicio registroServicio;

    public RegistroController(RegistroServicio registroServicio) {
        this.registroServicio = registroServicio;
    }

    @GetMapping("/registro")
    public String formulario() {
        return "registro";
    }

    @PostMapping("/registro")
    public String registrar(@RequestParam String dni, @RequestParam String contrasena,
                             RedirectAttributes redirectAttributes)
            throws DniNoEnCensoExcepcion, UsuarioYaRegistradoExcepcion, MenorDeEdadExcepcion {
        registroServicio.registrarVotante(dni, contrasena);
        redirectAttributes.addFlashAttribute("mensaje", "Usuario registrado con éxito");
        return "redirect:/exito";
    }
}
