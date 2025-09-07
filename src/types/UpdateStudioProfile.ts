export type UpdateStudioProfilePatch = {
  displayName?: string;          
  bio?: string | null;
  legalName?: string | null;
  phone?: string | null;
  website?: string | null;
  cancellationPolicy?: string | null;
  openingHours?: Record<string, any> | null;
  amenities?: number[];
};

export type UpdateStudioProfileResult = {
  ok: true;
  info: "updated";
  idStudio: number;

  displayName: string;
  bio: string | null;

  legalName: string | null;
  phone: string | null;
  website: string | null;
  cancellationPolicy: string | null;

  openingHours: any | null; // jsonb
  amenities: number[] | null;
};
