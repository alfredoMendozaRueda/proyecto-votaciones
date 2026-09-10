package com.amr.votaciones.seguridad;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

/**
 * Adapta {@link EncriptadorContrasena} al contrato {@link PasswordEncoder}
 * que espera Spring Security, para poder autenticar contra las contrasenas
 * MD5 ya almacenadas sin reescribir la logica de cifrado.
 */
@Component
public class Md5PasswordEncoder implements PasswordEncoder {

    private final EncriptadorContrasena encriptador;

    public Md5PasswordEncoder(EncriptadorContrasena encriptador) {
        this.encriptador = encriptador;
    }

    @Override
    public String encode(CharSequence rawPassword) {
        return encriptador.cifrar(rawPassword.toString());
    }

    @Override
    public boolean matches(CharSequence rawPassword, String encodedPassword) {
        if (encodedPassword == null) {
            return false;
        }
        return encriptador.coincide(rawPassword.toString(), encodedPassword);
    }
}
