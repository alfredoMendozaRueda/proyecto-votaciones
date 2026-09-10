package com.amr.votaciones.servicios;

import com.amr.votaciones.excepciones.ElementoNoEncontradoExcepcion;
import com.amr.votaciones.modelos.Participacion;
import com.amr.votaciones.repositorios.CensoRepository;
import com.amr.votaciones.repositorios.LocalidadRepository;
import com.amr.votaciones.repositorios.ParticipacionRepository;
import com.amr.votaciones.repositorios.VotoRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Calculo y almacenamiento de la participacion electoral por localidad.
 */
@Service
public class ParticipacionServicio {

    private final CensoRepository censoRepository;
    private final VotoRepository votoRepository;
    private final LocalidadRepository localidadRepository;
    private final ParticipacionRepository participacionRepository;

    public ParticipacionServicio(CensoRepository censoRepository,
                                  VotoRepository votoRepository,
                                  LocalidadRepository localidadRepository,
                                  ParticipacionRepository participacionRepository) {
        this.censoRepository = censoRepository;
        this.votoRepository = votoRepository;
        this.localidadRepository = localidadRepository;
        this.participacionRepository = participacionRepository;
    }

    /**
     * Recalcula y persiste, para cada localidad, cuanta gente hay censada y
     * cuantos votos se han emitido.
     */
    @Transactional
    public void recalcularParticipacion() {
        participacionRepository.borrarTodas();
        List<String> idsLocalidad = localidadRepository.listarIdsLocalidades();
        for (String idLocalidad : idsLocalidad) {
            int numeroCensados = censoRepository.contarCensadosEnLocalidad(idLocalidad);
            int totalVotos = votoRepository.votosEnLocalidad(idLocalidad);
            participacionRepository.registrar(new Participacion(idLocalidad, numeroCensados, totalVotos));
        }
    }

    /**
     * Porcentaje de personas censadas en la localidad que ya han votado.
     */
    public double porcentajeParticipacion(String nombreLocalidad) throws ElementoNoEncontradoExcepcion {
        String idLocalidad = localidadRepository.idDeLocalidad(nombreLocalidad)
                .orElseThrow(() -> new ElementoNoEncontradoExcepcion("Localidad no encontrada: " + nombreLocalidad));

        int numeroCensados = censoRepository.contarCensadosEnLocalidad(idLocalidad);
        if (numeroCensados <= 0) {
            return 0.0;
        }
        int totalVotos = votoRepository.votosEnLocalidad(idLocalidad);
        return (totalVotos * 100.0) / numeroCensados;
    }
}
