/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/Servlet.java to edit this template
 */
package controladoresUsuario;

import dao.ConexionBBDD;
import java.io.IOException;
import java.io.PrintWriter;
import java.sql.SQLException;
import javax.servlet.ServletException;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;
import modelos.MenorDeEdadExcepcion;

/**
 *
 * @author ferre
 */
public class servletRegistrarUsuario extends HttpServlet {

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
        request.setCharacterEncoding("UTF-8");
        response.setCharacterEncoding("UTF-8");
        response.setContentType("text/html;charset=UTF-8");

        HttpSession miSesion = request.getSession(true);
        String dni;
        String contrasena;
        
        try {
            ConexionBBDD bbdd = new ConexionBBDD();
            dni = request.getParameter("dni");
            contrasena = bbdd.cifrarMD5(request.getParameter("contrasena"));
            if (bbdd.existeUsuario(dni)) {
                miSesion.setAttribute("mensajeError", "Usuario ya existente, inicie sesión");
                response.sendRedirect("mensajesError.jsp");
            } else {
                if(bbdd.existeEnCenso(dni)){
                int filas = bbdd.registrarUsuario(dni, contrasena);
                if (filas != 1) {
                    miSesion.setAttribute("mensajeError", "No se ha podido registrar el usuario");
                    miSesion.setAttribute("volver", "index");
                    response.sendRedirect("mensajesError.jsp");
                } else {
                    miSesion.setAttribute("mensajeBueno", "Usuario registado con exito");
                    response.sendRedirect("mensajesBueno.jsp");
                }
            }else{
                miSesion.setAttribute("mensajeError", "No se ha podido registrar el usuario, no esta en el censo");
                miSesion.setAttribute("volver", "index");
                    response.sendRedirect("mensajesError.jsp");
                }
            }
            bbdd.cerrarConexion();
        } catch (ClassNotFoundException e1) {
            miSesion.setAttribute("mensajeError", e1.getMessage());
            miSesion.setAttribute("volver", "index");
            response.sendRedirect("mensajesError.jsp");
        } catch (SQLException e2) {
            miSesion.setAttribute("mensajeError", e2.getMessage());
            miSesion.setAttribute("volver", "index");
            response.sendRedirect("mensajesError.jsp");
        } catch (MenorDeEdadExcepcion e3) {
            miSesion.setAttribute("mensajeError", e3.getMessage());
            miSesion.setAttribute("volver", "index");
            response.sendRedirect("mensajesError.jsp");
        }

        try (PrintWriter out = response.getWriter()) {
            /* TODO output your page here. You may use following sample code. 
            out.println("<!DOCTYPE html>");
            out.println("<html>");
            out.println("<head>");
            out.println("<title>Servlet servletRegistrar</title>");
            out.println("</head>");
            out.println("<body>");
            out.println("<h1>Servlet servletRegistrar at " + request.getContextPath() + "</h1>");
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
