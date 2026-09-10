package com.amr.votaciones.servicios;

import com.amr.votaciones.excepciones.DniNoEnCensoExcepcion;
import com.amr.votaciones.excepciones.EleccionNoDisponibleExcepcion;
import com.amr.votaciones.excepciones.SinPartidosDisponiblesExcepcion;
import com.amr.votaciones.excepciones.YaHaVotadoExcepcion;
import com.amr.votaciones.modelos.Censo;
import com.amr.votaciones.modelos.Eleccion;
import com.amr.votaciones.modelos.Partido;
import com.amr.votaciones.modelos.Voto;
import com.amr.votaciones.repositorios.CensoRepository;
import com.amr.votaciones.repositorios.EleccionRepository;
import com.amr.votaciones.repositorios.PartidoRepository;
import com.amr.votaciones.repositorios.UsuarioRepository;
import com.amr.votaciones.repositorios.VotoRepository;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Reglas de negocio del acto de votar.
 */
@Service
public class VotacionServicio {

    private final EleccionRepository eleccionRepository;
    private final PartidoRepository partidoRepository;
    private final CensoRepository censoRepository;
    private final UsuarioRepository usuarioRepository;
    private final VotoRepository votoRepository;

    public VotacionServicio(EleccionRepository eleccionRepository,
                             PartidoRepository partidoRepository,
                             CensoRepository censoRepository,
                             UsuarioRepository usuarioRepository,
                             VotoRepository votoRepository) {
        this.eleccionRepository = eleccionRepository;
        this.partidoRepository = partidoRepository;
        this.censoRepository = censoRepository;
        this.usuarioRepository = usuarioRepository;
        this.votoRepository = votoRepository;
    }

    public List<Partido> partidosParaVotar() throws EleccionNoDisponibleExcepcion, SinPartidosDisponiblesExcepcion {
        String idEleccion = eleccionRepository.idDeLaEleccionActual()
                .orElseThrow(() -> new EleccionNoDisponibleExcepcion("No hay ninguna elección en curso"));
        String estado = eleccionRepository.estadoDe(idEleccion).orElse("");
        if (!Eleccion.ESTADO_HABILITADA.equalsIgnoreCase(estado)) {
            throw new EleccionNoDisponibleExcepcion("Elecciones deshabilitadas");
        }

        List<Partido> partidos = partidoRepository.listarTodos();
        if (partidos.isEmpty()) {
            throw new SinPartidosDisponiblesExcepcion("No hay partidos añadidos aún");
        }
        return partidos;
    }

    public boolean haVotado(String dni) {
        return usuarioRepository.haVotado(dni);
    }

    @Transactional
    public void votar(String dni, String siglasPartido) throws YaHaVotadoExcepcion, DniNoEnCensoExcepcion {
        if (usuarioRepository.haVotado(dni)) {
            throw new YaHaVotadoExcepcion("Ya has votado, no puedes volver a votar");
        }

        Censo persona = censoRepository.obtenerPorDni(dni)
                .orElseThrow(() -> new DniNoEnCensoExcepcion("No se ha encontrado ese dni registrado en el censo"));

        votoRepository.registrar(new Voto(persona.getIdLocalidad(), siglasPartido));
        usuarioRepository.marcarComoVotado(dni);
    }
}
