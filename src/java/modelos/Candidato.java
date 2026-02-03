/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package modelos;

/**
 *
 * @author ferre
 */
public class Candidato {
    //dni	nombre_candidato	siglas_partido	orden
    private String dni;
    private String nombre_completo;
    private String siglas_partido;
    private int orden;

    public Candidato(String dni, String nombre_completo, String siglas_partido, int orden) {
        this.dni = dni;
        this.nombre_completo = nombre_completo;
        this.siglas_partido = siglas_partido;
        this.orden = orden;
    }

    public String getDni() {
        return dni;
    }

    public void setDni(String dni) {
        this.dni = dni;
    }

    public String getNombre_completo() {
        return nombre_completo;
    }

    public void setNombre_completo(String nombre_completo) {
        this.nombre_completo = nombre_completo;
    }

    public String getSiglas_partido() {
        return siglas_partido;
    }

    public void setSiglas_partido(String siglas_partido) {
        this.siglas_partido = siglas_partido;
    }

    public int getOrden() {
        return orden;
    }

    public void setOrden(int orden) {
        this.orden = orden;
    }
    
}
