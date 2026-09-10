package modelos;

import java.time.LocalDate;
import java.util.Objects;

/**
 * Registro censal de una persona con derecho a voto.
 */
public class Censo {

    private final String dni;
    private final String nombreCompleto;
    private final LocalDate fechaNacimiento;
    private final String direccion;
    private final String idLocalidad;

    public Censo(String dni, String nombreCompleto, LocalDate fechaNacimiento, String direccion, String idLocalidad) {
        this.dni = dni;
        this.nombreCompleto = nombreCompleto;
        this.fechaNacimiento = fechaNacimiento;
        this.direccion = direccion;
        this.idLocalidad = idLocalidad;
    }

    public String getDni() {
        return dni;
    }

    public String getNombreCompleto() {
        return nombreCompleto;
    }

    public LocalDate getFechaNacimiento() {
        return fechaNacimiento;
    }

    public String getDireccion() {
        return direccion;
    }

    public String getIdLocalidad() {
        return idLocalidad;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Censo)) {
            return false;
        }
        Censo censo = (Censo) o;
        return Objects.equals(dni, censo.dni);
    }

    @Override
    public int hashCode() {
        return Objects.hash(dni);
    }

    @Override
    public String toString() {
        return "Censo{dni=" + dni + ", nombreCompleto=" + nombreCompleto + ", idLocalidad=" + idLocalidad + "}";
    }
}
