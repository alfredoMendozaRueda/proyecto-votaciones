package repositorios.jdbc;

import config.FabricaConexiones;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import modelos.ResultadoPartido;
import modelos.Voto;
import repositorios.VotoRepositorio;

public class VotoRepositorioJdbc implements VotoRepositorio {

    private final FabricaConexiones fabricaConexiones;

    public VotoRepositorioJdbc(FabricaConexiones fabricaConexiones) {
        this.fabricaConexiones = fabricaConexiones;
    }

    @Override
    public int registrar(Voto voto) throws SQLException {
        String sql = "INSERT INTO votos (id_localidad, siglas_partido) VALUES (?, ?)";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, voto.getIdLocalidad());
            sentencia.setString(2, voto.getSiglasPartido());
            return sentencia.executeUpdate();
        }
    }

    @Override
    public List<Voto> listarTodos() throws SQLException {
        String sql = "SELECT id_voto, id_localidad, siglas_partido FROM votos";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql);
             ResultSet resultado = sentencia.executeQuery()) {
            List<Voto> lista = new ArrayList<>();
            while (resultado.next()) {
                lista.add(new Voto(
                        resultado.getString("id_voto"),
                        resultado.getString("id_localidad"),
                        resultado.getString("siglas_partido")));
            }
            return lista;
        }
    }

    @Override
    public int votosEnLocalidad(String idLocalidad) throws SQLException {
        String sql = "SELECT COUNT(*) FROM votos WHERE id_localidad = ?";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, idLocalidad);
            try (ResultSet resultado = sentencia.executeQuery()) {
                return resultado.next() ? resultado.getInt(1) : 0;
            }
        }
    }

    @Override
    public List<ResultadoPartido> resultadosGlobales() throws SQLException {
        String sql = "SELECT p.siglas, p.descripcion, COUNT(v.id_voto) AS votos "
                + "FROM partidos p "
                + "LEFT JOIN votos v ON v.siglas_partido = p.siglas "
                + "GROUP BY p.siglas, p.descripcion "
                + "ORDER BY p.siglas";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql);
             ResultSet resultado = sentencia.executeQuery()) {
            return mapearResultados(resultado);
        }
    }

    @Override
    public List<ResultadoPartido> resultadosPorLocalidad(String idLocalidad) throws SQLException {
        String sql = "SELECT p.siglas, p.descripcion, COUNT(v.id_voto) AS votos "
                + "FROM partidos p "
                + "LEFT JOIN votos v ON v.siglas_partido = p.siglas AND v.id_localidad = ? "
                + "GROUP BY p.siglas, p.descripcion "
                + "ORDER BY p.siglas";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, idLocalidad);
            try (ResultSet resultado = sentencia.executeQuery()) {
                return mapearResultados(resultado);
            }
        }
    }

    @Override
    public List<ResultadoPartido> resultadosPorComunidad(String idComunidad) throws SQLException {
        String sql = "SELECT p.siglas, p.descripcion, COUNT(v.id_voto) AS votos "
                + "FROM partidos p "
                + "LEFT JOIN votos v ON v.siglas_partido = p.siglas "
                + "  AND v.id_localidad IN (SELECT id_localidad FROM localidades WHERE id_comunidad = ?) "
                + "GROUP BY p.siglas, p.descripcion "
                + "ORDER BY p.siglas";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, idComunidad);
            try (ResultSet resultado = sentencia.executeQuery()) {
                return mapearResultados(resultado);
            }
        }
    }

    @Override
    public void borrarTodos() throws SQLException {
        String sql = "DELETE FROM votos";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.executeUpdate();
        }
    }

    private List<ResultadoPartido> mapearResultados(ResultSet resultado) throws SQLException {
        List<ResultadoPartido> lista = new ArrayList<>();
        while (resultado.next()) {
            lista.add(new ResultadoPartido(
                    resultado.getString("siglas"),
                    resultado.getString("descripcion"),
                    resultado.getInt("votos")));
        }
        return lista;
    }
}
