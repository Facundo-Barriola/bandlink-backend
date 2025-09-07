export type EditStudioRoomParams = {
  roomName?: string | null;
  capacity?: number | null;
  hourlyPrice?: number | null;
  notes?: string | null;
  equipment?: any | null;       
};

export type StudioRoom = {
  idRoom: number;
  idStudio: number;
  roomName: string;
  capacity: number | null;
  hourlyPrice: number;     
  notes: string | null;
  equipment: any | null;    
}

export type UpdateStudioBasicPatch = {
  displayName?: string;             
  bio?: string | null;
  legalName?: string | null;
  phone?: string | null;
  website?: string | null;
  cancellationPolicy?: string | null;
  openingHours?: Record<string, any> | null; 
  amenities?: number[];           
};

export type UpdateStudioBasicResult = {
  ok: true;
  info: "updated";
  idStudio: number;
  displayName: string;
  bio: string | null;
  legalName: string | null;
  phone: string | null;
  website: string | null;
  cancellationPolicy: string | null;
  openingHours: any | null;
  amenities: number[] | null;
  updatedAt: string;
};
