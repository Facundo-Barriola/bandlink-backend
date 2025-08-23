import {Instrument, Musician, Studio, UserProfile, Room, RoomEquipment, Amenity, Genre} from "../models/directory.model.js"
import {CreateMusicianInput} from "../types/createMusicianInput.js";
import {CreatedMusician} from "../types/createdMusician.js";
import { MusicianRow } from "../types/musicianRow.js";
import { pool } from "../config/database.js";
import type { PoolClient } from "pg";

const INSTRUMENT_TABLE = `"Directory"."Instrument"`;
const MUSICIAN_TABLE = `"Directory.Musician"`;
const USER_PROFILE_TABLE = `"Directory"."UserProfile"`;
const STUDIO_TABLE = `"Directory"."Studio"`;
const AMENITY_TABLE = `"Directory"."Amenity"`;
const GENRE_TABLE = `"Directory"."Genre"`;
const STUDIO_ROOM_TABLE = `"Directory"."StudioRoom"`;
const STUDIO_ROOM_EQUIPMENT_TABLE = `"Directory"."StudioRoomEquipment"`;
const STUDIO_AMENITY_TABLE = `"Directory"."StudioAmenity"`;
const MUSICIAN_INSTRUMENT_TABLE = `"Directory"."MusicianInstrument"`;
const MUSICIAN_GENRE_TABLE = `"Directory"."MusicianGenre"`;

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect(); // PoolClient
  try {
    await client.query("BEGIN");
    const out = await fn(client);
    await client.query("COMMIT");
    return out;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function getInstruments(): Promise<Instrument[]>{
    const { rows } =  await pool.query(`SELECT "idInstrument", "instrumentName" FROM ${INSTRUMENT_TABLE} ORDER BY "instrumentName"`);
    return rows;
}

export async function getMusicianByDisplayName(name: string): Promise<Musician[]>{
    const {rows} = await pool.query(`"SELECT * FROM 
                                    ${USER_PROFILE_TABLE}
                                    INNER JOIN ${MUSICIAN_TABLE}
                                    ON ${USER_PROFILE_TABLE}."idUserProfile" = ${MUSICIAN_TABLE}."idUserProfile"
                                    WHERE "displayName" LIKE $1  "`);
    return rows;
}

export async function getInstrumentById(idInstrument: number): Promise<Instrument | null>{
    const query = `"SELECT "idInstrument", "instrumentName" FROM ${INSTRUMENT_TABLE} WHERE "IdInstrument" = $1"`
    const values = [idInstrument];
    try{
        const result = await pool.query(query, values);
        if (result.rows.length === 0) return null;
        const row = result.rows[0];
        return row;
    }catch(err){
        console.error("Error en getInstrumentById:", err);
        throw err;
    }   
}

export async function createMusician(input: CreateMusicianInput): Promise<CreatedMusician> {
  if (!input.instruments?.length) {
    throw new Error("Debe especificar al menos un instrumento");
  }

  // Normalizar defaults según tu DDL
  const m = input.musician ?? {};
  const skill = m.skillLevel ?? "intermediate";
  const avail = m.isAvailable ?? true;
  const travel = m.travelRadiusKm ?? 10;
  const visibility = m.visibility ?? "city";

  return withTransaction(async (client) => {
    // 1) Insert en UserProfile (idUser es UNIQUE por DDL, uno a uno)
    const insertProfile = `
      INSERT INTO ${USER_PROFILE_TABLE}
        ("idUser", "displayName", "bio", "idAddress", "latitude", "longitude")
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING "idUserProfile"
    `;
    const profileVals = [
      input.idUser,
      input.userProfile.displayName,
      input.userProfile.bio ?? null,
      input.userProfile.idAddress ?? null,
      input.userProfile.latitude ?? null,
      input.userProfile.longitude ?? null,
    ];
    const upRes = await client.query(insertProfile, profileVals);
    const idUserProfile: number = upRes.rows[0].idUserProfile;

    // 2) Insert en Musician (1 a 1 con UserProfile por UNIQUE)
    const insertMusician = `
      INSERT INTO ${MUSICIAN_TABLE}
        ("idUserProfile", "experienceYears", "skillLevel", "isAvailable", "travelRadiusKm", "visibility", "birthDate")
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING "idMusician"
    `;
    const musicianVals = [
      idUserProfile,
      m.experienceYears ?? null,
      skill,
      avail,
      travel,
      visibility,
      m.birthDate ?? null,
    ];
    const musRes = await client.query(insertMusician, musicianVals);
    const idMusician: number = musRes.rows[0].idMusician;

    // 3) Insert en MusicianInstrument (puede marcarse uno como isPrimary = true)
    //    Si vinieran varios "isPrimary: true", Postgres lo aceptará. Si querés validar 1 solo, hacelo antes.
    const valuesTuples = input.instruments
      .map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`)
      .join(", ");

    const params: any[] = [idMusician];
    input.instruments.forEach((it) => {
      params.push(it.idInstrument, !!it.isPrimary);
    });

    const insertMI = `
      INSERT INTO ${MUSICIAN_INSTRUMENT_TABLE}
        ("idMusician", "idInstrument", "isPrimary")
      VALUES ${valuesTuples}
    `;
    await client.query(insertMI, params);

    // // 4) Si quisieras géneros:
    // if (input.genreIds?.length) {
    //   const gVals = [idMusician, ...input.genreIds];
    //   const gTuples = input.genreIds.map((_, i) => `($1, $${i + 2})`).join(", ");
    //   await client.query(
    //     `INSERT INTO ${MUSICIAN_GENRE_TABLE} ("idMusician", "idGenre") VALUES ${gTuples}`,
    //     gVals
    //   );
    // }

    return { idUserProfile, idMusician };
  });
}

export async function getMusiciansByDisplayName(name: string): Promise<MusicianRow[]> {
  const sql = `
    SELECT
      m."idMusician",
      up."displayName",
      up."bio",
      m."experienceYears",
      m."skillLevel",
      m."isAvailable",
      m."travelRadiusKm",
      m."visibility",
      m."birthDate",
      COALESCE(
        JSON_AGG(
          DISTINCT JSONB_BUILD_OBJECT(
            'idInstrument', i."idInstrument",
            'instrumentName', i."instrumentName",
            'isPrimary', mi."isPrimary"
          )
        ) FILTER (WHERE i."idInstrument" IS NOT NULL),
        '[]'::json
      ) AS instruments
    FROM ${USER_PROFILE_TABLE} up
    JOIN ${MUSICIAN_TABLE} m ON m."idUserProfile" = up."idUserProfile"
    LEFT JOIN ${MUSICIAN_INSTRUMENT_TABLE} mi ON mi."idMusician" = m."idMusician"
    LEFT JOIN ${INSTRUMENT_TABLE} i ON i."idInstrument" = mi."idInstrument"
    WHERE up."displayName" ILIKE $1
    GROUP BY
      m."idMusician", up."displayName", up."bio",
      m."experienceYears", m."skillLevel", m."isAvailable", m."travelRadiusKm", m."visibility", m."birthDate"
    ORDER BY up."displayName"
  `;
  const { rows } = await pool.query(sql, [`%${name}%`]);
  return rows.map((r) => ({ ...r, instruments: r.instruments ?? [] }));
}

/** ==============================================
 *  Buscar músicos por instrumento y nivel (filtros)
 *  ============================================== */
export async function searchMusiciansByInstrumentAndLevel(params: {
  instrumentId?: number; // si no viene, no filtra por instrumento
  skillLevel?: "beginner" | "intermediate" | "advanced" | "professional"; // opcional
  onlyAvailable?: boolean; // default false
  minExperienceYears?: number; // opcional
  limit?: number;
  offset?: number;
}): Promise<MusicianRow[]> {
  const where: string[] = [];
  const vals: any[] = [];
  let idx = 1;

  if (typeof params.instrumentId === "number") {
    where.push(`mi."idInstrument" = $${idx++}`);
    vals.push(params.instrumentId);
  }
  if (params.skillLevel) {
    where.push(`m."skillLevel" = $${idx++}`);
    vals.push(params.skillLevel);
  }
  if (params.onlyAvailable) {
    where.push(`m."isAvailable" = TRUE`);
  }
  if (typeof params.minExperienceYears === "number") {
    where.push(`COALESCE(m."experienceYears", 0) >= $${idx++}`);
    vals.push(params.minExperienceYears);
  }

  const whereSQL = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      m."idMusician",
      up."displayName",
      up."bio",
      m."experienceYears",
      m."skillLevel",
      m."isAvailable",
      m."travelRadiusKm",
      m."visibility",
      m."birthDate",
      COALESCE(
        JSON_AGG(
          DISTINCT JSONB_BUILD_OBJECT(
            'idInstrument', i."idInstrument",
            'instrumentName', i."instrumentName",
            'isPrimary', mi."isPrimary"
          )
        ) FILTER (WHERE i."idInstrument" IS NOT NULL),
        '[]'::json
      ) AS instruments
    FROM ${MUSICIAN_TABLE} m
    JOIN ${USER_PROFILE_TABLE} up ON up."idUserProfile" = m."idUserProfile"
    LEFT JOIN ${MUSICIAN_INSTRUMENT_TABLE} mi ON mi."idMusician" = m."idMusician"
    LEFT JOIN ${INSTRUMENT_TABLE} i ON i."idInstrument" = mi."idInstrument"
    ${whereSQL}
    GROUP BY
      m."idMusician", up."displayName", up."bio",
      m."experienceYears", m."skillLevel", m."isAvailable", m."travelRadiusKm", m."visibility", m."birthDate"
    ORDER BY up."displayName"
    ${typeof params.limit === "number" ? `LIMIT ${params.limit}` : ""}
    ${typeof params.offset === "number" ? `OFFSET ${params.offset}` : ""}
  `;

  const { rows } = await pool.query(sql, vals);
  return rows.map((r) => ({ ...r, instruments: r.instruments ?? [] }));
}