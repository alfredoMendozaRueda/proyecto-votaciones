package repositorios.jdbc;

import config.FabricaConexiones;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import repositorios.LocalidadRepositorio;

public class LocalidadRepositorioJdbc implements LocalidadRepositorio {

    private final FabricaConexiones fabricaConexiones;

    public LocalidadRepositorioJdbc(FabricaConexiones fabricaConexiones) {
        this.fabricaConexiones = fabricaConexiones;
    }

    @Override
    public List<String> listarNombresLocalidades() throws SQLException {
        return listarColumna("SELECT nombre_localidad FROM localidades", "nombre_localidad");
    }

    @Override
    public List<String> listarIdsLocalidades() throws SQLException {
        return listarColumna("SELECT id_localidad FROM localidades", "id_localidad");
    }

    @Override
    public List<String> listarNombresComunidades() throws SQLException {
        return listarColumna("SELECT nombre_comunidad FROM comunidades", "nombre_comunidad");
    }

    @Override
    public Optional<String> idDeLocalidad(String nombreLocalidad) throws SQLException {
        String sql = "SELECT id_localidad FROM localidades WHERE nombre_localidad = ?";
        return buscarUnaColumna(sql, nombreLocalidad, "id_localidad");
    }

    @Override
    public Optional<String> idDeComunidad(String nombreComunidad) throws SQLException {
        String sql = "SELECT id_comunidad FROM comunidades WHERE nombre_comunidad = ?";
        return buscarUnaColumna(sql, nombreComunidad, "id_comunidad");
    }

    @Override
    public List<String> idsLocalidadesDeComunidad(String idComunidad) throws SQLException {
        String sql = "SELECT id_localidad FROM localidades WHERE id_comunidad = ?";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, idComunidad);
            try (ResultSet resultado = sentencia.executeQuery()) {
                List<String> lista = new ArrayList<>();
                while (resultado.next()) {
                    lista.add(resultado.getString("id_localidad"));
                }
                return lista;
            }
        }
    }

    private List<String> listarColumna(String sql, String columna) throws SQLException {
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql);
             ResultSet resultado = sentencia.executeQuery()) {
            List<String> lista = new ArrayList<>();
            while (resultado.next()) {
                lista.add(resultado.getString(columna));
            }
            return lista;
        }
    }

    private Optional<String> buscarUnaColumna(String sql, String parametro, String columna) throws SQLException {
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, parametro);
            try (ResultSet resultado = sentencia.executeQuery()) {
                return resultado.next() ? Optional.ofNullable(resultado.getString(columna)) : Optional.empty();
            }
        }
    }
}
