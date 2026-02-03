/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
/*
 Clase para realizar todas las operaciones con la base de datos
 */
package dao;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.LocalDate;
import java.util.ArrayList;
import javax.servlet.http.HttpSession;
import modelos.Candidato;
import modelos.Censo;
import modelos.Eleccion;
import modelos.MenorDeEdadExcepcion;
import modelos.Participacion;
import modelos.Usuario;
import modelos.Partido;
import modelos.Voto;

//a partir de aqui esto se añade en todos los DAO
public class ConexionBBDD {

    private String url;
    private String usuario;
    private String contrasena;
    private Connection conexion;
    private Statement sentencia;
    private ResultSet resultado;
    private PreparedStatement sentenciaPreparada;

    public ConexionBBDD() throws ClassNotFoundException, SQLException {
        this.url = "jdbc:mysql://localhost:3306/bbdd_amr_elecciones?useUnicode=true&characterEncoding=UTF-8";
        this.usuario = "root";
        this.contrasena = "";

        //driver que une java con mysql
        Class.forName("com.mysql.cj.jdbc.Driver");
        //obtener la conexion
        this.conexion = DriverManager.getConnection(this.url, this.usuario, this.contrasena);
        //para hacer las sentencias
        this.sentencia = this.conexion.createStatement();
    }

    /**
     * ******************************************************************************************
     *
     *
     * MÉTODOS CENSO
     *
     * TABLA: censo ------------- dni (PK) VARCHAR(9) nombre_completo
     * VARCHAR(100) fecha_nacimiento DATE direccion VARCHAR(150) id_localidad
     * (FK) VARCHAR(10) → localidades(id_localidad)
     * *******************************************************************************************
     */
 
    public boolean existeEnCenso(String dni) throws SQLException {
        String orden = "SELECT dni FROM censo WHERE dni=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, dni);
        resultado = sentenciaPreparada.executeQuery();
        if (resultado.next()) {
            return true;
        } else {
            return false;
        }
    }
    
    
    
    public int numCensadosLoc(String id_localidad) throws SQLException{
        String orden = "SELECT count(*) FROM censo WHERE id_localidad=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, id_localidad);
        resultado = sentenciaPreparada.executeQuery();
        if (resultado.next()) {
            return resultado.getInt(1);
        } else {
            return 0;
        }
    }
    
    

    public ArrayList<Censo> getCenso() throws SQLException{
        ArrayList<Censo> lista = new ArrayList<>();
        String orden = "SELECT dni, nombre_completo, fecha_nacimiento, direccion, id_localidad FROM censo;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        resultado = sentenciaPreparada.executeQuery();

        while (resultado.next()) {
            String dni = resultado.getString("dni");
            String nombre_completo = resultado.getString("nombre_completo");
           
            LocalDate fecha_nacimiento = resultado.getDate("fecha_nacimiento").toLocalDate();
            String direccion = resultado.getString("direccion");
            String id_localidad = resultado.getString("id_localidad");
            Censo c = new Censo(dni, nombre_completo, fecha_nacimiento, direccion, id_localidad);
            lista.add(c);
        }

        return lista;
    }
    
    
    
    public ArrayList<Censo> getCensoLocalidades(String id_loc) throws SQLException{
        ArrayList<Censo> lista = new ArrayList<>();
        String orden = "SELECT dni, nombre_completo, fecha_nacimiento, direccion, id_localidad FROM censo WHERE id_localidad=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, id_loc);
        resultado = sentenciaPreparada.executeQuery();

        while (resultado.next()) {
            String dni = resultado.getString("dni");
            String nombre_completo = resultado.getString("nombre_completo");
           
            LocalDate fecha_nacimiento = resultado.getDate("fecha_nacimiento").toLocalDate();
            String direccion = resultado.getString("direccion");
            String id_localidad = resultado.getString("id_localidad");
            Censo c = new Censo(dni, nombre_completo, fecha_nacimiento, direccion, id_localidad);
            lista.add(c);
        }

        return lista;
    }
    public ArrayList<Censo> getCensoComunidades(ArrayList<String> Id_localidadesDeComunidades) throws SQLException{
        ArrayList<Censo> lista = new ArrayList<>();
        for (int i = 0; i < Id_localidadesDeComunidades.size(); i++) {
            
        
        String orden = "SELECT dni, nombre_completo, fecha_nacimiento, direccion, id_localidad FROM censo WHERE id_localidad=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, Id_localidadesDeComunidades.get(i));
        resultado = sentenciaPreparada.executeQuery();

        while (resultado.next()) {
            String dni = resultado.getString("dni");
            String nombre_completo = resultado.getString("nombre_completo");
            LocalDate fecha_nacimiento = resultado.getDate("fecha_nacimiento").toLocalDate();
            String direccion = resultado.getString("direccion");
            String id_localidad = resultado.getString("id_localidad");
            Censo c = new Censo(dni, nombre_completo, fecha_nacimiento, direccion, id_localidad);
            lista.add(c);
        }
        }
        return lista;
    }
    
