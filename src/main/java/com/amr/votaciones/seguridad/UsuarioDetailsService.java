package com.amr.votaciones.seguridad;

import com.amr.votaciones.modelos.Usuario;
import com.amr.votaciones.repositorios.UsuarioRepository;
import java.util.List;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Service;

/**
 * Carga las cuentas de acceso (tabla {@code usuarios}) para que Spring
 * Security pueda autenticar por DNI + contrasena y aplicar control de
 * acceso por rol (ROLE_ADMIN, ROLE_ANALISTA, ROLE_VOTANTE).
 */
@Service
public class UsuarioDetailsService implements UserDetailsService {

    private final UsuarioRepository usuarioRepository;

    public UsuarioDetailsService(UsuarioRepository usuarioRepository) {
        this.usuarioRepository = usuarioRepository;
    }

    @Override
    public UserDetails loadUserByUsername(String dni) throws UsernameNotFoundException {
        Usuario usuario = usuarioRepository.findById(dni)
                .orElseThrow(() -> new UsernameNotFoundException("Usuario no encontrado: " + dni));

        return org.springframework.security.core.userdetails.User
                .withUsername(usuario.getDni())
                .password(usuario.getContrasenaCifrada())
                .authorities(List.of(new SimpleGrantedAuthority("ROLE_" + usuario.getRol().toUpperCase())))
                .build();
    }
}
