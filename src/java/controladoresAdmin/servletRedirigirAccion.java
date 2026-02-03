/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/Servlet.java to edit this template
 */
package controladoresAdmin;

import java.io.IOException;
import java.io.PrintWriter;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;

/**
 *
 * @author ferre
 */
public class servletRedirigirAccion extends HttpServlet {

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
        HttpSession miSesion= request.getSession(true);
        String accion="";
        accion=request.getParameter("accion");
        miSesion.setAttribute("isValido",false);
        if (accion.equals("Gestion de partidos")) {
            miSesion.setAttribute("isValido",true);
            response.sendRedirect("vistas/admin/gestionPartidos.jsp");
        }else if (accion.equals("Gestion de candidatos")) {
            miSesion.setAttribute("isValido",true);
            response.sendRedirect("vistas/admin/gestionCandidatos.jsp");
        }else if (accion.equals("Anadir elecciones")) {
            miSesion.setAttribute("isValido",true);
            response.sendRedirect("vistas/admin/aniadirElecciones.jsp");
        }else if (accion.equals("Habilitar, deshabilitar o eliminar elecciones")) {
            miSesion.setAttribute("isValido",true);
            response.sendRedirect("vistas/admin/habilitarElecciones.jsp");
        }else if (accion.equals("Ver resultado de las elecciones")) {
            miSesion.setAttribute("isValido",true);
            response.sendRedirect("vistas/admin/verElecciones.jsp");
        }else if (accion.equals("Ver presidente ganador")) {
            miSesion.setAttribute("isValido",true);
            response.sendRedirect("vistas/admin/verGanadorElecciones.jsp");
        }else if (accion.equals("Votar")) {
            miSesion.setAttribute("isValido",true);
            response.sendRedirect("vistas/admin/votacion.jsp");
        }else if (accion.equals("Salir de la aplicacion")) {
            miSesion.setAttribute("isValido",true);
            response.sendRedirect("salida.jsp");
        }else if (accion.equals("Ver censo")) {
            miSesion.setAttribute("isValido",true);
            response.sendRedirect("vistas/admin/verCenso.jsp");
        }else{
            miSesion.setAttribute("mensajeError", "Intruso");
            response.sendRedirect("mensajesError.jsp");
        }
        
        
        
        request.setCharacterEncoding("UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setContentType("text/html;charset=UTF-8");
        try (PrintWriter out = response.getWriter()) {
            /* TODO output your page here. You may use following sample code. 
            out.println("<!DOCTYPE html>");
            out.println("<html>");
            out.println("<head>");
            out.println("<title>Servlet servletRedirigirAccion</title>");
            out.println("</head>");
            out.println("<body>");
            out.println("<h1>Servlet servletRedirigirAccion at " + request.getContextPath() + "</h1>");
            out.println("</body>");
            out.println("</html>");*/
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
