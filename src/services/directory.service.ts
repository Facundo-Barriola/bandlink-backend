import { getInstruments, getAmenities, getMusicianProfileByUser, getGenres, searchMusiciansByName } from "../repositories/directory.repository.js";
import { LegacyReturn } from "../types/LegacyReturn.js";
import { MusicianProfileRow } from "../types/musicianRow.js";
export class DirectoryService {
    static async listInstruments(){
        return await getInstruments();
    }

    static async listAmenities(){
        return await getAmenities();
    }

    static async getMusicianProfileByUser(idUser: number): Promise<{ legacy: LegacyReturn; musicianProfile: MusicianProfileRow | null } | null>{
        const Musician = await getMusicianProfileByUser(idUser);
        return Musician;
    }
    static async listGenres(){
        return await getGenres();
    }

    static async getMusicianByName(musicianName: string){
        const foundMusician = await searchMusiciansByName(musicianName);
        return foundMusician;
    }
}