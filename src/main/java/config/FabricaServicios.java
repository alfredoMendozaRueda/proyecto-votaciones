package config;

import repositorios.CandidatoRepositorio;
import repositorios.CensoRepositorio;
import repositorios.EleccionRepositorio;
import repositorios.LocalidadRepositorio;
import repositorios.ParticipacionRepositorio;
import repositorios.PartidoRepositorio;
import repositorios.UsuarioRepositorio;
import repositorios.VotoRepositorio;
import repositorios.jdbc.CandidatoRepositorioJdbc;
import repositorios.jdbc.CensoRepositorioJdbc;
import repositorios.jdbc.EleccionRepositorioJdbc;
import repositorios.jdbc.LocalidadRepositorioJdbc;
import repositorios.jdbc.ParticipacionRepositorioJdbc;
import repositorios.jdbc.PartidoRepositorioJdbc;
import repositorios.jdbc.UsuarioRepositorioJdbc;
import repositorios.jdbc.VotoRepositorioJdbc;
import seguridad.EncriptadorContrasena;
import seguridad.EncriptadorMd5;
import servicios.AutenticacionServicio;
import servicios.CandidatoServicio;
import servicios.CensoServicio;
import servicios.EleccionServicio;
import servicios.ParticipacionServicio;
import servicios.PartidoServicio;
import servicios.RegistroServicio;
import servicios.ResultadosServicio;
import servicios.VotacionServicio;

/**
 * Raiz de composicion de la aplicacion: crea y conecta repositorios y
 * servicios. Es el unico lugar que conoce las implementaciones JDBC
 * concretas; el resto del codigo (servlets, JSPs y tests) solo depende de
 * las interfaces de {@code servicios} y {@code repositorios}.
 */
public final class FabricaServicios {

    private static final FabricaConexiones FABRICA_CONEXIONES =
            new FabricaConexiones(ConfiguracionBaseDatos.desdeEntorno());

    private static final CensoRepositorio CENSO_REPOSITORIO = new CensoRepositorioJdbc(FABRICA_CONEXIONES);
    private static final LocalidadRepositorio LOCALIDAD_REPOSITORIO = new LocalidadRepositorioJdbc(FABRICA_CONEXIONES);
    private static final UsuarioRepositorio USUARIO_REPOSITORIO = new UsuarioRepositorioJdbc(FABRICA_CONEXIONES);
    private static final PartidoRepositorio PARTIDO_REPOSITORIO = new PartidoRepositorioJdbc(FABRICA_CONEXIONES);
    private static final CandidatoRepositorio CANDIDATO_REPOSITORIO = new CandidatoRepositorioJdbc(FABRICA_CONEXIONES);
    private static final EleccionRepositorio ELECCION_REPOSITORIO = new EleccionRepositorioJdbc(FABRICA_CONEXIONES);
    private static final VotoRepositorio VOTO_REPOSITORIO = new VotoRepositorioJdbc(FABRICA_CONEXIONES);
    private static final ParticipacionRepositorio PARTICIPACION_REPOSITORIO = new ParticipacionRepositorioJdbc(FABRICA_CONEXIONES);

    private static final EncriptadorContrasena ENCRIPTADOR = new EncriptadorMd5();

    private FabricaServicios() {
    }

    public static AutenticacionServicio autenticacionServicio() {
        return new AutenticacionServicio(CENSO_REPOSITORIO, USUARIO_REPOSITORIO, ENCRIPTADOR);
    }

    public static RegistroServicio registroServicio() {
        return new RegistroServicio(CENSO_REPOSITORIO, USUARIO_REPOSITORIO, ENCRIPTADOR);
    }

    public static VotacionServicio votacionServicio() {
        return new VotacionServicio(ELECCION_REPOSITORIO, PARTIDO_REPOSITORIO, CENSO_REPOSITORIO,
                USUARIO_REPOSITORIO, VOTO_REPOSITORIO);
    }

    public static PartidoServicio partidoServicio() {
        return new PartidoServicio(PARTIDO_REPOSITORIO);
    }

    public static CandidatoServicio candidatoServicio() {
        return new CandidatoServicio(CANDIDATO_REPOSITORIO, CENSO_REPOSITORIO, LOCALIDAD_REPOSITORIO);
    }

    public static EleccionServicio eleccionServicio() {
        return new EleccionServicio(ELECCION_REPOSITORIO, USUARIO_REPOSITORIO, VOTO_REPOSITORIO);
    }

    public static ResultadosServicio resultadosServicio() {
        return new ResultadosServicio(VOTO_REPOSITORIO, LOCALIDAD_REPOSITORIO, PARTIDO_REPOSITORIO);
    }

    public static CensoServicio censoServicio() {
        return new CensoServicio(CENSO_REPOSITORIO, LOCALIDAD_REPOSITORIO);
    }

    public static ParticipacionServicio participacionServicio() {
        return new ParticipacionServicio(CENSO_REPOSITORIO, VOTO_REPOSITORIO, LOCALIDAD_REPOSITORIO,
                PARTICIPACION_REPOSITORIO);
    }
}
