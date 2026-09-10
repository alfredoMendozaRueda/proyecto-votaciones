package servicios;

import excepciones.EleccionYaExisteExcepcion;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.Optional;
import modelos.Eleccion;
import repositorios.EleccionRepositorio;
import repositorios.UsuarioRepositorio;
import repositorios.VotoRepositorio;

/**
 * Ciclo de vida de la (unica) eleccion gestionada por la aplicacion.
 */
public class EleccionServicio {

    private final EleccionRepositorio eleccionRepositorio;
    private final UsuarioRepositorio usuarioRepositorio;
    private final VotoRepositorio votoRepositorio;

    public EleccionServicio(EleccionRepositorio eleccionRepositorio,
                             UsuarioRepositorio usuarioRepositorio,
                             VotoRepositorio votoRepositorio) {
        this.eleccionRepositorio = eleccionRepositorio;
        this.usuarioRepositorio = usuarioRepositorio;
        this.votoRepositorio = votoRepositorio;
    }

    public void crearEleccion(String idElecciones, String descripcion, LocalDate fechaFin)
            throws EleccionYaExisteExcepcion, SQLException {
        if (eleccionRepositorio.existeAlguna()) {
            throw new EleccionYaExisteExcepcion("Ya existe una elección, bórrala antes");
        }
        eleccionRepositorio.registrar(new Eleccion(idElecciones, descripcion, fechaFin));
    }

    public boolean habilitar(String idElecciones) throws SQLException {
        return eleccionRepositorio.habilitar(idElecciones) == 1;
    }

    public boolean deshabilitar(String idElecciones) throws SQLException {
        return eleccionRepositorio.deshabilitar(idElecciones) == 1;
    }

    /**
     * Elimina la eleccion y, si se elimina correctamente, reinicia el estado
     * de voto de todos los usuarios y borra los votos emitidos: no puede
     * quedar rastro de una eleccion que ya no existe.
     */
    public boolean eliminar(String idElecciones) throws SQLException {
        boolean eliminada = eleccionRepositorio.eliminar(idElecciones);
        if (eliminada) {
            usuarioRepositorio.reiniciarTodosLosVotos();
            votoRepositorio.borrarTodos();
        }
        return eliminada;
    }

    public boolean existeEleccion() throws SQLException {
        return eleccionRepositorio.existeAlguna();
    }

    public Optional<String> idEleccionActual() throws SQLException {
        return eleccionRepositorio.idDeLaEleccionActual();
    }

    public Optional<String> estadoDe(String idElecciones) throws SQLException {
        return eleccionRepositorio.estadoDe(idElecciones);
    }

    public boolean estaHabilitada(String idElecciones) throws SQLException {
        return estadoDe(idElecciones)
                .map(Eleccion.ESTADO_HABILITADA::equalsIgnoreCase)
                .orElse(false);
    }
}
