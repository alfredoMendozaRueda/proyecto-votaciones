package servicios;

import excepciones.CredencialesInvalidasExcepcion;
import excepciones.DniNoEnCensoExcepcion;
import java.sql.SQLException;
import java.util.Optional;
import modelos.Censo;
import modelos.Rol;
import repositorios.CensoRepositorio;
import repositorios.UsuarioRepositorio;
import seguridad.EncriptadorContrasena;

/**
 * Valida las credenciales de acceso de un usuario ya registrado.
 */
public class AutenticacionServicio {

    private final CensoRepositorio censoRepositorio;
    private final UsuarioRepositorio usuarioRepositorio;
    private final EncriptadorContrasena encriptador;

    public AutenticacionServicio(CensoRepositorio censoRepositorio,
                                  UsuarioRepositorio usuarioRepositorio,
                                  EncriptadorContrasena encriptador) {
        this.censoRepositorio = censoRepositorio;
        this.usuarioRepositorio = usuarioRepositorio;
        this.encriptador = encriptador;
    }

    public ResultadoLogin autenticar(String dni, String contrasenaEnClaro)
            throws DniNoEnCensoExcepcion, CredencialesInvalidasExcepcion, SQLException {

        Censo persona = censoRepositorio.obtenerPorDni(dni)
                .orElseThrow(() -> new DniNoEnCensoExcepcion(
                        "No se ha encontrado ese dni registrado en el censo"));

        Optional<String> contrasenaCifrada = usuarioRepositorio.obtenerContrasenaCifrada(dni);
        if (!contrasenaCifrada.isPresent() || !encriptador.coincide(contrasenaEnClaro, contrasenaCifrada.get())) {
            throw new CredencialesInvalidasExcepcion("Contraseña incorrecta, inténtalo de nuevo");
        }

        String rol = usuarioRepositorio.obtenerRol(dni).orElse(Rol.VOTANTE);
        return new ResultadoLogin(dni, persona.getNombreCompleto(), rol);
    }
}
