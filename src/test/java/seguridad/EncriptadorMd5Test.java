package seguridad;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.Test;

class EncriptadorMd5Test {

    private final EncriptadorMd5 encriptador = new EncriptadorMd5();

    @Test
    void cifraSiempreIgualParaLaMismaEntrada() {
        assertThat(encriptador.cifrar("password")).isEqualTo(encriptador.cifrar("password"));
    }

    @Test
    void produceElHashMd5ConocidoDeLaPalabraPassword() {
        // Valor usado como semilla en la base de datos de ejemplo del proyecto.
        assertThat(encriptador.cifrar("password")).isEqualTo("5f4dcc3b5aa765d61d8327deb882cf99");
    }

    @Test
    void entradasDistintasProducenHashesDistintos() {
        assertThat(encriptador.cifrar("clave1")).isNotEqualTo(encriptador.cifrar("clave2"));
    }

    @Test
    void coincideDevuelveTrueCuandoElHashCorresponde() {
        String hash = encriptador.cifrar("secreta");
        assertThat(encriptador.coincide("secreta", hash)).isTrue();
    }

    @Test
    void coincideDevuelveFalseCuandoElHashNoCorresponde() {
        String hash = encriptador.cifrar("secreta");
        assertThat(encriptador.coincide("otra", hash)).isFalse();
    }
}
