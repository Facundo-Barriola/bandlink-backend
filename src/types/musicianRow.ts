export interface MusicianProfileRow {
  idMusician: number;
  idUserProfile: number;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  experienceYears: number | null;
  skillLevel: string | null;
  isAvailable: boolean | null;
  travelRadiusKm: number | null;
  visibility: string | null;
  birthDate: string | null;      // o Date
  latitude: string | null;       // numeric -> string con pg por defecto
  longitude: string | null;

  instruments: Array<{
    idInstrument: number;
    instrumentName: string;
    isPrimary: boolean | null;
  }>;

  genres: Array<{
    idGenre: number;
    genreName: string;
  }>;

  bands: Array<{
    idBand: number;
    name: string;
    description: string | null;
    createdAt: string;
    updatedAt: string;
    roleInBand: string | null;
    isAdmin: boolean;
    joinedAt: string;
    leftAt: string | null;
    genres: Array<{ idGenre: number; genreName: string }>;
  }>;

  eventsUpcoming: Array<{
    idEvent: number;
    name: string;
    description: string | null;
    visibility: string;
    capacityMax: number | null;
    idAddress: number | null;
    latitude: string | null;
    longitude: string | null;
    startsAt: string;
    endsAt: string | null;
    createdAt: string;
    updatedAt: string;
  }>;
  eventsUpcomingCount: number;
  eventsPastCount: number;
}