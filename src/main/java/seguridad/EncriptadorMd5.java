package seguridad;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;

/**
 * Implementacion con MD5, mantenida por compatibilidad con las contrasenas
 * ya almacenadas en la base de datos existente.
 *
 * <p><b>Aviso de seguridad:</b> MD5 no es un algoritmo apto para contrasenas
 * (es rapido de fuerza-bruta y no usa "salt"). En un sistema nuevo deberia
 * sustituirse por BCrypt/Argon2, lo que requeriria re-cifrar las contrasenas
 * existentes en un proceso de migracion aparte. Se aisla aqui, detras de
 * {@link EncriptadorContrasena}, precisamente para que ese cambio futuro no
 * afecte al resto de la aplicacion.</p>
 */
public class EncriptadorMd5 implements EncriptadorContrasena {

    @Override
    public String cifrar(String contrasenaEnClaro) {
        try {
            MessageDigest digest = MessageDigest.getInstance("MD5");
            byte[] hash = digest.digest(contrasenaEnClaro.getBytes(StandardCharsets.UTF_8));
            StringBuilder resultado = new StringBuilder(hash.length * 2);
            for (byte b : hash) {
                resultado.append(String.format("%02x", b));
            }
            return resultado.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("El algoritmo MD5 no esta disponible en esta JVM", e);
        }
    }
}
