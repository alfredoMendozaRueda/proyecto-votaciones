package com.amr.votaciones.repositorios;

import com.amr.votaciones.modelos.Usuario;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface UsuarioRepository extends JpaRepository<Usuario, String> {

    @Modifying
    @Query("UPDATE Usuario u SET u.votado = false")
    void reiniciarTodosLosVotos();

    default boolean existe(String dni) {
        return existsById(dni);
    }

    default int registrarVotante(String dni, String contrasenaCifrada) {
        save(new Usuario(dni, contrasenaCifrada));
        return 1;
    }

    default Optional<String> obtenerContrasenaCifrada(String dni) {
        return findById(dni).map(Usuario::getContrasenaCifrada);
    }

    default Optional<String> obtenerRol(String dni) {
        return findById(dni).map(Usuario::getRol);
    }

    default boolean haVotado(String dni) {
        return findById(dni).map(Usuario::isVotado).orElse(false);
    }

    default int marcarComoVotado(String dni) {
        return findById(dni).map(usuario -> {
            usuario.setVotado(true);
            save(usuario);
            return 1;
        }).orElse(0);
    }
}
