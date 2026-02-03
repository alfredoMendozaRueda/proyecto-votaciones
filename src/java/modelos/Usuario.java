/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package modelos;

/**
 *
 * @author ferre
 */
public class Usuario {
    private String dni;
    private String contrasena;
    private String rol;
    private boolean votado;
    public Usuario(String dni, String contrasena){
        this.rol="votante";
        this.votado=false;
    }
}
