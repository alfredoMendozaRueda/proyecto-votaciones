package modelos;

import java.util.Objects;

/**
 * Fotografia de la participacion electoral de una localidad: cuanta gente
 * censada hay y cuantos votos se han emitido.
 */
public class Participacion {

    private final String idLocalidad;
    private final int numeroCensados;
    private final int totalVotos;

    public Participacion(String idLocalidad, int numeroCensados, int totalVotos) {
        this.idLocalidad = idLocalidad;
        this.numeroCensados = numeroCensados;
        this.totalVotos = totalVotos;
    }

    public String getIdLocalidad() {
        return idLocalidad;
    }

    public int getNumeroCensados() {
        return numeroCensados;
    }

    public int getTotalVotos() {
        return totalVotos;
    }

    /**
     * Porcentaje de personas censadas que han votado, en el rango [0, 100].
     * Devuelve 0 si no hay nadie censado en la localidad.
     */
    public double getPorcentajeParticipacion() {
        if (numeroCensados <= 0) {
            return 0.0;
        }
        return (totalVotos * 100.0) / numeroCensados;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Participacion)) {
            return false;
        }
        Participacion that = (Participacion) o;
        return Objects.equals(idLocalidad, that.idLocalidad);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idLocalidad);
    }

    @Override
    public String toString() {
        return "Participacion{idLocalidad=" + idLocalidad + ", numeroCensados=" + numeroCensados
                + ", totalVotos=" + totalVotos + "}";
    }
}
