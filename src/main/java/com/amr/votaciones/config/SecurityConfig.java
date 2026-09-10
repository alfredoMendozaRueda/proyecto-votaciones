package com.amr.votaciones.config;

import com.amr.votaciones.seguridad.Md5PasswordEncoder;
import com.amr.votaciones.seguridad.UsuarioDetailsService;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.authentication.configuration.AuthenticationConfiguration;
import org.springframework.security.web.authentication.www.BasicAuthenticationFilter;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.config.annotation.web.configurers.AbstractHttpConfigurer;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.filter.OncePerRequestFilter;

/**
 * Seguridad para una API JSON consumida por la SPA de Angular: sin
 * formLogin ni vistas de error, cookie de sesion + cookie CSRF legible por
 * JavaScript, y respuestas 401/403 sin cuerpo en vez de redirecciones.
 */
@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http, AuthenticationProvider authenticationProvider)
            throws Exception {
        http
            .authenticationProvider(authenticationProvider)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/auth/login", "/api/registro").permitAll()
                .requestMatchers("/api/partidos/**", "/api/candidatos/**", "/api/localidades", "/api/comunidades")
                    .hasAnyRole("ADMIN", "ANALISTA")
                .requestMatchers("/api/elecciones/**", "/api/censo/**").hasRole("ADMIN")
                .requestMatchers("/api/votacion/**", "/api/resultados/**", "/api/ganador").hasAnyRole("ADMIN", "VOTANTE")
                .requestMatchers("/api/participacion/**", "/api/cookie-ganador").hasRole("ANALISTA")
                .requestMatchers("/api/**").authenticated()
                .anyRequest().permitAll())
            .csrf(csrf -> csrf.csrfTokenRepository(CookieCsrfTokenRepository.withHttpOnlyFalse()))
            .addFilterAfter(new CsrfCookieFilter(), BasicAuthenticationFilter.class)
            .httpBasic(AbstractHttpConfigurer::disable)
            .formLogin(AbstractHttpConfigurer::disable)
            .logout(logout -> logout
                .logoutUrl("/api/auth/logout")
                .logoutSuccessHandler((request, response, authentication) -> response.setStatus(HttpServletResponse.SC_OK))
                .deleteCookies("JSESSIONID"))
            .exceptionHandling(exceptions -> exceptions
                .authenticationEntryPoint((request, response, authException) ->
                    response.sendError(HttpServletResponse.SC_UNAUTHORIZED))
                .accessDeniedHandler((request, response, accessDeniedException) ->
                    response.sendError(HttpServletResponse.SC_FORBIDDEN)));

        return http.build();
    }

    @Bean
    public PasswordEncoder passwordEncoder(Md5PasswordEncoder md5PasswordEncoder) {
        return md5PasswordEncoder;
    }

    /**
     * Se define explicitamente (en vez de dejar que Spring Boot lo infiera)
     * para garantizar que el login usa nuestro {@link Md5PasswordEncoder} y
     * no el {@code DelegatingPasswordEncoder} por defecto.
     */
    @Bean
    public AuthenticationProvider authenticationProvider(UsuarioDetailsService usuarioDetailsService,
                                                           PasswordEncoder passwordEncoder) {
        DaoAuthenticationProvider provider = new DaoAuthenticationProvider();
        provider.setUserDetailsService(usuarioDetailsService);
        provider.setPasswordEncoder(passwordEncoder);
        return provider;
    }

    /**
     * Necesario porque {@code AuthController} autentica manualmente al
     * usuario (no hay {@code formLogin}); Spring Boot solo expone este bean
     * automaticamente cuando se usa autenticacion por formulario.
     */
    @Bean
    public AuthenticationManager authenticationManager(AuthenticationConfiguration authenticationConfiguration)
            throws Exception {
        return authenticationConfiguration.getAuthenticationManager();
    }

    /**
     * Fuerza la resolucion del {@link CsrfToken} en cada peticion para que
     * la cookie XSRF-TOKEN se escriba en la respuesta desde el primer
     * GET, tal y como espera el HttpClient de Angular.
     */
    private static final class CsrfCookieFilter extends OncePerRequestFilter {
        @Override
        protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                         FilterChain filterChain) throws ServletException, IOException {
            CsrfToken csrfToken = (CsrfToken) request.getAttribute(CsrfToken.class.getName());
            if (csrfToken != null) {
                csrfToken.getToken();
            }
            filterChain.doFilter(request, response);
        }
    }
}
