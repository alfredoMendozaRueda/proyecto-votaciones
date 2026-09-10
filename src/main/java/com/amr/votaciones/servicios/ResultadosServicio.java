package com.amr.votaciones.servicios;

import com.amr.votaciones.excepciones.ElementoNoEncontradoExcepcion;
import com.amr.votaciones.modelos.ResultadoPartido;
import com.amr.votaciones.repositorios.CandidatoRepository;
import com.amr.votaciones.repositorios.ComunidadRepository;
import com.amr.votaciones.repositorios.LocalidadRepository;
import com.amr.votaciones.repositorios.VotoRepository;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * Recuento y explotacion de resultados electorales.
 */
@Service
public class ResultadosServicio {

    private final VotoRepository votoRepository;
    private final LocalidadRepository localidadRepository;
    private final ComunidadRepository comunidadRepository;
    private final CandidatoRepository candidatoRepository;

    public ResultadosServicio(VotoRepository votoRepository,
                               LocalidadRepository localidadRepository,
                               ComunidadRepository comunidadRepository,
                               CandidatoRepository candidatoRepository) {
        this.votoRepository = votoRepository;
        this.localidadRepository = localidadRepository;
        this.comunidadRepository = comunidadRepository;
        this.candidatoRepository = candidatoRepository;
    }

    public List<ResultadoPartido> resultadosGlobales() {
        return votoRepository.resultadosGlobales();
    }

    public List<ResultadoPartido> resultadosPorLocalidad(String nombreLocalidad)
            throws ElementoNoEncontradoExcepcion {
        String idLocalidad = localidadRepository.idDeLocalidad(nombreLocalidad)
                .orElseThrow(() -> new ElementoNoEncontradoExcepcion("Localidad no encontrada: " + nombreLocalidad));
        return votoRepository.resultadosPorLocalidad(idLocalidad);
    }

    public List<ResultadoPartido> resultadosPorComunidad(String nombreComunidad)
            throws ElementoNoEncontradoExcepcion {
        String idComunidad = comunidadRepository.idDeComunidad(nombreComunidad)
                .orElseThrow(() -> new ElementoNoEncontradoExcepcion("Comunidad no encontrada: " + nombreComunidad));
        return votoRepository.resultadosPorComunidad(idComunidad);
    }

    /**
     * Partido con mas votos a nivel global. Vacio si todavia no se ha
     * emitido ningun voto.
     */
    public Optional<ResultadoPartido> partidoGanador() {
        ResultadoPartido ganador = null;
        for (ResultadoPartido resultado : resultadosGlobales()) {
            if (ganador == null || resultado.getVotos() > ganador.getVotos()) {
                ganador = resultado;
            }
        }
        return (ganador != null && ganador.getVotos() > 0) ? Optional.of(ganador) : Optional.empty();
    }

    public Optional<String> presidenteGanador() {
        Optional<ResultadoPartido> ganador = partidoGanador();
        if (!ganador.isPresent()) {
            return Optional.empty();
        }
        return candidatoRepository.presidenteDe(ganador.get().getSiglas());
    }
}
