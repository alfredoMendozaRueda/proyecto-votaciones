package repositorios.jdbc;

import config.FabricaConexiones;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import modelos.Participacion;
import repositorios.ParticipacionRepositorio;

public class ParticipacionRepositorioJdbc implements ParticipacionRepositorio {

    private final FabricaConexiones fabricaConexiones;

    public ParticipacionRepositorioJdbc(FabricaConexiones fabricaConexiones) {
        this.fabricaConexiones = fabricaConexiones;
    }

    @Override
    public int registrar(Participacion participacion) throws SQLException {
        String sql = "INSERT INTO participacion (id_localidad, numero_censados, total_votos) VALUES (?, ?, ?)";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, participacion.getIdLocalidad());
            sentencia.setInt(2, participacion.getNumeroCensados());
            sentencia.setInt(3, participacion.getTotalVotos());
            return sentencia.executeUpdate();
        }
    }

    @Override
    public void borrarTodas() throws SQLException {
        String sql = "DELETE FROM participacion";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.executeUpdate();
        }
    }
}
