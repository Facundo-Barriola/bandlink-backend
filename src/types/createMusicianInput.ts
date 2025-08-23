export type CreateMusicianInput = {
  idUser: number;
  userProfile: {
    displayName: string;
    bio?: string | null;
    idAddress?: number | null; // si aún no tenés address, mandá null
    latitude?: number | null;
    longitude?: number | null;
  };
  musician: {
    birthDate: string;
    experienceYears?: number | null;           
    skillLevel: "beginner" | "intermediate" | "advanced" | "professional";
    isAvailable: boolean;
    travelRadiusKm: number;
    visibility: "city" | "province" | "country" | "global";
  };
    instruments: Array<{ idInstrument: number; isPrimary?: boolean }>;
    genreIds?: number[];      
};