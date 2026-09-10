package repositorios.jdbc;

import config.FabricaConexiones;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import modelos.Eleccion;
import repositorios.EleccionRepositorio;

public class EleccionRepositorioJdbc implements EleccionRepositorio {

    private final FabricaConexiones fabricaConexiones;

    public EleccionRepositorioJdbc(FabricaConexiones fabricaConexiones) {
        this.fabricaConexiones = fabricaConexiones;
    }

    @Override
    public int registrar(Eleccion eleccion) throws SQLException {
        String sql = "INSERT INTO elecciones (id_elecciones, descripcion, fecha_inicio, fecha_fin, estado) "
                + "VALUES (?, ?, ?, ?, ?)";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, eleccion.getIdElecciones());
            sentencia.setString(2, eleccion.getDescripcion());
            sentencia.setString(3, eleccion.getFechaInicio().toString());
            sentencia.setString(4, eleccion.getFechaFin().toString());
            sentencia.setString(5, eleccion.getEstado());
            return sentencia.executeUpdate();
        }
    }

    @Override
    public boolean existeAlguna() throws SQLException {
        String sql = "SELECT COUNT(*) FROM elecciones";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql);
             ResultSet resultado = sentencia.executeQuery()) {
            return resultado.next() && resultado.getInt(1) > 0;
        }
    }

    @Override
    public Optional<String> idDeLaEleccionActual() throws SQLException {
        String sql = "SELECT id_elecciones FROM elecciones";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql);
             ResultSet resultado = sentencia.executeQuery()) {
            return resultado.next() ? Optional.ofNullable(resultado.getString("id_elecciones")) : Optional.empty();
        }
    }

    @Override
    public boolean eliminar(String idElecciones) throws SQLException {
        String sql = "DELETE FROM elecciones WHERE id_elecciones = ?";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, idElecciones);
            return sentencia.executeUpdate() > 0;
        }
    }

    @Override
    public int habilitar(String idElecciones) throws SQLException {
        return actualizarEstado(idElecciones, Eleccion.ESTADO_HABILITADA);
    }

    @Override
    public int deshabilitar(String idElecciones) throws SQLException {
        return actualizarEstado(idElecciones, Eleccion.ESTADO_INHABILITADA);
    }

    private int actualizarEstado(String idElecciones, String estado) throws SQLException {
        String sql = "UPDATE elecciones SET estado = ? WHERE id_elecciones = ?";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, estado);
            sentencia.setString(2, idElecciones);
            return sentencia.executeUpdate();
        }
    }

    @Override
    public Optional<String> estadoDe(String idElecciones) throws SQLException {
        String sql = "SELECT estado FROM elecciones WHERE id_elecciones = ?";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, idElecciones);
            try (ResultSet resultado = sentencia.executeQuery()) {
                return resultado.next() ? Optional.ofNullable(resultado.getString("estado")) : Optional.empty();
            }
        }
    }
}
