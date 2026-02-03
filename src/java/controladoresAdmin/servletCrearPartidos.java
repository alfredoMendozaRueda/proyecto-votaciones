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
import modelos.Partido;

/**
 *
 * @author ferre
 */
public class servletCrearPartidos extends HttpServlet {

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
        response.setCharacterEncoding("UTF-8");
        request.setCharacterEncoding("UTF-8");
        response.setContentType("text/html;charset=UTF-8");
        HttpSession miSesion=request.getSession(true);
        try{
        ConexionBBDD bbdd= new ConexionBBDD();
         String siglas=request.getParameter("siglas");
        String descripcion=request.getParameter("descripcion");
        String imagen="../../imagenes/"+request.getParameter("imagen");
        Partido p=new Partido(siglas,descripcion,imagen);
        int filas=bbdd.registrarPartido(p);
         if (filas != 1) {
                    miSesion.setAttribute("mensajeError", "No se ha podido registrar el partido");
                    response.sendRedirect("mensajesError.jsp");
                } else {
                    miSesion.setAttribute("mensajeBueno", "Partido registado con exito");
                    response.sendRedirect("mensajesBueno.jsp");
                }
        }catch(ClassNotFoundException e1){
            miSesion.setAttribute("mensajeError", e1.getMessage());
            response.sendRedirect("mensajesError.jsp");
        }catch(SQLException e2){
            miSesion.setAttribute("mensajeError", e2.getMessage());
            response.sendRedirect("mensajesError.jsp");
        }
        
       
        
        
        try (PrintWriter out = response.getWriter()) {
            /* TODO output your page here. You may use following sample code. 
            out.println("<!DOCTYPE html>");
            out.println("<html>");
            out.println("<head>");
            out.println("<title>Servlet servletCrearPartidos</title>");
            out.println("</head>");
            out.println("<body>");
            out.println("<h1>Servlet servletCrearPartidos at " + request.getContextPath() + "</h1>");
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
