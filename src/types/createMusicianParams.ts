export type CreateMusicianParams = {
  idUser: number;
  displayName: string;
  bio?: string | null;
  idAddress?: number | null;
  latitude?: number | null;
  longitude?: number | null;

  experienceYears?: number | null;
  skillLevel?: string | null;
  isAvailable?: boolean | null;
  travelRadiusKm?: number | null;
  visibility?: string | null;
  birthDate?: string | Date | null;

  instruments?: Array<{ idInstrument: number; isPrimary?: boolean }>;
  genres?: Array<{ idGenre: number }>;
};