package modelos;

import java.util.Objects;

/**
 * Partido politico que puede recibir votos en una eleccion.
 */
public class Partido {

    private final String siglas;
    private final String descripcion;
    private final String imagen;

    public Partido(String siglas, String descripcion, String imagen) {
        this.siglas = siglas;
        this.descripcion = descripcion;
        this.imagen = imagen;
    }

    public String getSiglas() {
        return siglas;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public String getImagen() {
        return imagen;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Partido)) {
            return false;
        }
        Partido partido = (Partido) o;
        return Objects.equals(siglas, partido.siglas);
    }

    @Override
    public int hashCode() {
        return Objects.hash(siglas);
    }

    @Override
    public String toString() {
        return "Partido{siglas=" + siglas + ", descripcion=" + descripcion + "}";
    }
}
