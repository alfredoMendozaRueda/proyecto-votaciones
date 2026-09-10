package repositorios.jdbc;

import config.FabricaConexiones;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import modelos.Censo;
import repositorios.CensoRepositorio;

public class CensoRepositorioJdbc implements CensoRepositorio {

    private static final String COLUMNAS = "dni, nombre_completo, fecha_nacimiento, direccion, id_localidad";

    private final FabricaConexiones fabricaConexiones;

    public CensoRepositorioJdbc(FabricaConexiones fabricaConexiones) {
        this.fabricaConexiones = fabricaConexiones;
    }

    @Override
    public Optional<Censo> obtenerPorDni(String dni) throws SQLException {
        String sql = "SELECT " + COLUMNAS + " FROM censo WHERE dni = ?";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, dni);
            try (ResultSet resultado = sentencia.executeQuery()) {
                return resultado.next() ? Optional.of(mapear(resultado)) : Optional.empty();
            }
        }
    }

    @Override
    public List<Censo> listarTodo() throws SQLException {
        String sql = "SELECT " + COLUMNAS + " FROM censo";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql);
             ResultSet resultado = sentencia.executeQuery()) {
            return mapearLista(resultado);
        }
    }

    @Override
    public List<Censo> listarPorLocalidad(String idLocalidad) throws SQLException {
        String sql = "SELECT " + COLUMNAS + " FROM censo WHERE id_localidad = ?";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, idLocalidad);
            try (ResultSet resultado = sentencia.executeQuery()) {
                return mapearLista(resultado);
            }
        }
    }

    @Override
    public List<Censo> listarPorLocalidades(List<String> idsLocalidad) throws SQLException {
        if (idsLocalidad.isEmpty()) {
            return new ArrayList<>();
        }
        String parametros = String.join(",", java.util.Collections.nCopies(idsLocalidad.size(), "?"));
        String sql = "SELECT " + COLUMNAS + " FROM censo WHERE id_localidad IN (" + parametros + ")";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            for (int i = 0; i < idsLocalidad.size(); i++) {
                sentencia.setString(i + 1, idsLocalidad.get(i));
            }
            try (ResultSet resultado = sentencia.executeQuery()) {
                return mapearLista(resultado);
            }
        }
    }

    @Override
    public int contarCensadosEnLocalidad(String idLocalidad) throws SQLException {
        String sql = "SELECT COUNT(*) FROM censo WHERE id_localidad = ?";
        try (Connection conexion = fabricaConexiones.nuevaConexion();
             PreparedStatement sentencia = conexion.prepareStatement(sql)) {
            sentencia.setString(1, idLocalidad);
            try (ResultSet resultado = sentencia.executeQuery()) {
                return resultado.next() ? resultado.getInt(1) : 0;
            }
        }
    }

    private List<Censo> mapearLista(ResultSet resultado) throws SQLException {
        List<Censo> lista = new ArrayList<>();
        while (resultado.next()) {
            lista.add(mapear(resultado));
        }
        return lista;
    }

    private Censo mapear(ResultSet resultado) throws SQLException {
        return new Censo(
                resultado.getString("dni"),
                resultado.getString("nombre_completo"),
                resultado.getDate("fecha_nacimiento").toLocalDate(),
                resultado.getString("direccion"),
                resultado.getString("id_localidad"));
    }
}
