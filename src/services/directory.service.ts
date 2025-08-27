import { getInstruments, getAmenities, getMusicianProfileByUser } from "../repositories/directory.repository.js";
import { Instrument } from "../models/directory.model.js";

export class DirectoryService {
    static async listInstruments(){
        return await getInstruments();
    }

    static async listAmenities(){
        return await getAmenities();
    }

    static async getMusicianProfileByUser(idUser: number){
        const Musician = await getMusicianProfileByUser(idUser);
        return Musician;
    }
}