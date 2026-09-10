package com.amr.votaciones.web;

import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;

/**
 * Paginas publicas de entrada y salida de la aplicacion.
 */
@Controller
public class AuthViewController {

    @GetMapping("/")
    public String raiz() {
        return "redirect:/login";
    }

    @GetMapping("/login")
    public String login() {
        return "login";
    }

    @GetMapping("/despedida")
    public String despedida(HttpServletRequest request, Model model) {
        String nombre = "";
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("nombre".equalsIgnoreCase(cookie.getName())) {
                    nombre = URLDecoder.decode(cookie.getValue(), StandardCharsets.UTF_8);
                }
            }
        }
        model.addAttribute("nombre", nombre);
        return "despedida";
    }
}
