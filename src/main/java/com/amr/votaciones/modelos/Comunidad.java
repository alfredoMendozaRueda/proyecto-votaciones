package com.amr.votaciones.modelos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Objects;

/**
 * Comunidad autonoma a la que pertenecen una o varias localidades.
 */
@Entity
@Table(name = "comunidades")
public class Comunidad {

    @Id
    @Column(name = "id_comunidad")
    private String idComunidad;

    @Column(name = "nombre_comunidad")
    private String nombreComunidad;

    protected Comunidad() {
        // Requerido por JPA.
    }

    public Comunidad(String idComunidad, String nombreComunidad) {
        this.idComunidad = idComunidad;
        this.nombreComunidad = nombreComunidad;
    }

    public String getIdComunidad() {
        return idComunidad;
    }

    public String getNombreComunidad() {
        return nombreComunidad;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Comunidad)) {
            return false;
        }
        Comunidad comunidad = (Comunidad) o;
        return Objects.equals(idComunidad, comunidad.idComunidad);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idComunidad);
    }

    @Override
    public String toString() {
        return "Comunidad{idComunidad=" + idComunidad + ", nombreComunidad=" + nombreComunidad + "}";
    }
}
