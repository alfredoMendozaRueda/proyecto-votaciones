package servicios;

import excepciones.ElementoNoEncontradoExcepcion;
import java.sql.SQLException;
import java.util.List;
import modelos.Censo;
import repositorios.CensoRepositorio;
import repositorios.LocalidadRepositorio;

/**
 * Consulta del censo electoral, completo o filtrado por ambito geografico.
 */
public class CensoServicio {

    private final CensoRepositorio censoRepositorio;
    private final LocalidadRepositorio localidadRepositorio;

    public CensoServicio(CensoRepositorio censoRepositorio, LocalidadRepositorio localidadRepositorio) {
        this.censoRepositorio = censoRepositorio;
        this.localidadRepositorio = localidadRepositorio;
    }

    public List<Censo> censoCompleto() throws SQLException {
        return censoRepositorio.listarTodo();
    }

    public List<Censo> censoPorLocalidad(String nombreLocalidad) throws ElementoNoEncontradoExcepcion, SQLException {
        String idLocalidad = localidadRepositorio.idDeLocalidad(nombreLocalidad)
                .orElseThrow(() -> new ElementoNoEncontradoExcepcion("Localidad no encontrada: " + nombreLocalidad));
        return censoRepositorio.listarPorLocalidad(idLocalidad);
    }

    public List<Censo> censoPorComunidad(String nombreComunidad) throws ElementoNoEncontradoExcepcion, SQLException {
        String idComunidad = localidadRepositorio.idDeComunidad(nombreComunidad)
                .orElseThrow(() -> new ElementoNoEncontradoExcepcion("Comunidad no encontrada: " + nombreComunidad));
        List<String> idsLocalidad = localidadRepositorio.idsLocalidadesDeComunidad(idComunidad);
        return censoRepositorio.listarPorLocalidades(idsLocalidad);
    }

    public List<String> localidades() throws SQLException {
        return localidadRepositorio.listarNombresLocalidades();
    }

    public List<String> comunidades() throws SQLException {
        return localidadRepositorio.listarNombresComunidades();
    }
}
