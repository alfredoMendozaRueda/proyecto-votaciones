package com.amr.votaciones.web;

import com.amr.votaciones.excepciones.CandidatoYaRegistradoExcepcion;
import com.amr.votaciones.excepciones.DniNoEnCensoExcepcion;
import com.amr.votaciones.excepciones.EleccionNoDisponibleExcepcion;
import com.amr.votaciones.excepciones.EleccionYaExisteExcepcion;
import com.amr.votaciones.excepciones.ElementoNoEncontradoExcepcion;
import com.amr.votaciones.excepciones.MenorDeEdadExcepcion;
import com.amr.votaciones.excepciones.MinimoPartidosPoliticosExcepcion;
import com.amr.votaciones.excepciones.SinPartidosDisponiblesExcepcion;
import com.amr.votaciones.excepciones.UsuarioYaRegistradoExcepcion;
import com.amr.votaciones.excepciones.YaHaVotadoExcepcion;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

/**
 * Traduce las excepciones de dominio (reglas de negocio incumplidas) a la
 * pagina de feedback compartida, en lugar de repetir el mismo
 * try/catch + redirect en cada controlador.
 */
@ControllerAdvice
public class ManejadorErroresGlobal {

    @ExceptionHandler({
            DniNoEnCensoExcepcion.class,
            CandidatoYaRegistradoExcepcion.class,
            EleccionYaExisteExcepcion.class,
            ElementoNoEncontradoExcepcion.class,
            MinimoPartidosPoliticosExcepcion.class,
            SinPartidosDisponiblesExcepcion.class,
            EleccionNoDisponibleExcepcion.class,
            MenorDeEdadExcepcion.class,
            UsuarioYaRegistradoExcepcion.class,
            YaHaVotadoExcepcion.class
    })
    public String manejarErrorDeDominio(Exception excepcion, RedirectAttributes redirectAttributes) {
        redirectAttributes.addFlashAttribute("mensaje", excepcion.getMessage());
        return "redirect:/error";
    }
}
