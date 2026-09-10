package config;

/**
 * Parametros de conexion a la base de datos.
 *
 * Los valores se leen de variables de entorno o propiedades del sistema
 * (DB_URL, DB_USUARIO, DB_CONTRASENA) para no dejar credenciales escritas en
 * el codigo fuente. Si no se definen, se usan valores por defecto validos
 * para un entorno de desarrollo local.
 */
public final class ConfiguracionBaseDatos {

    private static final String URL_POR_DEFECTO =
            "jdbc:mysql://localhost:3306/bbdd_amr_elecciones?useUnicode=true&characterEncoding=UTF-8";
    private static final String USUARIO_POR_DEFECTO = "root";
    private static final String CONTRASENA_POR_DEFECTO = "";

    private final String url;
    private final String usuario;
    private final String contrasena;

    public ConfiguracionBaseDatos(String url, String usuario, String contrasena) {
        this.url = url;
        this.usuario = usuario;
        this.contrasena = contrasena;
    }

    public static ConfiguracionBaseDatos desdeEntorno() {
        return new ConfiguracionBaseDatos(
                valorDe("DB_URL", URL_POR_DEFECTO),
                valorDe("DB_USUARIO", USUARIO_POR_DEFECTO),
                valorDe("DB_CONTRASENA", CONTRASENA_POR_DEFECTO));
    }

    private static String valorDe(String clave, String porDefecto) {
        String valor = System.getProperty(clave, System.getenv(clave));
        return (valor == null || valor.isEmpty()) ? porDefecto : valor;
    }

    public String getUrl() {
        return url;
    }

    public String getUsuario() {
        return usuario;
    }

    public String getContrasena() {
        return contrasena;
    }
}
