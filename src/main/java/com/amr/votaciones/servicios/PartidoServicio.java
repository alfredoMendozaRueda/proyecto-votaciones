package com.amr.votaciones.servicios;

import com.amr.votaciones.excepciones.MinimoPartidosPoliticosExcepcion;
import com.amr.votaciones.modelos.Partido;
import com.amr.votaciones.repositorios.PartidoRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Alta y consulta de partidos politicos.
 */
@Service
public class PartidoServicio {

    public static final int MINIMO_PARTIDOS_PARA_ELECCION = 7;

    private final PartidoRepository partidoRepository;

    public PartidoServicio(PartidoRepository partidoRepository) {
        this.partidoRepository = partidoRepository;
    }

    @Transactional
    public void crearPartido(String siglas, String descripcion, String rutaImagen) {
        partidoRepository.registrar(new Partido(siglas, descripcion, rutaImagen));
    }

    public List<Partido> listarPartidos() {
        return partidoRepository.listarTodos();
    }

    public int contarPartidos() {
        return partidoRepository.contar();
    }

    /**
     * Devuelve los partidos disponibles solo si se alcanza el minimo legal
     * para poder celebrar una eleccion.
     */
    public List<Partido> partidosConMinimoRequerido() throws MinimoPartidosPoliticosExcepcion {
        if (partidoRepository.contar() < MINIMO_PARTIDOS_PARA_ELECCION) {
            throw new MinimoPartidosPoliticosExcepcion(
                    "No se llega al mínimo de " + MINIMO_PARTIDOS_PARA_ELECCION + " partidos");
        }
        return partidoRepository.listarTodos();
    }
}