    public ArrayList<String> dnisLocalidad(String id_localidad) throws SQLException{
        ArrayList<String> dnis= new ArrayList<>();
        String orden = "SELECT dni FROM censo WHERE id_localidad=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, id_localidad);
        resultado = sentenciaPreparada.executeQuery();
        while (resultado.next()) {
            String dni = resultado.getString("dni");
            dnis.add(dni);
        }
        return dnis;
    }
    
    public ArrayList<String> dniCandidatos(ArrayList<String> dnisLocalidad) throws SQLException{
        ArrayList<String> dnisCandidatos= new ArrayList<>();
        for (int i = 0; i < dnisLocalidad.size(); i++) {
            String orden = "SELECT dni FROM candidatos WHERE dni=?;";
            sentenciaPreparada = this.conexion.prepareStatement(orden);
            sentenciaPreparada.setString(1, dnisLocalidad.get(i));
            resultado = sentenciaPreparada.executeQuery();
            while (resultado.next()) {
            String dni = resultado.getString("dni");
            dnisCandidatos.add(dni);
            }
             
        }
        return dnisCandidatos;
    }
    
    
    public ArrayList<String> infoCandidatos(ArrayList<String> dnisCandidatos) throws SQLException{
        ArrayList<String> infoCandidatos= new ArrayList<>();
        
        for (int i = 0; i < dnisCandidatos.size(); i++) {
            String infoCompleta="";
            String orden = "SELECT siglas_partido, orden FROM candidatos WHERE dni=?;";
            sentenciaPreparada = this.conexion.prepareStatement(orden);
            sentenciaPreparada.setString(1, dnisCandidatos.get(i));
            resultado = sentenciaPreparada.executeQuery();
            while (resultado.next()) {
             infoCompleta = "Representa a: "+resultado.getString("siglas_partido")+" tiene orden: "+resultado.getString("orden")+" ";
            }
            orden = "SELECT dni, nombre_completo, fecha_nacimiento, direccion FROM censo WHERE dni=?;";
            sentenciaPreparada = this.conexion.prepareStatement(orden);
            sentenciaPreparada.setString(1, dnisCandidatos.get(i));
            resultado = sentenciaPreparada.executeQuery();
            while (resultado.next()) {
             infoCompleta += "tiene dni: "+resultado.getString("dni")+" se llama: "+resultado.getString("nombre_completo");
            
            }
            infoCandidatos.add(infoCompleta);
        }
        return infoCandidatos;
    }
    
    public ArrayList<String> getId_localidadesDeComunidades(String id_comunidad) throws SQLException{
        ArrayList<String> lista = new ArrayList<>();
        String orden = "SELECT id_localidad FROM localidades WHERE id_comunidad=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, id_comunidad);
        resultado = sentenciaPreparada.executeQuery();
        while(resultado.next()){
            lista.add(resultado.getString("id_localidad"));
        }
        return lista;
    }
    
