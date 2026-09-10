package com.amr.votaciones.config;

import com.amr.votaciones.seguridad.Md5PasswordEncoder;
import com.amr.votaciones.seguridad.RedirectorPorRolAuthenticationSuccessHandler;
import com.amr.votaciones.seguridad.UsuarioDetailsService;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.authentication.AuthenticationProvider;
import org.springframework.security.authentication.dao.DaoAuthenticationProvider;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
public class SecurityConfig {

    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http,
                                            RedirectorPorRolAuthenticationSuccessHandler exitoLogin,
                                            AuthenticationProvider authenticationProvider) throws Exception {
        http
            .authenticationProvider(authenticationProvider)
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/", "/login", "/registro", "/despedida", "/css/**", "/imagenes/**").permitAll()
                .requestMatchers("/admin/partidos/**").hasAnyRole("ADMIN", "ANALISTA")
                .requestMatchers("/admin/**").hasRole("ADMIN")
                .requestMatchers("/analista/**").hasRole("ANALISTA")
                .requestMatchers("/usuario/**").hasRole("VOTANTE")
                .requestMatchers("/votacion", "/resultados/**", "/ganador").hasAnyRole("ADMIN", "VOTANTE")
                .anyRequest().authenticated())
            .formLogin(form -> form
                .loginPage("/login")
                .usernameParameter("dni")
                .passwordParameter("contrasena")
                .successHandler(exitoLogin)
                .failureUrl("/login?error")
                .permitAll())
            .logout(logout -> logout
                .logoutUrl("/logout")
                .logoutSuccessUrl("/despedida")
                .deleteCookies("JSESSIONID")
                .permitAll())
            .sessionManagement(session -> session.invalidSessionUrl("/login"));

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
}
