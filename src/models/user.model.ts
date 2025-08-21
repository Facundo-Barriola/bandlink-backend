
export interface User {
  idUser: number;     // ID del usuario
  email: string;      // Email único
  role?: number;
  passwordHash?: string; // Hash de la contraseña (opcional, no se devuelve en respuestas)
}