# syntax=docker/dockerfile:1

# ---- Etapa 1: build del frontend Angular ----
FROM node:20-alpine AS frontend-build
WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# ---- Etapa 2: build del backend Spring Boot, con el frontend ya compilado ----
FROM maven:3.9-eclipse-temurin-17 AS backend-build
WORKDIR /app
COPY pom.xml ./
COPY src ./src
COPY --from=frontend-build /app/frontend/dist/frontend/browser ./src/main/resources/static
RUN mvn -q -DskipTests package

# ---- Etapa 3: imagen final de ejecucion ----
FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=backend-build /app/target/proyecto-votaciones-*.jar app.jar
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
