export type CreateStudioParams = {
  idUser: number;
  displayName: string;
  bio?: string | null;
  idAddress?: number | null;
  latitude?: number | null;
  longitude?: number | null;
  address?: {
    idCity: number;
    street: string;
    streetNum: number;
    addressDesc?: string | null;
  };

  legalName?: string | null;
  phone?: string | null;
  website?: string | null;
  isVerified?: boolean | null;
  openingHours?: any; // jsonb
  cancellationPolicy?: string | null;

  amenities?: Array<{ idAmenity: number }>;
  rooms?: Array<{
    roomName: string;
    capacity?: number | null;
    hourlyPrice: number | string;
    notes?: string | null;
    equipment?: any; // jsonb
  }>;
};