    public String getId_loc(String nombre_localidad) throws SQLException{
        String orden = "SELECT id_localidad FROM localidades WHERE nombre_localidad=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, nombre_localidad);
        resultado = sentenciaPreparada.executeQuery();
        if (resultado.next()) {
            return resultado.getString("id_localidad");
        }else return "";
    }
    
    
    public ArrayList<String> getIds_loc(ArrayList<String> nombre_localidad) throws SQLException{
        ArrayList<String> idsLoc= new ArrayList<>();
        for (int i = 0; i < nombre_localidad.size(); i++) {
            
        
        String orden = "SELECT id_localidad FROM localidades WHERE nombre_localidad=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, nombre_localidad.get(i));
        resultado = sentenciaPreparada.executeQuery();
        while (resultado.next()) {
            idsLoc.add( resultado.getString("id_localidad"));
        
        }
    }
        return idsLoc;
    }
    
    
    public String getId_com(String nombre_comunidad) throws SQLException{
        String orden = "SELECT id_comunidad FROM comunidades WHERE nombre_comunidad=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, nombre_comunidad);
        resultado = sentenciaPreparada.executeQuery();
        if (resultado.next()) {
            return resultado.getString("id_comunidad");
        }else return "";
    }
    
    
    /**
     * ******************************************************************************************
     *
     *
     * MÉTODOS USUARIOS
     *
     * TABLA: usuarios ---------------- dni (PK) VARCHAR(9) password
     * VARCHAR(255) rol VARCHAR(50) votado BOOLEAN
     * *******************************************************************************************
     */
    public boolean isMenor(String dni) throws SQLException {
        String orden = "SELECT fecha_nacimiento FROM censo WHERE dni=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, dni);
        resultado = sentenciaPreparada.executeQuery();
        if (resultado.next() && resultado.getDate("fecha_nacimiento").toLocalDate().isAfter(LocalDate.of(2007, 10, 30))) {
            return true;
        } else {
            return false;
        }
    }

    public int registrarUsuario(String dni, String contrasena) throws SQLException, MenorDeEdadExcepcion {

        if (this.isMenor(dni)) {
            throw new MenorDeEdadExcepcion("El usuario es menor de edad.");
        } else {
            String orden = "INSERT INTO usuarios (dni, password, rol, votado) VALUES(?, ?, 'votante', FALSE);";
            sentenciaPreparada = this.conexion.prepareStatement(orden);
            sentenciaPreparada.setString(1, dni);
            sentenciaPreparada.setString(2, contrasena);
            int filas = sentenciaPreparada.executeUpdate();
            return filas;
        }

    }

  
    public boolean comprobarContrasena(String dni, String contrasena) throws SQLException {
        String orden = "SELECT password FROM usuarios WHERE dni=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, dni);
        resultado = sentenciaPreparada.executeQuery();

        if (resultado.next()) {
            String passwordBD = resultado.getString("password");
            String hashEntrada = cifrarMD5(contrasena);
            return passwordBD.equals(hashEntrada);
        } else {
            return false; 
        }
    }

    public boolean existeUsuario(String dni) throws SQLException {
        String orden = "SELECT dni FROM usuarios WHERE dni=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, dni);
        resultado = sentenciaPreparada.executeQuery();
        if (resultado.next()) {
            return true;
        } else {
            return false;
        }
    }

    public boolean isAdmin(String dni) throws SQLException {
        String orden = "SELECT rol FROM usuarios WHERE dni=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, dni);
        resultado = sentenciaPreparada.executeQuery();
        if (resultado.next()) {
            return resultado.getString("rol").equals("admin");
        } else {
            return false;
        }
    }
    
    
    public boolean isAnalista(String dni) throws SQLException {
        String orden = "SELECT rol FROM usuarios WHERE dni=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, dni);
        resultado = sentenciaPreparada.executeQuery();
        if (resultado.next()) {
            return resultado.getString("rol").equals("analista");
        } else {
            return false;
        }
    }

    public String cifrarMD5(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("MD5");
            byte[] messageDigest = md.digest(input.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder();
            for (byte b : messageDigest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new RuntimeException(e);
        }
    }

    public void reiniciarVotaciones() throws SQLException {
        String orden = "UPDATE usuarios SET votado = 0;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.executeUpdate();

    }

    public void borrarTodasLasVotaciones() throws SQLException {
        String orden = "DELETE FROM votos;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.executeUpdate();
    }

    public String getNombreCenso(String dni) throws SQLException {
        String orden = "SELECT nombre_completo FROM censo WHERE dni=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, dni);
        resultado = sentenciaPreparada.executeQuery();
        if (resultado.next()) {
            return resultado.getString("nombre_completo");
        } else {
            return "";
        }

    }

    /**
     * ******************************************************************************************
     *
     *
     * MÉTODOS PARTIDOS
     *
     * TABLA: partidos ---------------- siglas (PK) VARCHAR(10) descripcion
     * VARCHAR(100) imagen VARCHAR(255)
     *
     * *******************************************************************************************
     */
    public int registrarPartido(Partido p) throws SQLException {
        String orden = "INSERT INTO partidos (siglas, descripcion, imagen) VALUES(?, ?, ?);";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, p.getSiglas());
        sentenciaPreparada.setString(2, p.getDescripcion());
        sentenciaPreparada.setString(3, p.getImagen());
        int filas = sentenciaPreparada.executeUpdate();
        return filas;
    }

