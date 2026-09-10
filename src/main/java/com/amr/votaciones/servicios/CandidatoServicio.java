package com.amr.votaciones.servicios;

import com.amr.votaciones.excepciones.CandidatoYaRegistradoExcepcion;
import com.amr.votaciones.excepciones.DniNoEnCensoExcepcion;
import com.amr.votaciones.excepciones.ElementoNoEncontradoExcepcion;
import com.amr.votaciones.modelos.Candidato;
import com.amr.votaciones.repositorios.CandidatoRepository;
import com.amr.votaciones.repositorios.CensoRepository;
import com.amr.votaciones.repositorios.LocalidadRepository;
import java.util.Collections;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Alta y consulta de candidaturas.
 */
@Service
public class CandidatoServicio {

    private final CandidatoRepository candidatoRepository;
    private final CensoRepository censoRepository;
    private final LocalidadRepository localidadRepository;

    public CandidatoServicio(CandidatoRepository candidatoRepository,
                              CensoRepository censoRepository,
                              LocalidadRepository localidadRepository) {
        this.candidatoRepository = candidatoRepository;
        this.censoRepository = censoRepository;
        this.localidadRepository = localidadRepository;
    }

    @Transactional
    public void registrarCandidato(Candidato candidato) throws DniNoEnCensoExcepcion, CandidatoYaRegistradoExcepcion {
        if (!censoRepository.obtenerPorDni(candidato.getDni()).isPresent()) {
            throw new DniNoEnCensoExcepcion("No se puede registrar si no está en el censo");
        }
        if (candidatoRepository.existe(candidato.getDni())) {
            throw new CandidatoYaRegistradoExcepcion("No se puede registrar, ese candidato ya existe");
        }
        candidatoRepository.registrar(candidato);
    }

    public List<Candidato> candidatosDeLocalidad(String nombreLocalidad) throws ElementoNoEncontradoExcepcion {
        String idLocalidad = localidadRepository.idDeLocalidad(nombreLocalidad)
                .orElseThrow(() -> new ElementoNoEncontradoExcepcion("Localidad no encontrada: " + nombreLocalidad));
        List<Candidato> candidatos = candidatoRepository.listarPorLocalidad(idLocalidad);
        return Collections.unmodifiableList(candidatos);
    }
}
