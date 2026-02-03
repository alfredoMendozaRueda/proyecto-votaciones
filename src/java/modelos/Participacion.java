/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package modelos;

/**
 *
 * @author ferre
 */
public class Participacion {
    private String id_localidad;
    private int numero_censados;
    private int total_votos;

    public Participacion(String id_localidad, int numero_censados, int total_votos) {
        this.id_localidad = id_localidad;
        this.numero_censados = numero_censados;
        this.total_votos = total_votos;
    }

    public String getId_localidad() {
        return id_localidad;
    }

    public void setId_localidad(String id_localidad) {
        this.id_localidad = id_localidad;
    }

    public int getNumero_censados() {
        return numero_censados;
    }

    public void setNumero_censados(int numero_censados) {
        this.numero_censados = numero_censados;
    }

    public int getTotal_votos() {
        return total_votos;
    }

    public void setTotal_votos(int total_votos) {
        this.total_votos = total_votos;
    }
    
}
