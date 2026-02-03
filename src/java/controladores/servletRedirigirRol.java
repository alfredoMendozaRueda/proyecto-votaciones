/*
 * Click nbfs://nbhost/SystemFileSystem/Templates/Licenses/license-default.txt to change this license
 * Click nbfs://nbhost/SystemFileSystem/Templates/JSP_Servlet/Servlet.java to edit this template
 */
package controladores;

import dao.ConexionBBDD;
import java.io.IOException;
import java.io.PrintWriter;
import java.net.URLEncoder;
import java.sql.SQLException;
import javax.servlet.ServletException;
import javax.servlet.http.Cookie;
import javax.servlet.http.HttpServlet;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import javax.servlet.http.HttpSession;


/**
 *
 * @author ferre
 */
public class servletRedirigirRol extends HttpServlet {

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
        String boton=request.getParameter("boton");
        if(boton.equalsIgnoreCase("Iniciar sesion")){
        String dni = request.getParameter("dni");
        miSesion.setAttribute("dniUsu", dni);
        String contrasena = request.getParameter("contrasena");
        String nombre;
        try {
            ConexionBBDD bbdd = new ConexionBBDD();
            if (!(request.getParameter("dni").equals(""))) {
                if (bbdd.existeEnCenso(dni)) {
                    dni = request.getParameter("dni");
                    contrasena = request.getParameter("contrasena");
                    nombre=bbdd.getNombreCenso(dni);
                    
                    
                    /*PARA PODER AÑADIR UNA COOKIE*/
                    String valorCodificado=URLEncoder.encode(nombre,"UTF-8");
                    Cookie nombreUsuario=new Cookie("nombre",valorCodificado);
                    nombreUsuario.setMaxAge(60*3);
                    response.addCookie(nombreUsuario);
                    /*PARA PODER AÑADIR UNA COOKIE*/
                    if (bbdd.comprobarContrasena(dni, contrasena)) {
                        if (bbdd.isAdmin(dni)) {
                            miSesion.setAttribute("isValido", true);
                            response.sendRedirect("vistas/admin/panelAdmin.jsp");
                        }else if (bbdd.isAnalista(dni)) {
                             miSesion.setAttribute("isValido", true);
                            response.sendRedirect("vistas/analista/panelAnalista.jsp");
                        }else {
                            response.sendRedirect("vistas/usuario/panelUsuario.jsp");
                            miSesion.setAttribute("isValido", true);
                        }
                    } else {
                        miSesion.setAttribute("mensajeError", "Contraseña incorrecta, intentalo de nuevo");
                        miSesion.setAttribute("volver", "index");
                        
                        response.sendRedirect("mensajesError.jsp");
                    }
                } else {
                    miSesion.setAttribute("mensajeError", "No se ha encontrado ese dni registrado en el censo");
                    miSesion.setAttribute("volver", "index");
                    response.sendRedirect("mensajesError.jsp");
                }

            } else {
                miSesion.setAttribute("mensajeError", "Rellena los campos");
                response.sendRedirect("mensajesError.jsp");
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
        }
        }else{
            miSesion.setAttribute("mensajeError", "Has entrado de manera ilegitima");
            miSesion.setAttribute("volver", "index");
            response.sendRedirect("mensajesError.jsp");
        }
        try (PrintWriter out = response.getWriter()) {

            /* TODO output your page here. You may use following sample code. 
            out.println("<!DOCTYPE html>");
            out.println("<html>");
            out.println("<head>");
            out.println("<title>Servlet servletRedirigirRol</title>");
            out.println("</head>");
            out.println("<body>");
            out.println("<h1>Servlet servletRedirigirRol at " + request.getContextPath() + "</h1>");
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
