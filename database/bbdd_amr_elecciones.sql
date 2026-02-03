-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 03-02-2026 a las 12:42:19
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `bbdd_amr_elecciones`
--
CREATE DATABASE IF NOT EXISTS `bbdd_amr_elecciones` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_spanish_ci;
USE `bbdd_amr_elecciones`;

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `candidatos`
--

CREATE TABLE `candidatos` (
  `dni` varchar(9) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `nombre_candidato` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `siglas_partido` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `orden` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;

--
-- Volcado de datos para la tabla `candidatos`
--

INSERT INTO `candidatos` (`dni`, `nombre_candidato`, `siglas_partido`, `orden`) VALUES
('10101010J', 'Sergio Domínguez', 'VOX', 1),
('11111111A', 'María Gómez', 'PODEMOS', 1),
('12121212K', 'Nuria Cano', 'VOX', 2),
('13131313L', 'Alberto Vega', 'VOX', 3),
('22222222B', 'Javier Ruiz', 'PODEMOS', 2),
('23456789M', 'asdfasdf', 'VOX', 2),
('33333333C', 'Ana Martínez', 'PODEMOS', 3),
('44444444D', 'Pedro Sánchez', 'PP', 1),
('55555555E', 'Lucía Fernández', 'PP', 2),
('66666666F', 'Miguel Torres', 'PP', 3),
('77777777G', 'Elena Navarro', 'PSOE', 1),
('88888888H', 'Raúl Moreno', 'PSOE', 2),
('99999999I', 'Isabel Lozano', 'PSOE', 3);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `censo`
--

CREATE TABLE `censo` (
  `dni` varchar(9) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `nombre_completo` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `fecha_nacimiento` date NOT NULL,
  `direccion` varchar(150) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `id_localidad` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;

--
-- Volcado de datos para la tabla `censo`
--

INSERT INTO `censo` (`dni`, `nombre_completo`, `fecha_nacimiento`, `direccion`, `id_localidad`) VALUES
('10101010J', 'Sergio Domínguez', '1987-08-14', 'Calle Prado 9', 'ALB'),
('11111111A', 'María Gómez', '1990-05-12', 'Calle Sol 12', 'ALB'),
('12121212K', 'Nuria Cano', '1994-02-10', 'Calle Sierra 14', 'CUEN'),
('12345678Z', 'Laura Martínez Ruiz', '1990-05-12', 'Calle Mayor 15', 'ALB'),
('13131313L', 'Alberto Vega', '1986-10-03', 'Av. Cervantes 22', 'TOLE'),
('22222222B', 'Javier Ruiz', '1985-03-20', 'Av. Castilla 45', 'CUEN'),
('23456789M', 'Carlos Gómez Pérez', '1985-11-03', 'Av. de la Mancha 22', 'TOLE'),
('33333333C', 'Ana Martínez', '1992-07-08', 'Calle Luna 8', 'TOLE'),
('34567890L', 'Ana Torres Sánchez', '2000-07-25', 'Plaza del Sol 8', 'CUEN'),
('44444444D', 'Pedro Sánchez', '1980-11-15', 'Calle Mayor 33', 'SEV'),
('45678901X', 'Miguel Rodríguez León', '1992-03-18', 'Calle Betis 10', 'SEV'),
('49432145Q', 'Alfredo Mendoza Rueda', '2006-02-17', 'Paraiso', 'ALB'),
('55555555E', 'Lucía Fernández', '1995-01-30', 'Calle Olivo 21', 'GRAN'),
('56789012T', 'Lucía Fernández Romero', '1988-09-30', 'Camino Real 5', 'GRAN'),
('66666666F', 'Miguel Torres', '1988-09-25', 'Av. España 10', 'CAD'),
('67890123R', 'Javier Morales Ortega', '1995-12-07', 'Av. Andalucía 33', 'CAD'),
('77777777G', 'Elena Navarro', '1993-06-17', 'Calle Río 5', 'SEV'),
('78901234A', 'Luis García Torres', '2010-05-18', 'Calle Río 12', 'ALB'),
('88888888H', 'Raúl Moreno', '1982-12-05', 'Calle Jardín 17', 'GRAN'),
('99999999I', 'Isabel Lozano', '1991-04-22', 'Av. Libertad 3', 'CAD');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `comunidades`
--

CREATE TABLE `comunidades` (
  `id_comunidad` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `nombre_comunidad` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;

--
-- Volcado de datos para la tabla `comunidades`
--

INSERT INTO `comunidades` (`id_comunidad`, `nombre_comunidad`) VALUES
('AND', 'Andalucía'),
('CM', 'Castilla-La Mancha');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `elecciones`
--

CREATE TABLE `elecciones` (
  `id_elecciones` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `descripcion` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `fecha_inicio` date NOT NULL,
  `fecha_fin` date NOT NULL,
  `estado` varchar(20) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;

--
-- Volcado de datos para la tabla `elecciones`
--

INSERT INTO `elecciones` (`id_elecciones`, `descripcion`, `fecha_inicio`, `fecha_fin`, `estado`) VALUES
('E1', 'Eleccion de prueba 1', '2025-11-20', '2025-11-25', 'inhabilitada');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `localidades`
--

CREATE TABLE `localidades` (
  `id_localidad` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `nombre_localidad` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `id_comunidad` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;

--
-- Volcado de datos para la tabla `localidades`
--

INSERT INTO `localidades` (`id_localidad`, `nombre_localidad`, `id_comunidad`) VALUES
('ALB', 'Albacete', 'CM'),
('CAD', 'Cádiz', 'AND'),
('CUEN', 'Cuenca', 'CM'),
('GRAN', 'Granada', 'AND'),
('SEV', 'Sevilla', 'AND'),
('TOLE', 'Toledo', 'CM');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `participacion`
--

CREATE TABLE `participacion` (
  `id_localidad` varchar(100) NOT NULL,
  `numero_censados` int(11) NOT NULL,
  `total_votos` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;

--
-- Volcado de datos para la tabla `participacion`
--

INSERT INTO `participacion` (`id_localidad`, `numero_censados`, `total_votos`) VALUES
('ALB', 5, 1),
('CAD', 3, 0),
('CUEN', 3, 1),
('GRAN', 3, 0),
('SEV', 3, 0),
('TOLE', 3, 2);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `partidos`
--

CREATE TABLE `partidos` (
  `siglas` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `descripcion` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `imagen` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;

--
-- Volcado de datos para la tabla `partidos`
--

INSERT INTO `partidos` (`siglas`, `descripcion`, `imagen`) VALUES
('INMA', 'Inma Moreno', '../../imagenes/inma.jpg'),
('PODEMOS', 'podemos', '../../imagenes/PODEMOS.jpg'),
('PP', 'Partido Popular', '../../imagenes/PP.jpg'),
('PSOE', 'Partido Socialista Obrero EspaÃ±ol', '../../imagenes/PSOE.jpg'),
('VOX', 'VOX', '../../imagenes/VOX.jpg');

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `usuarios`
--

CREATE TABLE `usuarios` (
  `dni` varchar(9) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `rol` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `votado` tinyint(1) NOT NULL DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;

--
-- Volcado de datos para la tabla `usuarios`
--

INSERT INTO `usuarios` (`dni`, `password`, `rol`, `votado`) VALUES
('12121212K', '5f4dcc3b5aa765d61d8327deb882cf99', 'votante', 1),
('12345678Z', '5f4dcc3b5aa765d61d8327deb882cf99', 'votante', 0),
('23456789M', '5f4dcc3b5aa765d61d8327deb882cf99', 'admin', 1),
('49432145Q', '5f4dcc3b5aa765d61d8327deb882cf99', 'votante', 1),
('55555555E', '5f4dcc3b5aa765d61d8327deb882cf99', 'analista', 0);

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `votos`
--

CREATE TABLE `votos` (
  `id_voto` int(15) NOT NULL,
  `id_localidad` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `siglas_partido` varchar(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_spanish_ci;

--
-- Volcado de datos para la tabla `votos`
--

INSERT INTO `votos` (`id_voto`, `id_localidad`, `siglas_partido`) VALUES
(28, 'TOLE', 'PSOE'),
(29, 'TOLE', 'VOX'),
(30, 'ALB', 'PP'),
(31, 'CUEN', 'VOX');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `candidatos`
--
ALTER TABLE `candidatos`
  ADD PRIMARY KEY (`dni`),
  ADD KEY `siglas_partido` (`siglas_partido`);

--
-- Indices de la tabla `censo`
--
ALTER TABLE `censo`
  ADD PRIMARY KEY (`dni`),
  ADD KEY `id_localidad` (`id_localidad`);

--
-- Indices de la tabla `comunidades`
--
ALTER TABLE `comunidades`
  ADD PRIMARY KEY (`id_comunidad`);

--
-- Indices de la tabla `elecciones`
--
ALTER TABLE `elecciones`
  ADD PRIMARY KEY (`id_elecciones`);

--
-- Indices de la tabla `localidades`
--
ALTER TABLE `localidades`
  ADD PRIMARY KEY (`id_localidad`),
  ADD KEY `id_comunidad` (`id_comunidad`);

--
-- Indices de la tabla `participacion`
--
ALTER TABLE `participacion`
  ADD PRIMARY KEY (`id_localidad`);

--
-- Indices de la tabla `partidos`
--
ALTER TABLE `partidos`
  ADD PRIMARY KEY (`siglas`);

--
-- Indices de la tabla `usuarios`
--
ALTER TABLE `usuarios`
  ADD PRIMARY KEY (`dni`);

--
-- Indices de la tabla `votos`
--
ALTER TABLE `votos`
  ADD PRIMARY KEY (`id_voto`),
  ADD KEY `id_localidad` (`id_localidad`),
  ADD KEY `siglas_partido` (`siglas_partido`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `votos`
--
ALTER TABLE `votos`
  MODIFY `id_voto` int(15) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=32;

--
-- Restricciones para tablas volcadas
--

--
-- Filtros para la tabla `candidatos`
--
ALTER TABLE `candidatos`
  ADD CONSTRAINT `candidatos_ibfk_1` FOREIGN KEY (`siglas_partido`) REFERENCES `partidos` (`siglas`);

--
-- Filtros para la tabla `censo`
--
ALTER TABLE `censo`
  ADD CONSTRAINT `censo_ibfk_1` FOREIGN KEY (`id_localidad`) REFERENCES `localidades` (`id_localidad`);

--
-- Filtros para la tabla `localidades`
--
ALTER TABLE `localidades`
  ADD CONSTRAINT `localidades_ibfk_1` FOREIGN KEY (`id_comunidad`) REFERENCES `comunidades` (`id_comunidad`);

--
-- Filtros para la tabla `votos`
--
ALTER TABLE `votos`
  ADD CONSTRAINT `votos_ibfk_1` FOREIGN KEY (`id_localidad`) REFERENCES `localidades` (`id_localidad`),
  ADD CONSTRAINT `votos_ibfk_2` FOREIGN KEY (`siglas_partido`) REFERENCES `partidos` (`siglas`);
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