    public int numPartidos() throws SQLException {
        String orden = "SELECT COUNT(*) FROM partidos;";//para contar a ver cuantos registros tiene la tabla partidos
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        resultado = sentenciaPreparada.executeQuery();

        if (resultado.next()) {
            return resultado.getInt(1); //para que devuelva un entero con el count
        } else {
            return 0;
        }
    }

    public String partidoGanador() throws SQLException {
        ArrayList<String> siglas = this.getNomPartidos();
        String ganador = "";
        int maxVotos = 0;
        for (int i = 0; i < siglas.size(); i++) {
            String sigla = siglas.get(i);

            String orden = "SELECT COUNT(*) FROM votos WHERE siglas_partido = ?";
            sentenciaPreparada = this.conexion.prepareStatement(orden);
            sentenciaPreparada.setString(1, sigla);
            resultado = sentenciaPreparada.executeQuery();

            if (resultado.next()) {
                int votos = resultado.getInt(1);
                if (votos > maxVotos) {//si el partido que hay tiene mas votos que el maximo, cambia el ganador
                    maxVotos = votos;
                    ganador = sigla;
                }
            }
        }

        if (ganador.equals("")) {
            return "No hay votos registrados";
        }
        return ganador;
    }

    public String presi(String partido) throws SQLException {
        String orden = "SELECT nombre_candidato FROM candidatos WHERE siglas_partido=? AND orden=1;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, partido);
        resultado = sentenciaPreparada.executeQuery();
        if (resultado.next()) {
            return resultado.getString("nombre_candidato");
        }
        return "";
    }

    
    public ArrayList<String> getNomPartidos() throws SQLException {
        ArrayList<String> misPartidos = new ArrayList<>();
        String orden = "SELECT siglas FROM partidos;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        resultado = sentenciaPreparada.executeQuery();
        while (resultado.next()) {
            misPartidos.add(resultado.getString("siglas"));
        }
        return misPartidos;
    }

    public ArrayList<Partido> getListaPartidos() throws SQLException {
        ArrayList<Partido> lista = new ArrayList<>();
        String orden = "SELECT siglas, descripcion, imagen FROM partidos;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        resultado = sentenciaPreparada.executeQuery();

        while (resultado.next()) {
            String siglas = resultado.getString("siglas");
            String descripcion = resultado.getString("descripcion");
            String imagen = resultado.getString("imagen");

            Partido p = new Partido(siglas, descripcion, imagen);
            lista.add(p);
        }

        return lista;
    }

