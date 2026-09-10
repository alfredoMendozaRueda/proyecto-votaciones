package com.amr.votaciones.web;

import com.amr.votaciones.excepciones.EleccionYaExisteExcepcion;
import com.amr.votaciones.servicios.EleccionServicio;
import com.amr.votaciones.web.dto.EleccionRequest;
import com.amr.votaciones.web.dto.MensajeResponse;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Ciclo de vida de la (unica) eleccion gestionada por la aplicacion.
 */
@RestController
public class EleccionController {

    private final EleccionServicio eleccionServicio;

    public EleccionController(EleccionServicio eleccionServicio) {
        this.eleccionServicio = eleccionServicio;
    }

    @PostMapping("/api/elecciones")
    public ResponseEntity<MensajeResponse> crear(@RequestBody EleccionRequest peticion) throws EleccionYaExisteExcepcion {
        eleccionServicio.crearEleccion(peticion.idElecciones(), peticion.descripcion(), peticion.fechaFin());
        return ResponseEntity.ok(new MensajeResponse("Elección registrada con éxito"));
    }

    @PutMapping("/api/elecciones/{id}/habilitar")
    public ResponseEntity<MensajeResponse> habilitar(@PathVariable("id") String idEleccion) {
        return resultadoOperacion(eleccionServicio.habilitar(idEleccion), "Elección habilitada", "No se pudo habilitar");
    }

    @PutMapping("/api/elecciones/{id}/deshabilitar")
    public ResponseEntity<MensajeResponse> deshabilitar(@PathVariable("id") String idEleccion) {
        return resultadoOperacion(eleccionServicio.deshabilitar(idEleccion), "Elección deshabilitada", "No se pudo deshabilitar");
    }

    @DeleteMapping("/api/elecciones/{id}")
    public ResponseEntity<MensajeResponse> eliminar(@PathVariable("id") String idEleccion) {
        return resultadoOperacion(eleccionServicio.eliminar(idEleccion), "Elección eliminada", "No se pudo eliminar");
    }

    private ResponseEntity<MensajeResponse> resultadoOperacion(boolean exito, String mensajeExito, String mensajeFallo) {
        if (exito) {
            return ResponseEntity.ok(new MensajeResponse(mensajeExito));
        }
        return ResponseEntity.status(HttpStatus.CONFLICT).body(new MensajeResponse(mensajeFallo));
    }
}
