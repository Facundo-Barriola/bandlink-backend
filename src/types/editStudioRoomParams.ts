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
