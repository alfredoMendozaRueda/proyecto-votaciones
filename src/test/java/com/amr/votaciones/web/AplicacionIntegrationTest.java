package com.amr.votaciones.web;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestBuilders.formLogin;
import static org.springframework.security.test.web.servlet.response.SecurityMockMvcResultMatchers.authenticated;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.redirectedUrl;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.amr.votaciones.modelos.Rol;
import com.amr.votaciones.modelos.Usuario;
import com.amr.votaciones.repositorios.UsuarioRepository;
import com.amr.votaciones.seguridad.EncriptadorMd5;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Levanta el contexto completo de Spring Boot (web + seguridad + Thymeleaf)
 * contra una base de datos H2 en memoria, para verificar que las piezas
 * encajan de extremo a extremo: no es algo que los tests unitarios de la
 * capa de servicios (con repositorios mockeados) puedan comprobar.
 */
@SpringBootTest
@AutoConfigureMockMvc
class AplicacionIntegrationTest {

    private static final String DNI_ADMIN = "23456789M";

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private UsuarioRepository usuarioRepository;

    private final EncriptadorMd5 encriptador = new EncriptadorMd5();

    @Test
    void laPaginaDeLoginEsPublica() throws Exception {
        mockMvc.perform(get("/login"))
                .andExpect(status().isOk())
                .andExpect(content().string(org.hamcrest.Matchers.containsString("Inicio de sesión")));
    }

    @Test
    void unaPaginaDeAdminRedirigeAlLoginSinAutenticar() throws Exception {
        mockMvc.perform(get("/admin/panel"))
                .andExpect(status().is3xxRedirection())
                .andExpect(redirectedUrl("http://localhost/login"));
    }

    @Test
    void unLoginCorrectoRedirigeAlPanelSegunElRol() throws Exception {
        usuarioRepository.save(new Usuario(DNI_ADMIN, encriptador.cifrar("password"), Rol.ADMIN, false));

        mockMvc.perform(formLogin().loginProcessingUrl("/login")
                        .user("dni", DNI_ADMIN)
                        .password("contrasena", "password"))
                .andExpect(authenticated())
                .andExpect(redirectedUrl("/admin/panel"));
    }
}
