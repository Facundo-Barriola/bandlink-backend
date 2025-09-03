export type UpdateStudioPatch = {
  legalName?: string | null;
  phone?: string | null;
  website?: string | null;
  cancellationPolicy?: string | null;
  openingHours?: Record<string, any> | null; 
  displayName?: string;           
  bio?: string | null;
  avatarUrl?: string | null;
  idAddress?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type UpdateStudioResult = {
  ok: true;
  info: string | null;
  idStudio: number;
  idUserProfile: number;
  legalName: string | null;
  phone: string | null;
  website: string | null;
  isVerified: boolean;
  openingHours: any | null;
  cancellationPolicy: string | null;

  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  idAddress: number | null;
  latitude: number | null;
  longitude: number | null;

  updatedStudioAt: string;   
  updatedProfileAt: string;  
};