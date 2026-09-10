package com.amr.votaciones.modelos;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.util.Objects;

/**
 * Cuenta de acceso a la aplicacion asociada a una persona del censo.
 */
@Entity
@Table(name = "usuarios")
public class Usuario {

    @Id
    private String dni;

    @Column(name = "password")
    private String contrasenaCifrada;

    private String rol;

    private boolean votado;

    protected Usuario() {
        // Requerido por JPA.
    }

    public Usuario(String dni, String contrasenaCifrada) {
        this.dni = dni;
        this.contrasenaCifrada = contrasenaCifrada;
        this.rol = Rol.VOTANTE;
        this.votado = false;
    }

    public Usuario(String dni, String contrasenaCifrada, String rol, boolean votado) {
        this.dni = dni;
        this.contrasenaCifrada = contrasenaCifrada;
        this.rol = rol;
        this.votado = votado;
    }

    public String getDni() {
        return dni;
    }

    public String getContrasenaCifrada() {
        return contrasenaCifrada;
    }

    public String getRol() {
        return rol;
    }

    public void setRol(String rol) {
        this.rol = rol;
    }

    public boolean isVotado() {
        return votado;
    }

    public void setVotado(boolean votado) {
        this.votado = votado;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Usuario)) {
            return false;
        }
        Usuario usuario = (Usuario) o;
        return Objects.equals(dni, usuario.dni);
    }

    @Override
    public int hashCode() {
        return Objects.hash(dni);
    }

    @Override
    public String toString() {
        return "Usuario{dni=" + dni + ", rol=" + rol + ", votado=" + votado + "}";
    }
}
