
export interface User {
  idUser: number;     // ID del usuario
  email: string;      // Email único
  role?: number;      // Opcional, por ejemplo 'musico', 'sala', etc.
}