package com.amr.votaciones.web;

import com.amr.votaciones.excepciones.DniNoEnCensoExcepcion;
import com.amr.votaciones.excepciones.MenorDeEdadExcepcion;
import com.amr.votaciones.excepciones.UsuarioYaRegistradoExcepcion;
import com.amr.votaciones.servicios.RegistroServicio;
import com.amr.votaciones.web.dto.MensajeResponse;
import com.amr.votaciones.web.dto.RegistroRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Alta de una cuenta de votante para una persona ya censada.
 */
@RestController
public class RegistroController {

    private final RegistroServicio registroServicio;

    public RegistroController(RegistroServicio registroServicio) {
        this.registroServicio = registroServicio;
    }

    @PostMapping("/api/registro")
    public ResponseEntity<MensajeResponse> registrar(@RequestBody RegistroRequest peticion)
            throws DniNoEnCensoExcepcion, UsuarioYaRegistradoExcepcion, MenorDeEdadExcepcion {
        registroServicio.registrarVotante(peticion.dni(), peticion.contrasena());
        return ResponseEntity.ok(new MensajeResponse("Usuario registrado con éxito"));
    }
}
