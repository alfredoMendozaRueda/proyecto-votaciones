/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package modelos;

import java.time.LocalDate;

/**
 *
 * @author ferre
 */
public class Eleccion {
    //id_elecciones	descripcion	fecha_inicio	fecha_fin	estado
    private String id_elecciones;
    private String descripcion;
    private LocalDate fecha_inicio;
    private LocalDate fecha_fin;
    private String estado;

    public Eleccion(String id_elecciones, String descripcion,LocalDate fecha_fin) {
        this.id_elecciones = id_elecciones;
        this.descripcion = descripcion;
        this.fecha_inicio = LocalDate.now();
        this.estado="inhabilitada";
        this.fecha_fin=fecha_fin;
    }
    
   

    public String getId_elecciones() {
        return id_elecciones;
    }

    public void setId_elecciones(String id_elecciones) {
        this.id_elecciones = id_elecciones;
    }

    public String getDescripcion() {
        return descripcion;
    }

    public void setDescripcion(String descripcion) {
        this.descripcion = descripcion;
    }

    public LocalDate getFecha_inicio() {
        return fecha_inicio;
    }

    public void setFecha_inicio(LocalDate fecha_inicio) {
        this.fecha_inicio = fecha_inicio;
    }

    public LocalDate getFecha_fin() {
        return fecha_fin;
    }

    public void setFecha_fin(LocalDate fecha_fin) {
        this.fecha_fin = fecha_fin;
    }

    public String getEstado() {
        return estado;
    }

    public void setEstado(String estado) {
        this.estado = estado;
    }
    
    
    
}
