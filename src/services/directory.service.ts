import { getInstruments, getAmenities, getMusicianProfileByUser, getGenres, searchMusiciansByName, updateMusicianProfile, getStudioProfileByUser } from "../repositories/directory.repository.js";
import { LegacyReturn } from "../types/LegacyReturn.js";
import { MusicianProfileRow } from "../types/musicianRow.js";
export class DirectoryService {
    
    static async getStudioProfileByUser(idUser: number){
        return await getStudioProfileByUser(idUser)
    }

    static async listInstruments() {
        return await getInstruments();
    }

    static async listAmenities() {
        return await getAmenities();
    }

    static async getMusicianProfileByUser(idUser: number): Promise<{ legacy: LegacyReturn; musicianProfile: MusicianProfileRow | null } | null> {
        const Musician = await getMusicianProfileByUser(idUser);
        return Musician;
    }
    static async listGenres() {
        return await getGenres();
    }

    static async searchMusiciansByName(musicianName: string, genres: string[] | undefined, limit = 8, offset = 0) {
        const foundMusician = await searchMusiciansByName(musicianName, genres, limit, offset);
        return foundMusician;
    }
    static async updateMusicianProfile(idUser: number, displayName: string | null, bio: string | null, isAvailable: boolean | null,
        experienceYears: number | null, skillLevel: string | null, travelRadiusKm: number | null, visibility: string | null, birthDate: Date | string | null,
        instruments: Array<{ idInstrument: number; isPrimary?: boolean }> | null | undefined, genres: Array<{ idGenre: number }> | null | undefined) {
        return await updateMusicianProfile(idUser, displayName, bio, isAvailable, experienceYears, skillLevel,
            travelRadiusKm, visibility, birthDate, instruments, genres);
    }
}