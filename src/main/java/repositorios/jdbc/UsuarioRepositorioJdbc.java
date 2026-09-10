package repositorios.jdbc;

import config.FabricaConexiones;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import repositorios.UsuarioRepositorio;

public class UsuarioRepositorioJdbc implements UsuarioRepositorio {

    private final FabricaConexiones fabricaConexiones;

    public UsuarioRepositorioJdbc(FabricaConexiones fabricaConexiones) {
        this.fabricaConexiones = fabricaConexiones;
    }

    @Override
    public boolean existe(String dni) throws SQLException {
        String sql = "SELECT dni FROM usuarios WHERE dni = ?";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, dni);
            try (ResultSet resultado = sentencia.executeQuery()) {
                return resultado.next();
            }
        }
    }

    @Override
    public int registrarVotante(String dni, String contrasenaCifrada) throws SQLException {
        String sql = "INSERT INTO usuarios (dni, password, rol, votado) VALUES (?, ?, 'votante', FALSE)";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, dni);
            sentencia.setString(2, contrasenaCifrada);
            return sentencia.executeUpdate();
        }
    }

    @Override
    public Optional<String> obtenerContrasenaCifrada(String dni) throws SQLException {
        String sql = "SELECT password FROM usuarios WHERE dni = ?";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, dni);
            try (ResultSet resultado = sentencia.executeQuery()) {
                return resultado.next() ? Optional.ofNullable(resultado.getString("password")) : Optional.empty();
            }
        }
    }

    @Override
    public Optional<String> obtenerRol(String dni) throws SQLException {
        String sql = "SELECT rol FROM usuarios WHERE dni = ?";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, dni);
            try (ResultSet resultado = sentencia.executeQuery()) {
                return resultado.next() ? Optional.ofNullable(resultado.getString("rol")) : Optional.empty();
            }
        }
    }

    @Override
    public boolean haVotado(String dni) throws SQLException {
        String sql = "SELECT votado FROM usuarios WHERE dni = ?";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, dni);
            try (ResultSet resultado = sentencia.executeQuery()) {
                return resultado.next() && resultado.getBoolean("votado");
            }
        }
    }

    @Override
    public int marcarComoVotado(String dni) throws SQLException {
        String sql = "UPDATE usuarios SET votado = 1 WHERE dni = ?";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, dni);
            return sentencia.executeUpdate();
        }
    }

    @Override
    public void reiniciarTodosLosVotos() throws SQLException {
        String sql = "UPDATE usuarios SET votado = 0";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.executeUpdate();
        }
    }
}
