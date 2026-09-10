package config;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.SQLException;

/**
 * Crea conexiones JDBC nuevas a partir de la configuracion de base de datos.
 *
 * Cada repositorio abre su propia conexion de corta duracion por operacion
 * (try-with-resources) en lugar de compartir una unica conexion mutable,
 * evitando los problemas de concurrencia y fugas de recursos del DAO
 * monolitico original.
 */
public class FabricaConexiones {

    private static final String DRIVER_JDBC = "com.mysql.cj.jdbc.Driver";

    static {
        try {
            Class.forName(DRIVER_JDBC);
        } catch (ClassNotFoundException e) {
            throw new IllegalStateException("No se encuentra el driver JDBC de MySQL: " + DRIVER_JDBC, e);
        }
    }

    private final ConfiguracionBaseDatos configuracion;

    public FabricaConexiones(ConfiguracionBaseDatos configuracion) {
        this.configuracion = configuracion;
    }

    public Connection nuevaConexion() throws SQLException {
        return DriverManager.getConnection(
                configuracion.getUrl(),
                configuracion.getUsuario(),
                configuracion.getContrasena());
    }
}
