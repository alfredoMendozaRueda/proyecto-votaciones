package servicios;

import excepciones.DniNoEnCensoExcepcion;
import excepciones.MenorDeEdadExcepcion;
import excepciones.UsuarioYaRegistradoExcepcion;
import java.sql.SQLException;
import java.time.LocalDate;
import java.time.Period;
import modelos.Censo;
import repositorios.CensoRepositorio;
import repositorios.UsuarioRepositorio;
import seguridad.EncriptadorContrasena;

/**
 * Alta de nuevas cuentas de votante para personas que ya figuran en el censo.
 */
public class RegistroServicio {

    private static final int EDAD_MINIMA_PARA_VOTAR = 18;

    private final CensoRepositorio censoRepositorio;
    private final UsuarioRepositorio usuarioRepositorio;
    private final EncriptadorContrasena encriptador;

    public RegistroServicio(CensoRepositorio censoRepositorio,
                             UsuarioRepositorio usuarioRepositorio,
                             EncriptadorContrasena encriptador) {
        this.censoRepositorio = censoRepositorio;
        this.usuarioRepositorio = usuarioRepositorio;
        this.encriptador = encriptador;
    }

    public void registrarVotante(String dni, String contrasenaEnClaro)
            throws DniNoEnCensoExcepcion, UsuarioYaRegistradoExcepcion, MenorDeEdadExcepcion, SQLException {

        if (usuarioRepositorio.existe(dni)) {
            throw new UsuarioYaRegistradoExcepcion("Usuario ya existente, inicie sesión");
        }

        Censo persona = censoRepositorio.obtenerPorDni(dni)
                .orElseThrow(() -> new DniNoEnCensoExcepcion(
                        "No se ha podido registrar el usuario, no está en el censo"));

        if (esMenorDeEdad(persona.getFechaNacimiento())) {
            throw new MenorDeEdadExcepcion("El usuario es menor de edad.");
        }

        usuarioRepositorio.registrarVotante(dni, encriptador.cifrar(contrasenaEnClaro));
    }

    private boolean esMenorDeEdad(LocalDate fechaNacimiento) {
        return Period.between(fechaNacimiento, LocalDate.now()).getYears() < EDAD_MINIMA_PARA_VOTAR;
    }
}
