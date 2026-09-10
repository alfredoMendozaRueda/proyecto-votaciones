package modelos;

import java.util.Objects;

/**
 * Voto emitido por una persona censada en una localidad a favor de un partido.
 */
public class Voto {

    private String idVoto;
    private final String idLocalidad;
    private final String siglasPartido;

    public Voto(String idLocalidad, String siglasPartido) {
        this.idLocalidad = idLocalidad;
        this.siglasPartido = siglasPartido;
    }

    public Voto(String idVoto, String idLocalidad, String siglasPartido) {
        this.idVoto = idVoto;
        this.idLocalidad = idLocalidad;
        this.siglasPartido = siglasPartido;
    }

    public String getIdVoto() {
        return idVoto;
    }

    public String getIdLocalidad() {
        return idLocalidad;
    }

    public String getSiglasPartido() {
        return siglasPartido;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof Voto)) {
            return false;
        }
        Voto voto = (Voto) o;
        return Objects.equals(idVoto, voto.idVoto)
                && Objects.equals(idLocalidad, voto.idLocalidad)
                && Objects.equals(siglasPartido, voto.siglasPartido);
    }

    @Override
    public int hashCode() {
        return Objects.hash(idVoto, idLocalidad, siglasPartido);
    }

    @Override
    public String toString() {
        return "Voto{idVoto=" + idVoto + ", idLocalidad=" + idLocalidad + ", siglasPartido=" + siglasPartido + "}";
    }
}
