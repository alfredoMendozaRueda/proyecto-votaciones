package servicios;

import excepciones.ElementoNoEncontradoExcepcion;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import modelos.ResultadoPartido;
import repositorios.LocalidadRepositorio;
import repositorios.PartidoRepositorio;
import repositorios.VotoRepositorio;

/**
 * Recuento y explotacion de resultados electorales.
 */
public class ResultadosServicio {

    private final VotoRepositorio votoRepositorio;
    private final LocalidadRepositorio localidadRepositorio;
    private final PartidoRepositorio partidoRepositorio;

    public ResultadosServicio(VotoRepositorio votoRepositorio,
                               LocalidadRepositorio localidadRepositorio,
                               PartidoRepositorio partidoRepositorio) {
        this.votoRepositorio = votoRepositorio;
        this.localidadRepositorio = localidadRepositorio;
        this.partidoRepositorio = partidoRepositorio;
    }

    public List<ResultadoPartido> resultadosGlobales() throws SQLException {
        return votoRepositorio.resultadosGlobales();
    }

    public List<ResultadoPartido> resultadosPorLocalidad(String nombreLocalidad)
            throws ElementoNoEncontradoExcepcion, SQLException {
        String idLocalidad = localidadRepositorio.idDeLocalidad(nombreLocalidad)
                .orElseThrow(() -> new ElementoNoEncontradoExcepcion("Localidad no encontrada: " + nombreLocalidad));
        return votoRepositorio.resultadosPorLocalidad(idLocalidad);
    }

    public List<ResultadoPartido> resultadosPorComunidad(String nombreComunidad)
            throws ElementoNoEncontradoExcepcion, SQLException {
        String idComunidad = localidadRepositorio.idDeComunidad(nombreComunidad)
                .orElseThrow(() -> new ElementoNoEncontradoExcepcion("Comunidad no encontrada: " + nombreComunidad));
        return votoRepositorio.resultadosPorComunidad(idComunidad);
    }

    /**
     * Partido con mas votos a nivel global. Vacio si todavia no se ha
     * emitido ningun voto.
     */
    public Optional<ResultadoPartido> partidoGanador() throws SQLException {
        ResultadoPartido ganador = null;
        for (ResultadoPartido resultado : resultadosGlobales()) {
            if (ganador == null || resultado.getVotos() > ganador.getVotos()) {
                ganador = resultado;
            }
        }
        return (ganador != null && ganador.getVotos() > 0) ? Optional.of(ganador) : Optional.empty();
    }

    public Optional<String> presidenteGanador() throws SQLException {
        Optional<ResultadoPartido> ganador = partidoGanador();
        if (!ganador.isPresent()) {
            return Optional.empty();
        }
        return partidoRepositorio.presidenteDe(ganador.get().getSiglas());
    }
}
