export type LegacyReturn = {
  user: {
    idUser: number;
    idUserProfile: number;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    latitude: string | null;
    longitude: string | null;
  };
  musician: {
    idMusician: number;
    experienceYears: number | null;
    skillLevel: string | null;
    isAvailable: boolean | null;
    travelRadiusKm: number | null;
    visibility: string | null;
    birthDate: string | null;
    instruments: Array<{ idInstrument: number; instrumentName: string; isPrimary: boolean | null; }>;
    genres: Array<{ idGenre: number; genreName: string }>;
  } | null;
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
  eventsCreated: Array<{
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
};