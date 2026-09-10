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
import com.amr.votaciones.web.dto.MensajeResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

/**
 * Traduce las excepciones de dominio a respuestas JSON con el codigo HTTP
 * adecuado, en vez de dejar que se conviertan en un 500 generico.
 */
@RestControllerAdvice
public class ManejadorErroresGlobal {

    @ExceptionHandler(ElementoNoEncontradoExcepcion.class)
    public ResponseEntity<MensajeResponse> elementoNoEncontrado(ElementoNoEncontradoExcepcion excepcion) {
        return respuesta(HttpStatus.NOT_FOUND, excepcion.getMessage());
    }

    @ExceptionHandler({
        UsuarioYaRegistradoExcepcion.class,
        CandidatoYaRegistradoExcepcion.class,
        EleccionYaExisteExcepcion.class,
        YaHaVotadoExcepcion.class,
        EleccionNoDisponibleExcepcion.class
    })
    public ResponseEntity<MensajeResponse> conflicto(Exception excepcion) {
        return respuesta(HttpStatus.CONFLICT, excepcion.getMessage());
    }

    @ExceptionHandler({
        DniNoEnCensoExcepcion.class,
        MenorDeEdadExcepcion.class,
        MinimoPartidosPoliticosExcepcion.class,
        SinPartidosDisponiblesExcepcion.class
    })
    public ResponseEntity<MensajeResponse> reglaDeNegocioIncumplida(Exception excepcion) {
        return respuesta(HttpStatus.UNPROCESSABLE_ENTITY, excepcion.getMessage());
    }

    private ResponseEntity<MensajeResponse> respuesta(HttpStatus estado, String mensaje) {
        return ResponseEntity.status(estado).body(new MensajeResponse(mensaje));
    }
}
