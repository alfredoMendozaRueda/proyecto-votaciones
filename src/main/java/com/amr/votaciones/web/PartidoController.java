package com.amr.votaciones.web;

import com.amr.votaciones.excepciones.MinimoPartidosPoliticosExcepcion;
import com.amr.votaciones.servicios.PartidoServicio;
import com.amr.votaciones.web.dto.PartidoRequest;
import com.amr.votaciones.web.dto.PartidoResponse;
import java.util.List;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Alta y consulta de partidos politicos.
 */
@RestController
public class PartidoController {

    private static final String RUTA_IMAGENES = "/imagenes/";

    private final PartidoServicio partidoServicio;

    public PartidoController(PartidoServicio partidoServicio) {
        this.partidoServicio = partidoServicio;
    }

    @GetMapping("/api/partidos")
    public List<PartidoResponse> listar() {
        return partidoServicio.listarPartidos().stream().map(PartidoResponse::de).toList();
    }

    @PostMapping("/api/partidos")
    public PartidoResponse crear(@RequestBody PartidoRequest peticion) {
        String imagen = RUTA_IMAGENES + peticion.imagen();
        partidoServicio.crearPartido(peticion.siglas(), peticion.descripcion(), imagen);
        return new PartidoResponse(peticion.siglas(), peticion.descripcion(), imagen);
    }

    @GetMapping("/api/partidos/comprobar")
    public List<PartidoResponse> comprobarMinimo() throws MinimoPartidosPoliticosExcepcion {
        return partidoServicio.partidosConMinimoRequerido().stream().map(PartidoResponse::de).toList();
    }
}
