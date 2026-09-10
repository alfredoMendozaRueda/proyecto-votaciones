package modelos;

import java.util.Objects;

/**
 * Persona del censo que se presenta como candidata por un partido.
 */
public class Candidato {

    private final String dni;
    private final String nombreCompleto;
    private final String siglasPartido;
    private final int orden;

    public Candidato(String dni, String nombreCompleto, String siglasPartido, int orden) {
        this.dni = dni;
        this.nombreCompleto = nombreCompleto;
        this.siglasPartido = siglasPartido;
        this.orden = orden;
    }

    public String getDni() {
        return dni;
    }

    public String getNombreCompleto() {
        return nombreCompleto;
    }

    public String getSiglasPartido() {
        return siglasPartido;
    }

    public int getOrden() {
        return orden;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Candidato)) {
            return false;
        }
        Candidato that = (Candidato) o;
        return Objects.equals(dni, that.dni);
    }

    @Override
    public int hashCode() {
        return Objects.hash(dni);
    }

    @Override
    public String toString() {
        return "Candidato{dni=" + dni + ", nombreCompleto=" + nombreCompleto
                + ", siglasPartido=" + siglasPartido + ", orden=" + orden + "}";
    }
}
