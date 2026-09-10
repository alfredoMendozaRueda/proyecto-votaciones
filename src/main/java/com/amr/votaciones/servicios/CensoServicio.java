package com.amr.votaciones.servicios;

import com.amr.votaciones.excepciones.ElementoNoEncontradoExcepcion;
import com.amr.votaciones.modelos.Censo;
import com.amr.votaciones.repositorios.CensoRepository;
import com.amr.votaciones.repositorios.ComunidadRepository;
import com.amr.votaciones.repositorios.LocalidadRepository;
import java.util.List;
import org.springframework.stereotype.Service;

/**
 * Consulta del censo electoral, completo o filtrado por ambito geografico.
 */
@Service
public class CensoServicio {

    private final CensoRepository censoRepository;
    private final LocalidadRepository localidadRepository;
    private final ComunidadRepository comunidadRepository;

    public CensoServicio(CensoRepository censoRepository,
                          LocalidadRepository localidadRepository,
                          ComunidadRepository comunidadRepository) {
        this.censoRepository = censoRepository;
        this.localidadRepository = localidadRepository;
        this.comunidadRepository = comunidadRepository;
    }

    public List<Censo> censoCompleto() {
        return censoRepository.listarTodo();
    }

    public List<Censo> censoPorLocalidad(String nombreLocalidad) throws ElementoNoEncontradoExcepcion {
        String idLocalidad = localidadRepository.idDeLocalidad(nombreLocalidad)
                .orElseThrow(() -> new ElementoNoEncontradoExcepcion("Localidad no encontrada: " + nombreLocalidad));
        return censoRepository.listarPorLocalidad(idLocalidad);
    }

    public List<Censo> censoPorComunidad(String nombreComunidad) throws ElementoNoEncontradoExcepcion {
        String idComunidad = comunidadRepository.idDeComunidad(nombreComunidad)
                .orElseThrow(() -> new ElementoNoEncontradoExcepcion("Comunidad no encontrada: " + nombreComunidad));
        List<String> idsLocalidad = localidadRepository.idsLocalidadesDeComunidad(idComunidad);
        return censoRepository.listarPorLocalidades(idsLocalidad);
    }

    public List<String> localidades() {
        return localidadRepository.listarNombresLocalidades();
    }

    public List<String> comunidades() {
        return comunidadRepository.listarNombresComunidades();
    }
}
