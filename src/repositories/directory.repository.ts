import {Instrument, Muscian, Studio, UserProfile, Room, RoomEquipment, Amenity, Genre} from "../models/directory.model.js"
import { pool } from "../config/database.js";
const INSTRUMENT_TABLE = `"Directory"."Instrument"`;

export async function getInstruments(): Promise<Instrument[]>{
    const { rows } =  await pool.query(`SELECT "idInstrument", "instrumentName" FROM ${INSTRUMENT_TABLE} ORDER BY "instrumentName"`);
    return rows;
}