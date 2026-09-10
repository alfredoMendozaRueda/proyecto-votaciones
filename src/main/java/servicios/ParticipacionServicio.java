package servicios;

import excepciones.ElementoNoEncontradoExcepcion;
import java.sql.SQLException;
import java.util.List;
import modelos.Participacion;
import repositorios.CensoRepositorio;
import repositorios.LocalidadRepositorio;
import repositorios.ParticipacionRepositorio;
import repositorios.VotoRepositorio;

/**
 * Calculo y almacenamiento de la participacion electoral por localidad.
 */
public class ParticipacionServicio {

    private final CensoRepositorio censoRepositorio;
    private final VotoRepositorio votoRepositorio;
    private final LocalidadRepositorio localidadRepositorio;
    private final ParticipacionRepositorio participacionRepositorio;

    public ParticipacionServicio(CensoRepositorio censoRepositorio,
                                  VotoRepositorio votoRepositorio,
                                  LocalidadRepositorio localidadRepositorio,
                                  ParticipacionRepositorio participacionRepositorio) {
        this.censoRepositorio = censoRepositorio;
        this.votoRepositorio = votoRepositorio;
        this.localidadRepositorio = localidadRepositorio;
        this.participacionRepositorio = participacionRepositorio;
    }

    /**
     * Recalcula y persiste, para cada localidad, cuanta gente hay censada y
     * cuantos votos se han emitido.
     */
    public void recalcularParticipacion() throws SQLException {
        participacionRepositorio.borrarTodas();
        List<String> idsLocalidad = localidadRepositorio.listarIdsLocalidades();
        for (String idLocalidad : idsLocalidad) {
            int numeroCensados = censoRepositorio.contarCensadosEnLocalidad(idLocalidad);
            int totalVotos = votoRepositorio.votosEnLocalidad(idLocalidad);
            participacionRepositorio.registrar(new Participacion(idLocalidad, numeroCensados, totalVotos));
        }
    }

    /**
     * Porcentaje de personas censadas en la localidad que ya han votado.
     */
    public double porcentajeParticipacion(String nombreLocalidad) throws ElementoNoEncontradoExcepcion, SQLException {
        String idLocalidad = localidadRepositorio.idDeLocalidad(nombreLocalidad)
                .orElseThrow(() -> new ElementoNoEncontradoExcepcion("Localidad no encontrada: " + nombreLocalidad));

        int numeroCensados = censoRepositorio.contarCensadosEnLocalidad(idLocalidad);
        if (numeroCensados <= 0) {
            return 0.0;
        }
        int totalVotos = votoRepositorio.votosEnLocalidad(idLocalidad);
        return (totalVotos * 100.0) / numeroCensados;
    }
}
