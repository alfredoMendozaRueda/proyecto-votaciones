package modelos;

import java.util.Objects;

/**
 * Numero de votos obtenidos por un partido en un ambito determinado
 * (global, una localidad o una comunidad).
 */
public class ResultadoPartido {

    private final String siglas;
    private final String descripcion;
    private final int votos;

    public ResultadoPartido(String siglas, String descripcion, int votos) {
        this.siglas = siglas;
        this.descripcion = descripcion;
        this.votos = votos;
    }

    public String getSiglas() {
        return siglas;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public int getVotos() {
        return votos;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof ResultadoPartido)) {
            return false;
        }
        ResultadoPartido that = (ResultadoPartido) o;
        return votos == that.votos && Objects.equals(siglas, that.siglas);
    }

    @Override
    public int hashCode() {
        return Objects.hash(siglas, votos);
    }

    @Override
    public String toString() {
        return "ResultadoPartido{siglas=" + siglas + ", votos=" + votos + "}";
    }
}
