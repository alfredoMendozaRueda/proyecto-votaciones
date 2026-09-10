package com.amr.votaciones.web;

import com.amr.votaciones.excepciones.CandidatoYaRegistradoExcepcion;
import com.amr.votaciones.excepciones.DniNoEnCensoExcepcion;
import com.amr.votaciones.excepciones.ElementoNoEncontradoExcepcion;
import com.amr.votaciones.excepciones.EleccionYaExisteExcepcion;
import com.amr.votaciones.modelos.Candidato;
import com.amr.votaciones.servicios.CandidatoServicio;
import com.amr.votaciones.servicios.CensoServicio;
import com.amr.votaciones.servicios.EleccionServicio;
import com.amr.votaciones.servicios.PartidoServicio;
import java.time.LocalDate;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.servlet.mvc.support.RedirectAttributes;

/**
 * Panel de administracion: partidos, candidatos, elecciones y censo.
 *
 * <p>"/admin/partidos" tambien es accesible al rol ANALISTA (ver
 * {@code SecurityConfig}), igual que en el diseno original: el analista
 * puede dar de alta partidos desde la misma pantalla que el administrador.</p>
 */
@Controller
public class AdminController {

    private final PartidoServicio partidoServicio;
    private final CandidatoServicio candidatoServicio;
    private final EleccionServicio eleccionServicio;
    private final CensoServicio censoServicio;

    public AdminController(PartidoServicio partidoServicio, CandidatoServicio candidatoServicio,
                            EleccionServicio eleccionServicio, CensoServicio censoServicio) {
        this.partidoServicio = partidoServicio;
        this.candidatoServicio = candidatoServicio;
        this.eleccionServicio = eleccionServicio;
        this.censoServicio = censoServicio;
    }

    @GetMapping("/admin/panel")
    public String panel() {
        return "admin/panel";
    }

    @GetMapping("/admin/partidos")
    public String formularioPartidos() {
        return "admin/partidos";
    }

    @PostMapping("/admin/partidos")
    public String crearPartido(@RequestParam String siglas, @RequestParam String descripcion,
                                @RequestParam String imagen, RedirectAttributes redirectAttributes) {
        partidoServicio.crearPartido(siglas, descripcion, "/imagenes/" + imagen);
        redirectAttributes.addFlashAttribute("mensaje", "Partido registrado con éxito");
        return "redirect:/exito";
    }

    @GetMapping("/admin/candidatos")
    public String formularioCandidatos() {
        return "admin/candidatos";
    }

    @PostMapping("/admin/candidatos")
    public String crearCandidato(@RequestParam String dni, @RequestParam String nombreCompleto,
                                  @RequestParam String siglasPartido, @RequestParam int orden,
                                  RedirectAttributes redirectAttributes)
            throws DniNoEnCensoExcepcion, CandidatoYaRegistradoExcepcion {
        candidatoServicio.registrarCandidato(new Candidato(dni, nombreCompleto, siglasPartido, orden));
        redirectAttributes.addFlashAttribute("mensaje", "Candidato registrado con éxito");
        return "redirect:/exito";
    }

    @GetMapping("/admin/elecciones/nueva")
    public String formularioNuevaEleccion() {
        return "admin/eleccion-nueva";
    }

    @PostMapping("/admin/elecciones/nueva")
    public String crearEleccion(@RequestParam String idElecciones, @RequestParam String descripcion,
                                 @RequestParam @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate fechaFin,
                                 RedirectAttributes redirectAttributes)
            throws EleccionYaExisteExcepcion {
        eleccionServicio.crearEleccion(idElecciones, descripcion, fechaFin);
        redirectAttributes.addFlashAttribute("mensaje", "Elección registrada con éxito");
        return "redirect:/exito";
    }

    @GetMapping("/admin/elecciones/gestionar")
    public String formularioGestionarElecciones() {
        return "admin/eleccion-gestionar";
    }

    @PostMapping("/admin/elecciones/gestionar")
    public String gestionarEleccion(@RequestParam String accion, @RequestParam String idEleccion,
                                     RedirectAttributes redirectAttributes) {
        boolean exito;
        String mensajeExito;
        String mensajeFallo;
        switch (accion) {
            case "habilitar":
                exito = eleccionServicio.habilitar(idEleccion);
                mensajeExito = "Elección habilitada";
                mensajeFallo = "No se pudo habilitar";
                break;
            case "deshabilitar":
                exito = eleccionServicio.deshabilitar(idEleccion);
                mensajeExito = "Elección deshabilitada";
                mensajeFallo = "No se pudo deshabilitar";
                break;
            case "eliminar":
                exito = eleccionServicio.eliminar(idEleccion);
                mensajeExito = "Elección eliminada";
                mensajeFallo = "No se pudo eliminar";
                break;
            default:
                redirectAttributes.addFlashAttribute("mensaje", "Acción no reconocida");
                return "redirect:/error";
        }
        redirectAttributes.addFlashAttribute("mensaje", exito ? mensajeExito : mensajeFallo);
        return exito ? "redirect:/exito" : "redirect:/error";
    }

    @GetMapping("/admin/censo")
    public String selectorCenso(Model model) {
        model.addAttribute("localidades", censoServicio.localidades());
        model.addAttribute("comunidades", censoServicio.comunidades());
        return "admin/censo";
    }

    @GetMapping("/admin/censo/todo")
    public String censoTodo(Model model) {
        model.addAttribute("censo", censoServicio.censoCompleto());
        model.addAttribute("titulo", "Censo completo");
        return "admin/censo-resultado";
    }

    @GetMapping("/admin/censo/localidad")
    public String censoPorLocalidad(@RequestParam String nombre, Model model) throws ElementoNoEncontradoExcepcion {
        model.addAttribute("censo", censoServicio.censoPorLocalidad(nombre));
        model.addAttribute("titulo", "Censo en " + nombre);
        return "admin/censo-resultado";
    }

    @GetMapping("/admin/censo/comunidad")
    public String censoPorComunidad(@RequestParam String nombre, Model model) throws ElementoNoEncontradoExcepcion {
        model.addAttribute("censo", censoServicio.censoPorComunidad(nombre));
        model.addAttribute("titulo", "Censo en " + nombre);
        return "admin/censo-resultado";
    }
}
