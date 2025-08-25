export type CreateStudioInput = {
  legalName?: string | null;
  phone?: string | null;
  website?: string | null;
  cancellationPolicy?: string | null;
  openingHours?: Record<string, any> | null; // jsonb
  amenities?: number[]; // IDs de Directory.Amenity
  rooms?: Array<{
    roomName: string;
    capacity?: number | null;
    hourlyPrice: number; // numeric(10,2)
    notes?: string | null;
    equipment?: Record<string, any> | null; // jsonb
  }>;
};