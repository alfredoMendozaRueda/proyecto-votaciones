package com.amr.votaciones.modelos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Objects;

/**
 * Persona del censo que se presenta como candidata por un partido.
 */
@Entity
@Table(name = "candidatos")
public class Candidato {

    @Id
    private String dni;

    @Column(name = "nombre_candidato")
    private String nombreCompleto;

    @Column(name = "siglas_partido")
    private String siglasPartido;

    private int orden;

    protected Candidato() {
        // Requerido por JPA.
    }

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
