package com.amr.votaciones.modelos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDate;
import java.util.Objects;

/**
 * Proceso electoral identificado por un codigo unico.
 */
@Entity
@Table(name = "elecciones")
public class Eleccion {

    public static final String ESTADO_HABILITADA = "habilitada";
    public static final String ESTADO_INHABILITADA = "inhabilitada";

    @Id
    @Column(name = "id_elecciones")
    private String idElecciones;

    private String descripcion;

    @Column(name = "fecha_inicio")
    private LocalDate fechaInicio;

    @Column(name = "fecha_fin")
    private LocalDate fechaFin;

    private String estado;

    protected Eleccion() {
        // Requerido por JPA.
    }

    /**
     * Crea una eleccion nueva, que arranca hoy y queda inhabilitada hasta que
     * un administrador la habilite explicitamente.
     */
    public Eleccion(String idElecciones, String descripcion, LocalDate fechaFin) {
        this(idElecciones, descripcion, LocalDate.now(), fechaFin, ESTADO_INHABILITADA);
    }

    public Eleccion(String idElecciones, String descripcion, LocalDate fechaInicio, LocalDate fechaFin, String estado) {
        this.idElecciones = idElecciones;
        this.descripcion = descripcion;
        this.fechaInicio = fechaInicio;
        this.estado = estado;
        this.fechaFin = fechaFin;
    }

    public String getIdElecciones() {
        return idElecciones;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public LocalDate getFechaInicio() {
        return fechaInicio;
    }

    public LocalDate getFechaFin() {
        return fechaFin;
    }

    public String getEstado() {
        return estado;
    }

    public void setEstado(String estado) {
        this.estado = estado;
    }

    public boolean estaHabilitada() {
        return ESTADO_HABILITADA.equalsIgnoreCase(estado);
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Eleccion)) {
            return false;
        }
        Eleccion eleccion = (Eleccion) o;
        return Objects.equals(idElecciones, eleccion.idElecciones);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idElecciones);
    }

    @Override
    public String toString() {
        return "Eleccion{id=" + idElecciones + ", descripcion=" + descripcion + ", estado=" + estado + "}";
    }
}
