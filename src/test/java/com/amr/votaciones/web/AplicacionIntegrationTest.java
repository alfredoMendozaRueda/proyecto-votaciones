package com.amr.votaciones.web;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.amr.votaciones.modelos.Rol;
import com.amr.votaciones.modelos.Usuario;
import com.amr.votaciones.repositorios.UsuarioRepository;
import com.amr.votaciones.seguridad.EncriptadorMd5;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Levanta el contexto completo de Spring Boot (API REST + seguridad) contra
 * una base de datos H2 en memoria, para verificar que las piezas encajan de
 * extremo a extremo: no es algo que los tests unitarios de la capa de
 * servicios (con repositorios mockeados) puedan comprobar.
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
    void unEndpointProtegidoDevuelve401SinAutenticar() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void unLoginCorrectoDevuelveElDniYElRol() throws Exception {
        usuarioRepository.save(new Usuario(DNI_ADMIN, encriptador.cifrar("password"), Rol.ADMIN, false));

        mockMvc.perform(post("/api/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dni\":\"" + DNI_ADMIN + "\",\"contrasena\":\"password\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.dni").value(DNI_ADMIN))
                .andExpect(jsonPath("$.rol").value("admin"));
    }

    @Test
    void unLoginConCredencialesInvalidasDevuelve401() throws Exception {
        usuarioRepository.save(new Usuario(DNI_ADMIN, encriptador.cifrar("password"), Rol.ADMIN, false));

        mockMvc.perform(post("/api/auth/login")
                        .with(csrf())
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"dni\":\"" + DNI_ADMIN + "\",\"contrasena\":\"incorrecta\"}"))
                .andExpect(status().isUnauthorized());
    }
}
