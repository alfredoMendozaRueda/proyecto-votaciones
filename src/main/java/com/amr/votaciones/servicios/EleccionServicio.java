package com.amr.votaciones.servicios;

import com.amr.votaciones.excepciones.EleccionYaExisteExcepcion;
import com.amr.votaciones.modelos.Eleccion;
import com.amr.votaciones.repositorios.EleccionRepository;
import com.amr.votaciones.repositorios.UsuarioRepository;
import com.amr.votaciones.repositorios.VotoRepository;
import java.time.LocalDate;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Ciclo de vida de la (unica) eleccion gestionada por la aplicacion.
 */
@Service
public class EleccionServicio {

    private final EleccionRepository eleccionRepository;
    private final UsuarioRepository usuarioRepository;
    private final VotoRepository votoRepository;

    public EleccionServicio(EleccionRepository eleccionRepository,
                             UsuarioRepository usuarioRepository,
                             VotoRepository votoRepository) {
        this.eleccionRepository = eleccionRepository;
        this.usuarioRepository = usuarioRepository;
        this.votoRepository = votoRepository;
    }

    @Transactional
    public void crearEleccion(String idElecciones, String descripcion, LocalDate fechaFin)
            throws EleccionYaExisteExcepcion {
        if (eleccionRepository.existeAlguna()) {
            throw new EleccionYaExisteExcepcion("Ya existe una elección, bórrala antes");
        }
        eleccionRepository.registrar(new Eleccion(idElecciones, descripcion, fechaFin));
    }

    @Transactional
    public boolean habilitar(String idElecciones) {
        return eleccionRepository.habilitar(idElecciones) == 1;
    }

    @Transactional
    public boolean deshabilitar(String idElecciones) {
        return eleccionRepository.deshabilitar(idElecciones) == 1;
    }

    /**
     * Elimina la eleccion y, si se elimina correctamente, reinicia el estado
     * de voto de todos los usuarios y borra los votos emitidos: no puede
     * quedar rastro de una eleccion que ya no existe.
     */
    @Transactional
    public boolean eliminar(String idElecciones) {
        boolean eliminada = eleccionRepository.eliminar(idElecciones);
        if (eliminada) {
            usuarioRepository.reiniciarTodosLosVotos();
            votoRepository.borrarTodos();
        }
        return eliminada;
    }

    public boolean existeEleccion() {
        return eleccionRepository.existeAlguna();
    }

    public Optional<String> idEleccionActual() {
        return eleccionRepository.idDeLaEleccionActual();
    }

    public Optional<String> estadoDe(String idElecciones) {
        return eleccionRepository.estadoDe(idElecciones);
    }

    public boolean estaHabilitada(String idElecciones) {
        return estadoDe(idElecciones)
                .map(Eleccion.ESTADO_HABILITADA::equalsIgnoreCase)
                .orElse(false);
    }
}
