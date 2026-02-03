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
public class Censo {
   private String dni;
   private String nombre_completo;
   private LocalDate fecha_nacimiento;
   private String direccion;
   private String id_loc;

    

    public Censo(String dni, String nombre_completo, LocalDate fecha_nacimiento, String direccion, String id_loc) {
        this.dni = dni;
        this.nombre_completo = nombre_completo;
        this.fecha_nacimiento = fecha_nacimiento;
        this.direccion = direccion;
        this.id_loc = id_loc;
    }

    public LocalDate getFecha_nacimiento() {
        return fecha_nacimiento;
    }

    public void setFecha_nacimiento(LocalDate fecha_nacimiento) {
        this.fecha_nacimiento = fecha_nacimiento;
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

    public String getDireccion() {
        return direccion;
    }

    public void setDireccion(String direccion) {
        this.direccion = direccion;
    }

    public String getId_loc() {
        return id_loc;
    }

    public void setId_loc(String id_loc) {
        this.id_loc = id_loc;
    }
   
}
