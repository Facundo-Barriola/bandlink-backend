export interface Amp {
  brand: string;
  type: "guitar" | "bass" | "keyboard" | string;
  qty: number;
}

export interface DrumKit {
  brand: string;
  pieces: number; // número de tambores
}

export interface MixingConsole {
  brand: string;
  channels: number;
}

export interface StudioRoomEquipment {
  drums?: DrumKit;
  amps?: Amp[];
  mics?: number;
  mixingConsole?: MixingConsole;
  // extensible
  [key: string]: any;
}