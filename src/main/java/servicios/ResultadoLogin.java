package servicios;

/**
 * Datos resultantes de una autenticacion correcta.
 */
public class ResultadoLogin {

    private final String dni;
    private final String nombreCompleto;
    private final String rol;

    public ResultadoLogin(String dni, String nombreCompleto, String rol) {
        this.dni = dni;
        this.nombreCompleto = nombreCompleto;
        this.rol = rol;
    }

    public String getDni() {
        return dni;
    }

    public String getNombreCompleto() {
        return nombreCompleto;
    }

    public String getRol() {
        return rol;
    }
}
