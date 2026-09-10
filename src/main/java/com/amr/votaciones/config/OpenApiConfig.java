package com.amr.votaciones.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Metadatos de la documentacion interactiva de la API (Swagger UI en
 * /swagger-ui.html, especificacion en /v3/api-docs). La autenticacion es
 * por cookie de sesion (ver SecurityConfig), no por token Bearer, asi que
 * para probar un endpoint protegido desde Swagger UI primero hay que
 * iniciar sesion en la propia aplicacion (misma pestana/origen) para que
 * el navegador ya tenga la cookie JSESSIONID.
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI votacionesOpenApi() {
        return new OpenAPI()
            .info(new Info()
                .title("API de e-Votaciones")
                .description(
                    "Endpoints REST del sistema de gestion de elecciones, censo y votaciones. "
                        + "La autenticacion usa una cookie de sesion (no Bearer token): inicia "
                        + "sesion primero en la aplicacion para poder probar aqui los endpoints "
                        + "protegidos.")
                .version("v1"));
    }
}
