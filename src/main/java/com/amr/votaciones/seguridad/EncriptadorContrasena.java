package com.amr.votaciones.seguridad;

/**
 * Convierte una contrasena en texto plano en su representacion cifrada para
 * guardarla o compararla, sin que el resto de la aplicacion conozca el
 * algoritmo concreto usado.
 */
public interface EncriptadorContrasena {

    String cifrar(String contrasenaEnClaro);

    default boolean coincide(String contrasenaEnClaro, String contrasenaCifrada) {
        return cifrar(contrasenaEnClaro).equals(contrasenaCifrada);
    }
}
