package repositorios.jdbc;

import config.FabricaConexiones;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import modelos.Partido;
import repositorios.PartidoRepositorio;

public class PartidoRepositorioJdbc implements PartidoRepositorio {

    private final FabricaConexiones fabricaConexiones;

    public PartidoRepositorioJdbc(FabricaConexiones fabricaConexiones) {
        this.fabricaConexiones = fabricaConexiones;
    }

    @Override
    public int registrar(Partido partido) throws SQLException {
        String sql = "INSERT INTO partidos (siglas, descripcion, imagen) VALUES (?, ?, ?)";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, partido.getSiglas());
            sentencia.setString(2, partido.getDescripcion());
            sentencia.setString(3, partido.getImagen());
            return sentencia.executeUpdate();
        }
    }

    @Override
    public int contar() throws SQLException {
        String sql = "SELECT COUNT(*) FROM partidos";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql);
             ResultSet resultado = sentencia.executeQuery()) {
            return resultado.next() ? resultado.getInt(1) : 0;
        }
    }

    @Override
    public List<String> listarSiglas() throws SQLException {
        String sql = "SELECT siglas FROM partidos";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql);
             ResultSet resultado = sentencia.executeQuery()) {
            List<String> siglas = new ArrayList<>();
            while (resultado.next()) {
                siglas.add(resultado.getString("siglas"));
            }
            return siglas;
        }
    }

    @Override
    public List<Partido> listarTodos() throws SQLException {
        String sql = "SELECT siglas, descripcion, imagen FROM partidos";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql);
             ResultSet resultado = sentencia.executeQuery()) {
            List<Partido> lista = new ArrayList<>();
            while (resultado.next()) {
                lista.add(new Partido(
                        resultado.getString("siglas"),
                        resultado.getString("descripcion"),
                        resultado.getString("imagen")));
            }
            return lista;
        }
    }

    @Override
    public Optional<String> presidenteDe(String siglas) throws SQLException {
        String sql = "SELECT nombre_candidato FROM candidatos WHERE siglas_partido = ? AND orden = 1";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, siglas);
            try (ResultSet resultado = sentencia.executeQuery()) {
                return resultado.next()
                        ? Optional.ofNullable(resultado.getString("nombre_candidato"))
                        : Optional.empty();
            }
        }
    }
}
