/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/Servlet.java to edit this template
 */
package controladoresAnalista;

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
public class servletGestionAnalista extends HttpServlet {

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
        miSesion.setAttribute("isValido",false);
        accion=request.getParameter("accion");
        if (accion.equals("Comprobar partidos")) {
            miSesion.setAttribute("isValido",true);
            response.sendRedirect("vistas/analista/comprobarPartidos.jsp");
        }else if (accion.equals("Dar de alta un nuevo partido")) {
            miSesion.setAttribute("isValido",true);
            miSesion.setAttribute("isAnalista",true);
            response.sendRedirect("vistas/admin/gestionPartidos.jsp");
        }else if (accion.equals("Ver candidatos por localidad")) {
            miSesion.setAttribute("isValido",true);
            response.sendRedirect("vistas/analista/verCandidatosLocalidad.jsp");
        }else if (accion.equals("Obtener participacion")) {
            miSesion.setAttribute("isValido",true);
            response.sendRedirect("vistas/analista/obtenerParticipacion.jsp");
        }else if (accion.equals("Ver porcentaje de participacion")) {
            miSesion.setAttribute("isValido",true);
            response.sendRedirect("vistas/analista/porcentajes.jsp");
        }else if (accion.equals("Crear cookie")) {
            miSesion.setAttribute("isValido",true);
            response.sendRedirect("vistas/analista/crearCookie.jsp");
        }else if (accion.equals("Ver cookie")) {
            miSesion.setAttribute("isValido",true);
            response.sendRedirect("vistas/analista/verCookie.jsp");
        }
        response.setCharacterEncoding("UTF-8");
        request.setCharacterEncoding("UTF-8");
        response.setContentType("text/html;charset=UTF-8");
        try (PrintWriter out = response.getWriter()) {
            /* TODO output your page here. You may use following sample code. 
            out.println("<!DOCTYPE html>");
            out.println("<html>");
            out.println("<head>");
            out.println("<title>Servlet servletGestionAnalista</title>");
            out.println("</head>");
            out.println("<body>");
            out.println("<h1>Servlet servletGestionAnalista at " + request.getContextPath() + "</h1>");
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
