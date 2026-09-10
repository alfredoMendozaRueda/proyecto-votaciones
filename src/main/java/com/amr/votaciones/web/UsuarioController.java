package com.amr.votaciones.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Panel principal del votante.
 */
@Controller
public class UsuarioController {

    @GetMapping("/usuario/panel")
    public String panel() {
        return "usuario/panel";
    }
}
