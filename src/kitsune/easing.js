export const clamp01 = (x) => Math.min(1, Math.max(0, x));
export const lerp = (a, b, t) => a + (b - a) * t;

export const easeOutCubic = (t) => 1 - (1 - t) ** 3;
export const easeInCubic = (t) => t ** 3;
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
export const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * (t - 1) ** 3 + s * (t - 1) ** 2;
export const easeInBack = (t, s = 1.70158) => (s + 1) * t ** 3 - s * t ** 2;

// Progreso 0..1 de t dentro del tramo [a, b] de una línea de tiempo.
export const tramo = (t, a, b) => clamp01((t - a) / (b - a));

// 0 → 1 → 0 a lo largo de t ∈ [0, 1].
export const campana = (t) => Math.sin(Math.PI * clamp01(t));

export const smoothstep = (a, b, x) => {
  const t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

// Suavizado exponencial independiente del framerate: interrumpible en cualquier
// momento, a diferencia de una interpolación con duración fija.
export const amortiguar = (actual, objetivo, velocidad, dt) =>
  actual + (objetivo - actual) * (1 - Math.exp(-velocidad * dt));
