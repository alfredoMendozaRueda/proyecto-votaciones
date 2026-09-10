package repositorios.jdbc;

import config.FabricaConexiones;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import modelos.Candidato;
import repositorios.CandidatoRepositorio;

public class CandidatoRepositorioJdbc implements CandidatoRepositorio {

    private final FabricaConexiones fabricaConexiones;

    public CandidatoRepositorioJdbc(FabricaConexiones fabricaConexiones) {
        this.fabricaConexiones = fabricaConexiones;
    }

    @Override
    public int registrar(Candidato candidato) throws SQLException {
        String sql = "INSERT INTO candidatos (dni, nombre_candidato, siglas_partido, orden) VALUES (?, ?, ?, ?)";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, candidato.getDni());
            sentencia.setString(2, candidato.getNombreCompleto());
            sentencia.setString(3, candidato.getSiglasPartido());
            sentencia.setInt(4, candidato.getOrden());
            return sentencia.executeUpdate();
        }
    }

    @Override
    public boolean existe(String dni) throws SQLException {
        String sql = "SELECT dni FROM candidatos WHERE dni = ?";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, dni);
            try (ResultSet resultado = sentencia.executeQuery()) {
                return resultado.next();
            }
        }
    }

    @Override
    public List<Candidato> listarPorLocalidad(String idLocalidad) throws SQLException {
        String sql = "SELECT c.dni, cen.nombre_completo, c.siglas_partido, c.orden "
                + "FROM candidatos c "
                + "JOIN censo cen ON cen.dni = c.dni "
                + "WHERE cen.id_localidad = ? "
                + "ORDER BY c.siglas_partido, c.orden";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, idLocalidad);
            try (ResultSet resultado = sentencia.executeQuery()) {
                List<Candidato> lista = new ArrayList<>();
                while (resultado.next()) {
                    lista.add(new Candidato(
                            resultado.getString("dni"),
                            resultado.getString("nombre_completo"),
                            resultado.getString("siglas_partido"),
                            resultado.getInt("orden")));
                }
                return lista;
            }
        }
    }
}
