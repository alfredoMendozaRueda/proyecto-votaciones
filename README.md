# Kitsune · asistente de escritorio

Asistente personal para Windows protagonizado por un kitsune 3D de nueve colas.
Se invoca con un atajo de teclado y aparece abajo a la izquierda de la
pantalla; encima de él se abre un diálogo para hablar con Claude y revisar el
correo con una bandeja propia en tonos rojos y negros.

Esta rama es un proyecto independiente del sistema de votaciones: no comparte
historial ni código con `main`.

## Hoja de ruta

1. **Personaje y animaciones** (esta fase).
2. Diálogo para hablar con Claude.
3. Bandeja de correo integrada (Gmail) con estilos rojo y negro.
4. Ajustes: atajo, pelaje, tamaño, posición, sonidos, cuenta de correo.

La aplicación de escritorio irá sobre Electron: ventana transparente sin marco,
siempre encima, anclada a la esquina inferior izquierda del área de trabajo, y
registrada con `globalShortcut` (por defecto `Ctrl + Alt + K`).

## El personaje

Un zorro semirrealista generado por código con [three.js](https://threejs.org),
sin modelos ni texturas externas, en `src/kitsune/`. La anatomía está hecha de
tubos con perfil propio (torso, cuello, cabeza, patas, colas), el pelo se
dibuja por capas instanciadas peinadas a favor del cuerpo, y la luz es física
(ACES, sombras reales y un entorno de estudio para los reflejos).

| Archivo        | Qué contiene                                                                    |
| -------------- | ------------------------------------------------------------------------------- |
| `Kitsune.js`   | Escena, luces, máquina de estados, acciones y micro-gestos.                     |
| `anatomia.js`  | Montaje del zorro y "pintores" del pelaje (pecho blanco, medias, lágrimas...). |
| `geometria.js` | Tubos de sección elíptica, orejas en cuenco y parches proyectados.             |
| `pelaje.js`    | Pelo por capas (shell texturing) con una sola llamada de dibujo por pieza.     |
| `ojo.js`       | Ojos y marca de la frente dibujados por shader: párpados, iris, pupila.        |
| `cola.js`      | Cada cola: tubo cuya columna se recalcula por cinemática directa.              |
| `fuegos.js`    | Kitsunebi: fuegos fatuos que orbitan con estela.                               |
| `paletas.js`   | Pelajes reales: zorro rojo (Carmesí), plateado (Sombra) y ártico (Nieve).      |
| `easing.js`    | Curvas de animación y suavizado interrumpible.                                 |

### Estados (en bucle, interrumpibles)

| Estado     | Cuándo lo usará la app                         |
| ---------- | ---------------------------------------------- |
| `reposo`   | Sin actividad: respira, parpadea, mueve orejas. |
| `escuchar` | Mientras escribes en el diálogo.               |
| `hablar`   | Mientras llega la respuesta de Claude.         |
| `pensar`   | Mientras Claude prepara la respuesta.          |
| `dormir`   | Tras unos minutos sin uso.                     |

### Acciones (una sola vez, devuelven una promesa)

| Acción        | Cuándo la usará la app                 |
| ------------- | -------------------------------------- |
| `aparecer`    | Al pulsar el atajo.                    |
| `saludar`     | La primera vez de cada día.            |
| `alegria`     | Al llegar un correo nuevo.             |
| `desaparecer` | Al pulsar el atajo otra vez o `Esc`.   |

```js
import { Kitsune } from './src/kitsune/Kitsune.js';

const kitsune = new Kitsune(document.getElementById('lienzo'), { paleta: 'carmesi' });
await kitsune.reproducir('aparecer');
kitsune.setEstado('escuchar');
kitsune.on('toque', () => kitsune.reproducir('alegria'));
```

Respeta `prefers-reduced-motion`: con movimiento reducido el balanceo de las
colas y los saltos se atenúan.

## Vista previa

```bash
npm install
npm run dev
```

Abre la URL que muestra Vite. La página permite probar cada estado y acción,
cambiar de pelaje, ver al kitsune sobre un escritorio simulado y usar
`Ctrl + Alt + K` para mostrarlo u ocultarlo.
