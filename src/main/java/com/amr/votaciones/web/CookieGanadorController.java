package com.amr.votaciones.web;

import com.amr.votaciones.excepciones.EleccionNoDisponibleExcepcion;
import com.amr.votaciones.modelos.ResultadoPartido;
import com.amr.votaciones.servicios.EleccionServicio;
import com.amr.votaciones.servicios.ResultadosServicio;
import com.amr.votaciones.web.dto.CookieGanadorResponse;
import com.amr.votaciones.web.dto.MensajeResponse;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Optional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Creacion y lectura de la cookie con el partido ganador, para el rol
 * ANALISTA.
 */
@RestController
public class CookieGanadorController {

    private static final String NOMBRE_COOKIE = "ganador";
    private static final int DURACION_SEGUNDOS = 60 * 5;

    private final EleccionServicio eleccionServicio;
    private final ResultadosServicio resultadosServicio;

    public CookieGanadorController(EleccionServicio eleccionServicio, ResultadosServicio resultadosServicio) {
        this.eleccionServicio = eleccionServicio;
        this.resultadosServicio = resultadosServicio;
    }

    @PostMapping("/api/cookie-ganador")
    public MensajeResponse crear(HttpServletResponse response) throws EleccionNoDisponibleExcepcion {
        String idEleccion = eleccionServicio.idEleccionActual().orElse(null);
        if (idEleccion != null && eleccionServicio.estaHabilitada(idEleccion)) {
            throw new EleccionNoDisponibleExcepcion("Las elecciones aún están habilitadas, no se puede crear la cookie");
        }

        Optional<ResultadoPartido> ganador = resultadosServicio.partidoGanador();
        ganador.ifPresent(resultadoPartido -> {
            Cookie cookieGanador = new Cookie(NOMBRE_COOKIE, resultadoPartido.getSiglas());
            cookieGanador.setMaxAge(DURACION_SEGUNDOS);
            cookieGanador.setPath("/");
            response.addCookie(cookieGanador);
        });

        return new MensajeResponse("Cookie creada con éxito");
    }

    @GetMapping("/api/cookie-ganador")
    public CookieGanadorResponse ver(HttpServletRequest request) {
        String partidoGanador = null;
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if (NOMBRE_COOKIE.equalsIgnoreCase(cookie.getName())) {
                    partidoGanador = cookie.getValue();
                }
            }
        }
        return new CookieGanadorResponse(partidoGanador);
    }
}
