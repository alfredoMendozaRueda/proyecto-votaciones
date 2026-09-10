export interface Candidato {
  dni: string;
  nombreCompleto: string;
  siglasPartido: string;
  orden: number;
}

export interface CandidatoRequest {
  dni: string;
  nombreCompleto: string;
  siglasPartido: string;
  orden: number;
}
