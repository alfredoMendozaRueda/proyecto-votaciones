package com.amr.votaciones.seguridad;

import com.amr.votaciones.repositorios.CensoRepository;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.web.authentication.SimpleUrlAuthenticationSuccessHandler;
import org.springframework.stereotype.Component;

/**
 * Tras un login correcto, deja una cookie de bienvenida con el nombre del
 * votante y redirige al panel de su rol.
 */
@Component
public class RedirectorPorRolAuthenticationSuccessHandler extends SimpleUrlAuthenticationSuccessHandler {

    private static final int DURACION_COOKIE_NOMBRE_SEGUNDOS = 60 * 3;

    private final CensoRepository censoRepository;

    public RedirectorPorRolAuthenticationSuccessHandler(CensoRepository censoRepository) {
        this.censoRepository = censoRepository;
    }

    @Override
    public void onAuthenticationSuccess(HttpServletRequest request, HttpServletResponse response,
                                         Authentication authentication) throws IOException, ServletException {
        censoRepository.obtenerPorDni(authentication.getName()).ifPresent(persona -> {
            try {
                String valorCodificado = URLEncoder.encode(persona.getNombreCompleto(), StandardCharsets.UTF_8);
                Cookie cookieNombre = new Cookie("nombre", valorCodificado);
                cookieNombre.setMaxAge(DURACION_COOKIE_NOMBRE_SEGUNDOS);
                cookieNombre.setPath("/");
                response.addCookie(cookieNombre);
            } catch (RuntimeException ignorada) {
                // La cookie de bienvenida es un detalle cosmetico: no debe impedir el login.
            }
        });

        setDefaultTargetUrl(destinoPara(authentication));
        super.onAuthenticationSuccess(request, response, authentication);
    }

    private String destinoPara(Authentication authentication) {
        for (GrantedAuthority authority : authentication.getAuthorities()) {
            switch (authority.getAuthority()) {
                case "ROLE_ADMIN":
                    return "/admin/panel";
                case "ROLE_ANALISTA":
                    return "/analista/panel";
                default:
                    break;
            }
        }
        return "/usuario/panel";
    }
}
