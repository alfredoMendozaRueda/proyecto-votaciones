export interface Resultado {
  siglas: string;
  descripcion: string;
  votos: number;
}

export interface Porcentaje {
  localidad: string;
  porcentaje: number;
}

export interface CookieGanador {
  partidoGanador: string | null;
}

export interface Ganador {
  eleccionesTodaviaHabilitadas: boolean;
  presidenteGanador: string | null;
}
