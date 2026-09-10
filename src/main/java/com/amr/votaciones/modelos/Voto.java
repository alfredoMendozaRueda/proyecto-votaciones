package com.amr.votaciones.modelos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Objects;

/**
 * Voto emitido por una persona censada en una localidad a favor de un partido.
 */
@Entity
@Table(name = "votos")
public class Voto {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "id_voto")
    private Long idVoto;

    @Column(name = "id_localidad")
    private String idLocalidad;

    @Column(name = "siglas_partido")
    private String siglasPartido;

    protected Voto() {
        // Requerido por JPA.
    }

    public Voto(String idLocalidad, String siglasPartido) {
        this.idLocalidad = idLocalidad;
        this.siglasPartido = siglasPartido;
    }

    public Long getIdVoto() {
        return idVoto;
    }

    public String getIdLocalidad() {
        return idLocalidad;
    }

    public String getSiglasPartido() {
        return siglasPartido;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Voto)) {
            return false;
        }
        Voto voto = (Voto) o;
        return Objects.equals(idVoto, voto.idVoto);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idVoto);
    }

    @Override
    public String toString() {
        return "Voto{idVoto=" + idVoto + ", idLocalidad=" + idLocalidad + ", siglasPartido=" + siglasPartido + "}";
    }
}
