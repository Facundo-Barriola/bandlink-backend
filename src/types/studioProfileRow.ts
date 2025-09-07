export type StudioProfileRow = {
  idUser: number;
  idUserProfile: number;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  idAddress: number | null;
  latitude: string | number | null;
  longitude: string | number | null;
  address: any;

  idStudio: number;
  legalName: string | null;
  phone: string | null;
  website: string | null;
  isVerified: boolean;
  openingHours: any;
  cancellationPolicy: string | null;

  amenities: any[];
  rooms: any[];
  amenityCount: number;
  roomCount: number;

  eventsAtStudio: any[];
  eventsUpcomingCount: number;
  eventsPastCount: number;
};

export type StudioMini = {
  idUser: number;
  idUserProfile: number;
  idStudio: number;
  displayName: string;
};