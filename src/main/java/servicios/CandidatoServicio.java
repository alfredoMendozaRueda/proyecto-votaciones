package servicios;

import excepciones.CandidatoYaRegistradoExcepcion;
import excepciones.DniNoEnCensoExcepcion;
import excepciones.ElementoNoEncontradoExcepcion;
import java.sql.SQLException;
import java.util.Collections;
import java.util.List;
import modelos.Candidato;
import repositorios.CandidatoRepositorio;
import repositorios.CensoRepositorio;
import repositorios.LocalidadRepositorio;

/**
 * Alta y consulta de candidaturas.
 */
public class CandidatoServicio {

    private final CandidatoRepositorio candidatoRepositorio;
    private final CensoRepositorio censoRepositorio;
    private final LocalidadRepositorio localidadRepositorio;

    public CandidatoServicio(CandidatoRepositorio candidatoRepositorio,
                              CensoRepositorio censoRepositorio,
                              LocalidadRepositorio localidadRepositorio) {
        this.candidatoRepositorio = candidatoRepositorio;
        this.censoRepositorio = censoRepositorio;
        this.localidadRepositorio = localidadRepositorio;
    }

    public void registrarCandidato(Candidato candidato) throws DniNoEnCensoExcepcion, CandidatoYaRegistradoExcepcion, SQLException {
        if (!censoRepositorio.obtenerPorDni(candidato.getDni()).isPresent()) {
            throw new DniNoEnCensoExcepcion("No se puede registrar si no está en el censo");
        }
        if (candidatoRepositorio.existe(candidato.getDni())) {
            throw new CandidatoYaRegistradoExcepcion("No se puede registrar, ese candidato ya existe");
        }
        candidatoRepositorio.registrar(candidato);
    }

    public List<Candidato> candidatosDeLocalidad(String nombreLocalidad) throws ElementoNoEncontradoExcepcion, SQLException {
        String idLocalidad = localidadRepositorio.idDeLocalidad(nombreLocalidad)
                .orElseThrow(() -> new ElementoNoEncontradoExcepcion("Localidad no encontrada: " + nombreLocalidad));
        List<Candidato> candidatos = candidatoRepositorio.listarPorLocalidad(idLocalidad);
        return Collections.unmodifiableList(candidatos);
    }
}
