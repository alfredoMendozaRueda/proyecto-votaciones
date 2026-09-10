package servicios;

import excepciones.DniNoEnCensoExcepcion;
import excepciones.EleccionNoDisponibleExcepcion;
import excepciones.SinPartidosDisponiblesExcepcion;
import excepciones.YaHaVotadoExcepcion;
import java.sql.SQLException;
import java.util.List;
import modelos.Censo;
import modelos.Eleccion;
import modelos.Partido;
import modelos.Voto;
import repositorios.CensoRepositorio;
import repositorios.EleccionRepositorio;
import repositorios.PartidoRepositorio;
import repositorios.UsuarioRepositorio;
import repositorios.VotoRepositorio;

/**
 * Reglas de negocio del acto de votar.
 */
public class VotacionServicio {

    private final EleccionRepositorio eleccionRepositorio;
    private final PartidoRepositorio partidoRepositorio;
    private final CensoRepositorio censoRepositorio;
    private final UsuarioRepositorio usuarioRepositorio;
    private final VotoRepositorio votoRepositorio;

    public VotacionServicio(EleccionRepositorio eleccionRepositorio,
                             PartidoRepositorio partidoRepositorio,
                             CensoRepositorio censoRepositorio,
                             UsuarioRepositorio usuarioRepositorio,
                             VotoRepositorio votoRepositorio) {
        this.eleccionRepositorio = eleccionRepositorio;
        this.partidoRepositorio = partidoRepositorio;
        this.censoRepositorio = censoRepositorio;
        this.usuarioRepositorio = usuarioRepositorio;
        this.votoRepositorio = votoRepositorio;
    }

    public List<Partido> partidosParaVotar() throws EleccionNoDisponibleExcepcion, SinPartidosDisponiblesExcepcion, SQLException {
        String idEleccion = eleccionRepositorio.idDeLaEleccionActual()
                .orElseThrow(() -> new EleccionNoDisponibleExcepcion("No hay ninguna elección en curso"));
        String estado = eleccionRepositorio.estadoDe(idEleccion).orElse("");
        if (!Eleccion.ESTADO_HABILITADA.equalsIgnoreCase(estado)) {
            throw new EleccionNoDisponibleExcepcion("Elecciones deshabilitadas");
        }

        List<Partido> partidos = partidoRepositorio.listarTodos();
        if (partidos.isEmpty()) {
            throw new SinPartidosDisponiblesExcepcion("No hay partidos añadidos aún");
        }
        return partidos;
    }

    public boolean haVotado(String dni) throws SQLException {
        return usuarioRepositorio.haVotado(dni);
    }

    public void votar(String dni, String siglasPartido) throws YaHaVotadoExcepcion, DniNoEnCensoExcepcion, SQLException {
        if (usuarioRepositorio.haVotado(dni)) {
            throw new YaHaVotadoExcepcion("Ya has votado, no puedes volver a votar");
        }

        Censo persona = censoRepositorio.obtenerPorDni(dni)
                .orElseThrow(() -> new DniNoEnCensoExcepcion("No se ha encontrado ese dni registrado en el censo"));

        votoRepositorio.registrar(new Voto(persona.getIdLocalidad(), siglasPartido));
        usuarioRepositorio.marcarComoVotado(dni);
    }
}