    /**
     * ******************************************************************************************
     *
     *
     * MÉTODOS CANDIDATOS
     *
     * TABLA: candidatos ------------------ dni (PK) VARCHAR(9) nombre_candidato
     * VARCHAR(100) siglas_partido (FK)VARCHAR(10) → partidos(siglas) orden INT
     *
     *
     * *******************************************************************************************
     */
    public int registrarCandidato(Candidato c) throws SQLException {
        String orden = "INSERT INTO candidatos (dni, nombre_candidato, siglas_partido, orden) VALUES(?, ?, ?, ?);";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, c.getDni());
        sentenciaPreparada.setString(2, c.getNombre_completo());
        sentenciaPreparada.setString(3, c.getSiglas_partido());
        sentenciaPreparada.setInt(4, c.getOrden());
        int filas = sentenciaPreparada.executeUpdate();
        return filas;
    }

    public boolean existeCandidato(String dni) throws SQLException {
        String orden = "SELECT dni FROM candidatos WHERE dni=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, dni);
        resultado = sentenciaPreparada.executeQuery();
        if (resultado.next()) {
            return true;
        } else {
            return false;
        }

    }

    /**
     * ******************************************************************************************
     *
     *
     * MÉTODOS ELECCIONES
     *
     * TABLA: elecciones ------------------ id_elecciones (PK) VARCHAR(10)
     * descripcion VARCHAR(255) fecha_inicio DATE fecha_fin DATE estado
     * VARCHAR(20)
     *
     *
     * *******************************************************************************************
     */
    public int registrarEleccion(Eleccion e) throws SQLException {
        String orden = "INSERT INTO elecciones (id_elecciones, descripcion, fecha_inicio, fecha_fin, estado) VALUES(?, ?, ?, ?, ?);";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, e.getId_elecciones());
        sentenciaPreparada.setString(2, e.getDescripcion());
        sentenciaPreparada.setString(3, ((e.getFecha_inicio()).toString()));
        sentenciaPreparada.setString(4, ((e.getFecha_fin()).toString()));
        sentenciaPreparada.setString(5, e.getEstado());
        int filas = sentenciaPreparada.executeUpdate();
        return filas;
    }

    public boolean existeEleccion() throws SQLException {
        String orden = "SELECT COUNT(*) FROM elecciones;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        resultado = sentenciaPreparada.executeQuery();

        if (resultado.next()) {
            return resultado.getInt(1) > 0;
        }

        return false;
    }

    public String getIdEleccion() throws SQLException {
        String orden = "SELECT id_elecciones FROM elecciones;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        resultado = sentenciaPreparada.executeQuery();

        if (resultado.next()) {
            return resultado.getString("id_elecciones");
        } else {
            return null;
        }
    }

    public boolean borrarEleccion(String id_elecciones) throws SQLException {
        String orden = "DELETE FROM elecciones WHERE id_elecciones = ?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, id_elecciones);
        int filas = sentenciaPreparada.executeUpdate();

        return filas > 0;
    }

    public int habilitarEleccion(String id_elecciones) throws SQLException {
        String orden = "UPDATE elecciones SET estado = 'habilitada' WHERE id_elecciones = ?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, id_elecciones);
        int filas = sentenciaPreparada.executeUpdate();
        return filas;
    }

    public int deshabilitarEleccion(String id_elecciones) throws SQLException {
        String orden = "UPDATE elecciones SET estado = 'inhabilitada' WHERE id_elecciones = ?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, id_elecciones);
        int filas = sentenciaPreparada.executeUpdate();
        return filas;
    }

    public String getEstadoEleccion(String id_elecciones) throws SQLException {
        String orden = "SELECT estado FROM elecciones WHERE id_elecciones=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, id_elecciones);
        resultado = sentenciaPreparada.executeQuery();

        if (resultado.next()) {
            return resultado.getString("estado");
        } else {
            return "";
        }
    }

    /**
     * ******************************************************************************************
     *
     *
     * MÉTODOS VOTOS
     *
     * TABLA: votos ------------- id_voto (PK) VARCHAR(15) (es automatica)
     * id_localidad (FK) VARCHAR(10) → localidades(id_localidad) siglas_partido
     * (FK)VARCHAR(10) → partidos(siglas)
     *
     *
     *
     * *******************************************************************************************
     */
    public String getLocalidad(String dni) throws SQLException {
        String orden = "SELECT id_localidad FROM censo WHERE dni=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, dni);
        resultado = sentenciaPreparada.executeQuery();

        if (resultado.next()) {
            return resultado.getString("id_localidad");
        } else {
            return "";
        }
    }

    public boolean isVotado(String dni) throws SQLException {
        String orden = "SELECT votado FROM usuarios WHERE dni=?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, dni);
        resultado = sentenciaPreparada.executeQuery();
        if (resultado.next() && resultado.getInt("votado") == 1) {
            return true;
        } else {
            return false;
        }
    }

    public int yaHaVotado(String dni) throws SQLException {
        String orden = "UPDATE usuarios SET votado = 1 WHERE dni = ?;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, dni);
        int filas = sentenciaPreparada.executeUpdate();
        return filas;
    }

    public int registrarVoto(Voto v) throws SQLException {
        String orden = "INSERT INTO votos (id_localidad, siglas_partido) VALUES(?, ?);";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, v.getId_localidad());
        sentenciaPreparada.setString(2, v.getSiglas_partido());

        int filas = sentenciaPreparada.executeUpdate();
        return filas;
    }
    
    
    public ArrayList<Voto> getVotos() throws SQLException{
        ArrayList<Voto> lista = new ArrayList<>();
        String orden = "SELECT id_voto, id_localidad, siglas_partido FROM votos;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        resultado = sentenciaPreparada.executeQuery();

        while (resultado.next()) {
            String id_localidad=resultado.getString("id_localidad");
            String siglas_partido=resultado.getString("siglas_partido");
            String id_voto=resultado.getString("id_voto");
            Voto c = new Voto(id_voto, id_localidad, siglas_partido);
            lista.add(c);
        }

        return lista;
    }

    
    
    public int cantidadVotoSegunLocalidad(String siglas,String localidad) throws SQLException{
        
        String orden="SELECT count(*) FROM votos WHERE siglas_partido=? AND id_localidad=?;";
        sentenciaPreparada=this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, siglas);
        sentenciaPreparada.setString(2, localidad);
        resultado=sentenciaPreparada.executeQuery();
        if (resultado.next()) {
            return resultado.getInt(1);
        }
        return 0;
    }
    public int cantidadVotoSegunComunidad(String siglas,String comunidad) throws SQLException{
        ArrayList<String>id_localidades=this.getId_localidadesDeComunidades(comunidad);
        int total=0;
        for (int i = 0; i < id_localidades.size(); i++) {
        String orden="SELECT count(*) FROM votos WHERE siglas_partido=? AND id_localidad=?;";    
        sentenciaPreparada=this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, siglas);
        sentenciaPreparada.setString(2, id_localidades.get(i));
        resultado=sentenciaPreparada.executeQuery();
            if (resultado.next()) {
                total+=resultado.getInt(1);
            }
        
        }
        return total;
    }
    public int cantidadVoto(String siglas) throws SQLException{
        String orden="SELECT count(*) FROM votos WHERE siglas_partido=?;";
        sentenciaPreparada=this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, siglas);
        resultado=sentenciaPreparada.executeQuery();
        if (resultado.next()) {
            return resultado.getInt(1);
        }
        return 0;
    }
    
    public int numVotos() throws SQLException{
        String orden="SELECT count(*) FROM votos;";
        sentenciaPreparada=this.conexion.prepareStatement(orden);
        resultado=sentenciaPreparada.executeQuery();
        if (resultado.next()) {
            return resultado.getInt(1);
        }
        return 0;
    }
    
     public int votosPorLoc(String id_localidad) throws SQLException{
        String orden= "SELECT COUNT(*) FROM votos WHERE id_localidad=?;";
        sentenciaPreparada=this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, id_localidad);
        resultado=sentenciaPreparada.executeQuery();
        if (resultado.next()) {
            return resultado.getInt(1);
        }
        return 0;
    }
    
    public int registrarParticipacion(Participacion p) throws SQLException {
        
        String orden = "INSERT INTO participacion (id_localidad, numero_censados, total_votos) VALUES(?, ?, ?);";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.setString(1, p.getId_localidad());
        sentenciaPreparada.setInt(2, p.getNumero_censados());
        sentenciaPreparada.setInt(3, p.getTotal_votos());
        int filas = sentenciaPreparada.executeUpdate();
        return filas;
    }
    
    public void borrarTodasLasParticipaciones() throws SQLException {
        String orden = "DELETE FROM participacion;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        sentenciaPreparada.executeUpdate();
    }
    
    
    
    
    public float porcentajes(String nombre_localidad) throws SQLException{
        String id_localidad=this.getId_loc(nombre_localidad);
        ArrayList<String> localidades=this.getIds_loc(this.getLocalidades());
        
        int total=0;
        for (int i = 0; i < localidades.size(); i++) {
          total=this.votosPorLoc(localidades.get(i));
        }
        int totalLoc=this.votosPorLoc(id_localidad);
        return ((totalLoc*100)/total)/2;
        
    }
    
     
    /**
     * ****************************************************************************
     *
     * METODOS PARA LOCALIDADES 
     * TABLA: localidades -------------------
     * id_localidad (PK) VARCHAR(10) 
     * nombre_localidad VARCHAR(100) 
     * id_comunidad <---(FK) VARCHAR(10) → comunidades(id_comunidad)
     *
     ******************************************************************************
     */
    public ArrayList<String> getLocalidades() throws SQLException {
        ArrayList<String> localidades = new ArrayList<>();
        String orden = "SELECT nombre_localidad FROM localidades;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        resultado = sentenciaPreparada.executeQuery();

        while (resultado.next()) {
            localidades.add(resultado.getString("nombre_localidad"));
        }

        return localidades;
    }

    public ArrayList<String> getComunidades() throws SQLException {
        ArrayList<String> comunidades = new ArrayList<>();
        String orden = "SELECT nombre_comunidad FROM comunidades;";
        sentenciaPreparada = this.conexion.prepareStatement(orden);
        resultado = sentenciaPreparada.executeQuery();

        while (resultado.next()) {
            comunidades.add(resultado.getString("nombre_comunidad"));
        }

        return comunidades;
    }

    
    
    public void cerrarConexion() throws SQLException {
        this.sentencia.close();
        this.conexion.close();
    }

}
