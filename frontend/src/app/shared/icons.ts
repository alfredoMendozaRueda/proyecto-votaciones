/**
 * Registro de iconos de la aplicacion: cada entrada es una lista de
 * elementos SVG (como cadenas de marcado ya seguras, definidas aqui mismo,
 * nunca a partir de datos externos) que se pintan dentro de un
 * <svg viewBox="0 0 24 24">. Estilo lineal, un solo trazo, sin dependencias
 * externas ni fuentes de iconos por CDN.
 */
export type NombreIcono =
  | 'inicio'
  | 'partidos'
  | 'candidatos'
  | 'elecciones'
  | 'censo'
  | 'votar'
  | 'resultados'
  | 'ganador'
  | 'porcentajes'
  | 'cookie'
  | 'comprobar'
  | 'usuario'
  | 'salir'
  | 'exito'
  | 'error'
  | 'flecha'
  | 'refrescar'
  | 'papelera'
  | 'boleta'
  | 'candado';

export const ICONOS: Record<NombreIcono, string> = {
  inicio:
    '<polyline points="4,12 12,5 20,12"/><path d="M6,11 V19 H18 V11"/><rect x="10" y="13" width="4" height="6"/>',
  partidos: '<line x1="6" y1="3" x2="6" y2="21"/><polygon points="6,4 18,7.5 6,11"/>',
  candidatos:
    '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9.5" r="2.3"/><path d="M3,20 L4,15 L14,15 L15,20"/><path d="M14.5,20 L15.3,16 L21.5,16 L22,20"/>',
  elecciones:
    '<rect x="3" y="5" width="18" height="16" rx="1.5"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/>',
  censo:
    '<rect x="5" y="4" width="14" height="17" rx="1.5"/><rect x="9" y="2" width="6" height="4" rx="1"/><line x1="8" y1="11" x2="16" y2="11"/><line x1="8" y1="15" x2="16" y2="15"/><line x1="8" y1="19" x2="13" y2="19"/>',
  votar:
    '<path d="M4,10 L4,21 L20,21 L20,10"/><path d="M2,10 L22,10 L19,4 L5,4 Z"/><polyline points="9,13 11,16 16,10"/>',
  resultados:
    '<line x1="4" y1="21" x2="20" y2="21"/><rect x="6" y="14" width="3" height="7"/><rect x="11" y="9" width="3" height="12"/><rect x="16" y="4" width="3" height="17"/>',
  ganador:
    '<path d="M7,3 L17,3 L17,11 L7,11 Z"/><circle cx="5" cy="6" r="2"/><circle cx="19" cy="6" r="2"/><line x1="12" y1="11" x2="12" y2="16"/><line x1="8" y1="20" x2="16" y2="20"/><line x1="8" y1="20" x2="10" y2="16"/><line x1="16" y1="20" x2="14" y2="16"/>',
  porcentajes:
    '<circle cx="7" cy="7" r="2.3"/><circle cx="17" cy="17" r="2.3"/><line x1="18" y1="6" x2="6" y2="18"/>',
  cookie:
    '<circle cx="12" cy="12" r="9"/><circle cx="9" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="15.5" cy="9.5" r="1" fill="currentColor" stroke="none"/><circle cx="9.5" cy="15" r="1" fill="currentColor" stroke="none"/><circle cx="15" cy="15.5" r="1" fill="currentColor" stroke="none"/>',
  comprobar:
    '<rect x="5" y="4" width="14" height="17" rx="1.5"/><rect x="9" y="2" width="6" height="4" rx="1"/><polyline points="8,13 10.5,15.5 16,10"/>',
  usuario: '<circle cx="12" cy="8" r="4"/><path d="M4,21 L5,15 L19,15 L20,21"/>',
  salir:
    '<path d="M9,4 L5,4 L5,20 L9,20"/><line x1="21" y1="12" x2="10" y2="12"/><polyline points="17,7 21,12 17,17"/>',
  exito: '<circle cx="12" cy="12" r="9"/><polyline points="8,12.5 11,15.5 16,9.5"/>',
  error:
    '<circle cx="12" cy="12" r="9"/><line x1="12" y1="7" x2="12" y2="13.5"/><circle cx="12" cy="16.5" r="0.75" fill="currentColor" stroke="none"/>',
  flecha: '<line x1="4" y1="12" x2="18" y2="12"/><polyline points="12,6 18,12 12,18"/>',
  refrescar:
    '<circle cx="12" cy="12" r="8" stroke-dasharray="42 8" transform="rotate(-45 12 12)"/><polygon points="18,4.5 21.3,7.6 17.2,8.8" fill="currentColor" stroke="none"/>',
  papelera:
    '<line x1="5" y1="7" x2="19" y2="7"/><path d="M9,7 L9,4 L15,4 L15,7"/><path d="M7,7 L8,21 L16,21 L17,7"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/>',
  boleta:
    '<path d="M4,10 L4,21 L20,21 L20,10"/><path d="M2,10 L22,10 L19,4 L5,4 Z"/><polyline points="9,13 11,16 16,10"/>',
  candado:
    '<rect x="5" y="11" width="14" height="9" rx="1.5"/><path d="M8,11 L8,8.5 L8.6,7 L10,6 L12,5.6 L14,6 L15.4,7 L16,8.5 L16,11"/><circle cx="12" cy="15.5" r="1.4" fill="currentColor" stroke="none"/>',
};
