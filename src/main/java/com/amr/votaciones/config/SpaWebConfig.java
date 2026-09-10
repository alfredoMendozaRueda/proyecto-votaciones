package com.amr.votaciones.config;

import java.io.IOException;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.resource.PathResourceResolver;

/**
 * La SPA de Angular gestiona sus propias rutas (/login, /admin/partidos...)
 * en el navegador, pero una peticion directa a una de ellas (recargar la
 * pagina, entrar por un enlace guardado) llega al servidor, que no tiene
 * ningun controlador para esa ruta. Sin este resolver, Spring devuelve 404
 * en vez de servir la aplicacion. Al no encontrar un fichero estatico real
 * para la ruta pedida, se cae siempre a index.html y es el router de
 * Angular quien decide que pantalla mostrar.
 */
@Configuration
public class SpaWebConfig implements WebMvcConfigurer {

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        registry
            .addResourceHandler("/**")
            .addResourceLocations("classpath:/static/")
            .resourceChain(true)
            .addResolver(new PathResourceResolver() {
                @Override
                protected Resource getResource(String resourcePath, Resource location) throws IOException {
                    Resource requested = location.createRelative(resourcePath);
                    if (requested.exists() && requested.isReadable()) {
                        return requested;
                    }
                    if (resourcePath.startsWith("api/")) {
                        return null;
                    }
                    return new ClassPathResource("/static/index.html");
                }
            });
    }
}
