package servicios;

import excepciones.MinimoPartidosPoliticosExcepcion;
import java.sql.SQLException;
import java.util.List;
import modelos.Partido;
import repositorios.PartidoRepositorio;

/**
 * Alta y consulta de partidos politicos.
 */
public class PartidoServicio {

    public static final int MINIMO_PARTIDOS_PARA_ELECCION = 7;

    private final PartidoRepositorio partidoRepositorio;

    public PartidoServicio(PartidoRepositorio partidoRepositorio) {
        this.partidoRepositorio = partidoRepositorio;
    }

    public void crearPartido(String siglas, String descripcion, String rutaImagen) throws SQLException {
        partidoRepositorio.registrar(new Partido(siglas, descripcion, rutaImagen));
    }

    public List<Partido> listarPartidos() throws SQLException {
        return partidoRepositorio.listarTodos();
    }

    public int contarPartidos() throws SQLException {
        return partidoRepositorio.contar();
    }

    /**
     * Devuelve los partidos disponibles solo si se alcanza el minimo legal
     * para poder celebrar una eleccion.
     */
    public List<Partido> partidosConMinimoRequerido() throws MinimoPartidosPoliticosExcepcion, SQLException {
        if (partidoRepositorio.contar() < MINIMO_PARTIDOS_PARA_ELECCION) {
            throw new MinimoPartidosPoliticosExcepcion(
                    "No se llega al mínimo de " + MINIMO_PARTIDOS_PARA_ELECCION + " partidos");
        }
        return partidoRepositorio.listarTodos();
    }
}
