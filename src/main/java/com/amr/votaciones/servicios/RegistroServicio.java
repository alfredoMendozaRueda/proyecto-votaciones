package com.amr.votaciones.servicios;

import com.amr.votaciones.excepciones.DniNoEnCensoExcepcion;
import com.amr.votaciones.excepciones.MenorDeEdadExcepcion;
import com.amr.votaciones.excepciones.UsuarioYaRegistradoExcepcion;
import com.amr.votaciones.modelos.Censo;
import com.amr.votaciones.repositorios.CensoRepository;
import com.amr.votaciones.repositorios.UsuarioRepository;
import com.amr.votaciones.seguridad.EncriptadorContrasena;
import java.time.LocalDate;
import java.time.Period;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Alta de nuevas cuentas de votante para personas que ya figuran en el censo.
 */
@Service
public class RegistroServicio {

    private static final int EDAD_MINIMA_PARA_VOTAR = 18;

    private final CensoRepository censoRepository;
    private final UsuarioRepository usuarioRepository;
    private final EncriptadorContrasena encriptador;

    public RegistroServicio(CensoRepository censoRepository,
                             UsuarioRepository usuarioRepository,
                             EncriptadorContrasena encriptador) {
        this.censoRepository = censoRepository;
        this.usuarioRepository = usuarioRepository;
        this.encriptador = encriptador;
    }

    @Transactional
    public void registrarVotante(String dni, String contrasenaEnClaro)
            throws DniNoEnCensoExcepcion, UsuarioYaRegistradoExcepcion, MenorDeEdadExcepcion {

        if (usuarioRepository.existe(dni)) {
            throw new UsuarioYaRegistradoExcepcion("Usuario ya existente, inicie sesión");
        }

        Censo persona = censoRepository.obtenerPorDni(dni)
                .orElseThrow(() -> new DniNoEnCensoExcepcion(
                        "No se ha podido registrar el usuario, no está en el censo"));

        if (esMenorDeEdad(persona.getFechaNacimiento())) {
            throw new MenorDeEdadExcepcion("El usuario es menor de edad.");
        }

        usuarioRepository.registrarVotante(dni, encriptador.cifrar(contrasenaEnClaro));
    }

    private boolean esMenorDeEdad(LocalDate fechaNacimiento) {
        return Period.between(fechaNacimiento, LocalDate.now()).getYears() < EDAD_MINIMA_PARA_VOTAR;
    }
}
