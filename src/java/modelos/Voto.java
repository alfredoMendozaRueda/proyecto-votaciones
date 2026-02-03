/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/Classes/Class.java to edit this template
 */
package modelos;

/**
 *
 * @author ferre
 */
public class Voto {
    //	id_voto	id_localidad	siglas_partido	
    public String id_voto;
    public String id_localidad;
    public String siglas_partido;

    public String getId_voto() {
        return id_voto;
    }

    public void setId_voto(String id_voto) {
        this.id_voto = id_voto;
    }

    public String getId_localidad() {
        return id_localidad;
    }

    public void setId_localidad(String id_localidad) {
        this.id_localidad = id_localidad;
    }

    public String getSiglas_partido() {
        return siglas_partido;
    }

    public void setSiglas_partido(String siglas_partido) {
        this.siglas_partido = siglas_partido;
    }

    public Voto(String id_localidad, String siglas_partido) {
        
        this.id_localidad = id_localidad;
        this.siglas_partido = siglas_partido;
    }

    public Voto(String id_voto, String id_localidad, String siglas_partido) {
        this.id_voto = id_voto;
        this.id_localidad = id_localidad;
        this.siglas_partido = siglas_partido;
    }
    
    
    
}
