package com.amr.votaciones.modelos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Objects;

/**
 * Localidad perteneciente a una comunidad autonoma.
 */
@Entity
@Table(name = "localidades")
public class Localidad {

    @Id
    @Column(name = "id_localidad")
    private String idLocalidad;

    @Column(name = "nombre_localidad")
    private String nombreLocalidad;

    @Column(name = "id_comunidad")
    private String idComunidad;

    protected Localidad() {
        // Requerido por JPA.
    }

    public Localidad(String idLocalidad, String nombreLocalidad, String idComunidad) {
        this.idLocalidad = idLocalidad;
        this.nombreLocalidad = nombreLocalidad;
        this.idComunidad = idComunidad;
    }

    public String getIdLocalidad() {
        return idLocalidad;
    }

    public String getNombreLocalidad() {
        return nombreLocalidad;
    }

    public String getIdComunidad() {
        return idComunidad;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Localidad)) {
            return false;
        }
        Localidad localidad = (Localidad) o;
        return Objects.equals(idLocalidad, localidad.idLocalidad);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idLocalidad);
    }

    @Override
    public String toString() {
        return "Localidad{idLocalidad=" + idLocalidad + ", nombreLocalidad=" + nombreLocalidad + "}";
    }
}
