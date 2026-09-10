package com.amr.votaciones.modelos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Objects;

/**
 * Fotografia de la participacion electoral de una localidad: cuanta gente
 * censada hay y cuantos votos se han emitido.
 */
@Entity
@Table(name = "participacion")
public class Participacion {

    @Id
    @Column(name = "id_localidad")
    private String idLocalidad;

    @Column(name = "numero_censados")
    private int numeroCensados;

    @Column(name = "total_votos")
    private int totalVotos;

    protected Participacion() {
        // Requerido por JPA.
    }

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
