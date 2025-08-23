export type MusicianRow = {
  idMusician: number;
  displayName: string;
  bio: string | null;
  experienceYears: number | null;
  skillLevel: string;
  isAvailable: boolean;
  travelRadiusKm: number | null;
  visibility: string;
  birthDate: string | null; // ISO date string (pg devuelve ISO)
  instruments: { idInstrument: number; instrumentName: string; isPrimary: boolean }[];
};