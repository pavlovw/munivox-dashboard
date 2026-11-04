export type Estado = "PENDIENTE" | "EN_REVISION" | "DESPACHADO" | "RESUELTO" | "DESCARTADO";
export type Prioridad = "CRITICA" | "ALTA" | "MEDIA" | "BAJA";
export type Rol = "ADMINISTRADOR" | "OPERADOR" | "TERRENO";

export interface DepartamentoRef {
  id: number;
  nombre: string;
}

export interface OperadorResumen {
  id: string;
  nombre: string;
  rol?: Rol;
  email?: string;
}

export interface Operador {
  id: string;
  email: string;
  nombre: string;
  rol: Rol;
  gpsActivo: boolean;
  latitud: number | null;
  longitud: number | null;
  ultimaUbicacion: string | null;
  departamentoId: number | null;
  departamento?: DepartamentoRef | null;
  createdAt?: string;
  _count?: { ticketsAsignados: number };
}

export interface Historial {
  id: string;
  estadoNuevo: Estado;
  comentario: string | null;
  createdAt: string;
  operadorId?: string | null;
  operador?: OperadorResumen | null;
}

export interface Evidencia {
  id: string;
  url: string;
  tipo: string;
  createdAt?: string;
}

export interface Ticket {
  id: string;
  codigoTicket: string;
  estado: Estado;
  prioridadIA: Prioridad | null;
  prioridadFinal?: Prioridad | null;
  analisisIA: string | null;
  certezaIA: number | null;
  latitud: number | null;
  longitud: number | null;
  direccion?: string | null;
  descripcionUsuario: string | null;
  createdAt: string;
  updatedAt?: string;
  ciudadanoId?: string;
  ciudadano?: { id: string; telefono: string; nombre?: string | null; baneado?: boolean } | null;
  categoriaId?: number | null;
  categoria?: { id?: number; nombre: string } | null;
  departamentoId: number | null;
  departamento?: DepartamentoRef | null;
  operadorAsignadoId?: string | null;
  operadorAsignado?: Operador | null;
  evidencias?: Evidencia[];
  historial?: Historial[];
  reportesCiudadano?: number;
  distancia?: number;
}

export interface Ciudadano {
  id: string;
  telefono: string;
  nombre: string | null;
  baneado: boolean;
  createdAt: string;
  _count?: { reportes: number };
  reportes?: { createdAt: string; estado: Estado }[];
}
