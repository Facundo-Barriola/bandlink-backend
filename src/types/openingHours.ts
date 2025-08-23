export type OpeningHours = {
  [day in "Lunes" | "Martes" | "Miercoles" | "Jueves" | "Viernes" | "Sabado" | "Domingo"]: [string, string][];
};