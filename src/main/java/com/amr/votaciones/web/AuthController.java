package com.amr.votaciones.web;

import com.amr.votaciones.web.dto.LoginRequest;
import com.amr.votaciones.web.dto.UsuarioActualResponse;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContext;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Autenticacion para el front de Angular: login/estado de sesion por JSON,
 * en lugar de un formulario servido por el propio backend. El logout lo
 * gestiona directamente el filtro de Spring Security (ver SecurityConfig).
 */
@RestController
public class AuthController {

    private final AuthenticationManager authenticationManager;

    public AuthController(AuthenticationManager authenticationManager) {
        this.authenticationManager = authenticationManager;
    }

    @PostMapping("/api/auth/login")
    public ResponseEntity<UsuarioActualResponse> login(@RequestBody LoginRequest peticion,
                                                         HttpServletRequest request,
                                                         HttpServletResponse response) {
        try {
            Authentication autenticacion = authenticationManager.authenticate(
                    new UsernamePasswordAuthenticationToken(peticion.dni(), peticion.contrasena()));

            SecurityContext contexto = SecurityContextHolder.createEmptyContext();
            contexto.setAuthentication(autenticacion);
            SecurityContextHolder.setContext(contexto);

            HttpSession sesion = request.getSession(true);
            sesion.setAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY, contexto);

            return ResponseEntity.ok(aRespuesta(autenticacion));
        } catch (BadCredentialsException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    @GetMapping("/api/auth/me")
    public ResponseEntity<UsuarioActualResponse> usuarioActual(Authentication autenticacion) {
        if (autenticacion == null) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        return ResponseEntity.ok(aRespuesta(autenticacion));
    }

    private UsuarioActualResponse aRespuesta(Authentication autenticacion) {
        String rol = autenticacion.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .findFirst()
                .map(authority -> authority.replaceFirst("^ROLE_", "").toLowerCase())
                .orElse("");
        return new UsuarioActualResponse(autenticacion.getName(), rol);
    }
}
