/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/Servlet.java to edit this template
 */
package controladoresAdmin;

import dao.ConexionBBDD;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.SQLException;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

/**
 *
 * @author ferre
 */
public class servletHabilitacionElecciones extends HttpServlet {

    /**
     * Processes requests for both HTTP <code>GET</code> and <code>POST</code>
     * methods.
     *
     * @param request servlet request
     * @param response servlet response
     * @throws ServletException if a servlet-specific error occurs
     * @throws IOException if an I/O error occurs
     */
    protected void processRequest(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        response.setContentType("text/html;charset=UTF-8");
        response.setCharacterEncoding("UTF-8");
        request.setCharacterEncoding("UTF-8");
        HttpSession miSesion = request.getSession(true);
        try {

            ConexionBBDD bbdd = new ConexionBBDD();
            String accion = request.getParameter("accion");
            String id_eleccion = request.getParameter("id_eleccion");
            if (accion.equalsIgnoreCase("habilitar")) {
                int filas = bbdd.habilitarEleccion(id_eleccion);
                if (filas == 1) {
                    miSesion.setAttribute("mensajeBueno", "Eleccion habilitada");
                    response.sendRedirect("mensajesBueno.jsp");
                } else {
                    miSesion.setAttribute("mensajeError", "No se pudo habilitar");
                    response.sendRedirect("mensajesError.jsp");
                }
            } else if (accion.equalsIgnoreCase("deshabilitar")) {
                int filas = bbdd.deshabilitarEleccion(id_eleccion);
                if (filas == 1) {
                    miSesion.setAttribute("mensajeBueno", "Eleccion deshabilitada");
                    response.sendRedirect("mensajesBueno.jsp");
                } else {
                    miSesion.setAttribute("mensajeError", "No se pudo deshabilitar");
                    response.sendRedirect("mensajesError.jsp");
                }

            } else if (accion.equalsIgnoreCase("eliminar")) {
                if (bbdd.borrarEleccion(id_eleccion)) {
                    bbdd.reiniciarVotaciones();
                    bbdd.borrarTodasLasVotaciones();
                    miSesion.setAttribute("mensajeBueno", "Eleccion eliminada");
                    response.sendRedirect("mensajesBueno.jsp");
                    
                } else {
                    miSesion.setAttribute("mensajeError", "No se pudo eliminar");
                    response.sendRedirect("mensajesError.jsp");
                }

            }
        } catch (ClassNotFoundException e1) {
            miSesion.setAttribute("mensajeError", e1.getMessage());
            response.sendRedirect("mensajesError.jsp");
        } catch (SQLException e2) {
            miSesion.setAttribute("mensajeError", e2.getMessage());
            response.sendRedirect("mensajesError.jsp");
        }
        try (PrintWriter out = response.getWriter()) {
            /* TODO output your page here. You may use following sample code.
            out.println("<!DOCTYPE html>");
            out.println("<html>");
            out.println("<head>");
            out.println("<title>Servlet servletHabilitacionElecciones</title>");
            out.println("</head>");
            out.println("<body>");
            out.println("<h1>Servlet servletHabilitacionElecciones at " + request.getContextPath() + "</h1>");
            out.println("</body>");
            out.println("</html>"); */
        }
    }

    // <editor-fold defaultstate="collapsed" desc="HttpServlet methods. Click on the + sign on the left to edit the code.">
    /**
     * Handles the HTTP <code>GET</code> method.
     *
     * @param request servlet request
     * @param response servlet response
     * @throws ServletException if a servlet-specific error occurs
     * @throws IOException if an I/O error occurs
     */
    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        processRequest(request, response);
    }

    /**
     * Handles the HTTP <code>POST</code> method.
     *
     * @param request servlet request
     * @param response servlet response
     * @throws ServletException if a servlet-specific error occurs
     * @throws IOException if an I/O error occurs
     */
    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response)
            throws ServletException, IOException {
        processRequest(request, response);
    }

    /**
     * Returns a short description of the servlet.
     *
     * @return a String containing servlet description
     */
    @Override
    public String getServletInfo() {
        return "Short description";
    }// </editor-fold>

}
