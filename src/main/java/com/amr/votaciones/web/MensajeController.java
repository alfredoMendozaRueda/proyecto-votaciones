package com.amr.votaciones.web;

import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Paginas de feedback compartidas por toda la aplicacion tras una operacion
 * (patron post-redirect-get): el mensaje llega como atributo flash desde el
 * controlador que ha hecho la redireccion.
 */
@Controller
public class MensajeController {

    @GetMapping("/exito")
    public String exito() {
        return "exito";
    }

    @GetMapping("/error")
    public String error() {
        return "error";
    }
}
