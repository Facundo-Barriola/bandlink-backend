import { Instrument, Amenity, Genre } from "../models/directory.model.js"
import { CreateMusicianParams } from "../types/createMusicianParams.js";
import { LegacyReturn } from "../types/LegacyReturn.js";
import { MusicianProfileRow } from "../types/musicianRow.js";
import { StudioProfileRow, StudioMini } from "../types/studioProfileRow.js";
import { UpdateStudioProfileResult, UpdateStudioProfilePatch } from "../types/UpdateStudioProfile.js";
import { CreateStudioParams } from "../types/createStudioParams.js";
import { EditStudioRoomParams, StudioRoom } from "../types/editStudioRoomParams.js";
import { pool } from "../config/database.js";
import { PoolClient } from "pg";

const INSTRUMENT_TABLE = `"Directory"."Instrument"`;
const AMENITY_TABLE = `"Directory"."Amenity"`;
const GENRE_TABLE = `"Directory"."Genre"`;

export async function updateStudioProfileByOwner(
  userId: number,
  studioId: number,
  patch: UpdateStudioProfilePatch
): Promise<UpdateStudioProfileResult> {
  const sql = `SELECT * FROM "Directory".fn_update_studio_profile($1::int,$2::int,$3::jsonb);`;
  const params = [userId, studioId, patch ?? {}];
  const { rows } = await pool.query(sql, params);
  if (!rows?.length) {
    const err = new Error("update_studio_no_response");
    (err as any).code = "update_studio_no_response";
    throw err;
  }
  const r = rows[0] as any;
  if (r.ok !== true) {
    const err = new Error(r.info || "update_studio_failed");
    (err as any).code = r.info || "update_studio_failed";
    throw err;
  }

  const nz = (a: any, b: any) => (a !== undefined ? a : b);

  return {
    ok: true,
    info: "updated",
    idStudio: Number(nz(r.idStudio, r.idstudio)),
    displayName: nz(r.displayName, r.displayname),
    bio: r.bio ?? null,
    legalName: nz(r.legalName, r.legalname) ?? null,
    phone: r.phone ?? null,
    website: r.website ?? null,
    cancellationPolicy: nz(r.cancellationPolicy, r.cancellationpolicy) ?? null,
    openingHours: nz(r.openingHours, r.openinghours) ?? null,
    amenities: r.amenities ?? null,
  };
}
export async function editRoomByOwner(
  userId: number,
  roomId: number,
  fields: EditStudioRoomParams
): Promise<StudioRoom> {
  const {
    roomName = null,
    capacity = null,
    hourlyPrice = null,
    notes = null,
    equipment = null,
  } = fields;

  const sql = `
      SELECT ok, info,
             "idRoom", "idStudio", "roomName", capacity, "hourlyPrice", notes, equipment
      FROM "Directory".edit_studio_room($1,$2,$3,$4,$5,$6,$7)
    `;

  const params = [
    userId,        // $1 p_user_id
    roomId,        // $2 p_room_id
    roomName,      // $3 p_room_name
    capacity,      // $4 p_capacity
    hourlyPrice,   // $5 p_hourly_price
    notes,         // $6 p_notes
    equipment,     // $7 p_equipment (jsonb)
  ];

  const { rows } = await pool.query(sql, params);
  if (rows.length === 0) {
    throw new Error("edit_room_no_response");
  }

  const r = rows[0] as {
    ok: boolean;
    info: string | null;
    idRoom: number | null;
    idStudio: number | null;
    roomName: string | null;
    capacity: number | null;
    hourlyPrice: string | number | null;
    notes: string | null;
    equipment: any | null;
  };

  if (!r.ok) {
    const code = r.info ?? "edit_failed";
    const err = new Error(code);
    (err as any).code = code;
    throw err;
  }

  // Normalizar numeric -> number
  const priceNum =
    typeof r.hourlyPrice === "string"
      ? parseFloat(r.hourlyPrice)
      : (r.hourlyPrice ?? 0);

  return {
    idRoom: Number(r.idRoom),
    idStudio: Number(r.idStudio),
    roomName: r.roomName ?? "",
    capacity: r.capacity === null ? null : Number(r.capacity),
    hourlyPrice: priceNum,
    notes: r.notes,
    equipment: r.equipment ?? null,
  };
}

export async function updateMusicianProfile(idUser: number, displayName: string | null, bio: string | null, isAvailable: boolean | null,
  experienceYears: number | null, skillLevel: string | null, travelRadiusKm: number | null, visibility: string | null, birthDate: Date | string | null,
  instruments: Array<{ idInstrument: number; isPrimary?: boolean }> | null | undefined, genres: Array<{ idGenre: number }> | null | undefined
) {
  const client = await pool.connect();
  try {
    const birthDateParam =
      birthDate == null ? null
        : typeof birthDate === "string" ? birthDate
          : birthDate.toISOString().slice(0, 10); // yyyy-mm-dd

    const instrumentsJson =
      instruments === undefined ? null : JSON.stringify(instruments ?? []);
    const genresJson =
      genres === undefined ? null : JSON.stringify(genres ?? []);
    const toNull = <T>(v: T | undefined | null) => v == null ? null : v;
    const toNullIfEmpty = (v: string | null | undefined) =>
      v == null ? null : (v.trim() === "" ? null : v);
    const sql = `
      SELECT ok, "outIdMusician", updated_at
      FROM "Directory".fn_update_musician_profile(
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10::jsonb, $11::jsonb
      )`;
    const values = [
      idUser,
      toNullIfEmpty(displayName),
      toNullIfEmpty(bio),
      toNull(isAvailable),
      toNull(experienceYears),
      toNullIfEmpty(skillLevel),
      toNull(travelRadiusKm),
      toNullIfEmpty(visibility),
      birthDateParam,
      instrumentsJson,
      genresJson,
    ];

    const { rows } = await client.query(sql, values);
    console.log("updateMusicianProfile params:", {
      idUser,
      displayName,
      bio,
      isAvailable,
      experienceYears,
      skillLevel,
      travelRadiusKm,
      visibility,
      birthDateParam,
      instrumentsJson,
      genresJson,
    });
    console.log(rows[0])
    return rows[0];
  } catch (err) {
    console.log("Error en updateMusicianProfile()", err);
    throw err;
  } finally {
    client.release();
  }
}
export async function getMusicianProfileByUser(idUser: number): Promise<{ legacy: LegacyReturn, musicianProfile: MusicianProfileRow | null } | null> {
  const client = await pool.connect();
  try {
    const profile = await client.query(
      `SELECT * FROM "Directory".fn_get_musician_profile($1)`,
      [idUser]
    );

    const row = profile.rows[0];
    if (!row) return null;

    const idUserProfile = row.iduserprofile as number;
    const idMusician = row.idmusician as number | null;

    const instruments = idMusician
      ? (await client.query(
        `
       SELECT
        idinstrument   AS "idInstrument",
        instrumentname AS "instrumentName",
        isprimary      AS "isPrimary"
      FROM "Directory".fn_get_musician_instruments($1)
      `,
        [idMusician]
      )).rows
      : [];

    const genres = idMusician
      ? (await client.query(
        `
          SELECT
            idgenre   AS "idGenre",
            genrename AS "genreName"
          FROM "Directory".fn_get_musician_genres($1)
          `,
        [idMusician]
      )).rows
      : [];

    const bands = idMusician
      ? (await client.query(
        `
          SELECT
           b."idBand",
           b."name",
           b."description",
           b."createdAt",
           b."updatedAt",
           b."roleInBand",
           b."isAdmin",
           b."joinedAt",
           b."leftAt",
           b."genres"
          FROM "Directory".fn_get_bands_of_musician($1) AS b
          `,
        [idMusician]
      )).rows
      : [];

    const events = idMusician
      ? (await client.query(
        `
          SELECT
            e."idEvent",
            e."name",
            e."description",
            e."visibility",
            e."capacityMax",
            e."idAddress",
            e."latitude",
            e."longitude",
            e."startsAt",
            e."endsAt",
            e."createdAt",
            e."updatedAt"
          FROM "Directory".fn_get_events_created_by_musician($1, $2, $3, $4, $5, $6) AS e
          `,
        [idUser, false, null, null, 100, 0]
      )).rows
      : [];
    const toNum = (v: any) =>
      v == null ? null : (typeof v === "string" ? Number(v) : v);
    const legacy: LegacyReturn = {
      user: {
        idUser: row.iduser,
        idUserProfile,
        displayName: row.displayname,
        bio: row.bio,
        avatarUrl: row.avatarurl,
        latitude: row.latitude?.toString?.() ?? row.latitude ?? null,
        longitude: row.longitude?.toString?.() ?? row.longitude ?? null,
      },
      musician: idMusician
        ? {
          idMusician,
          experienceYears: row.experienceyears,
          skillLevel: row.skilllevel,
          isAvailable: row.isavailable,
          travelRadiusKm: row.travelradiuskm,
          visibility: row.visibility,
          birthDate: row.birthdate,
          instruments,
          genres,
        }
        : null,
      bands,
      eventsCreated: events,
    };
    const now = new Date();
    const eventsUpcoming = events.filter(
      (e) => e.startsAt && new Date(e.startsAt) >= now
    );
    const eventsUpcomingCount = eventsUpcoming.length;
    const eventsPastCount = events.length - eventsUpcomingCount;
    const musicianProfile: MusicianProfileRow | null = idMusician
      ? {
        idMusician,
        idUserProfile,
        displayName: row.displayname ?? null,
        bio: row.bio ?? null,
        avatarUrl: row.avatarurl ?? null,
        experienceYears: row.experienceyears ?? null,
        skillLevel: row.skilllevel ?? null,
        isAvailable: row.isavailable ?? null,
        travelRadiusKm: row.travelradiuskm ?? null,
        visibility: row.visibility ?? null,
        birthDate: row.birthdate ?? null,
        latitude: toNum(row.latitude),
        longitude: toNum(row.longitude),
        instruments,
        genres,
        bands,
        eventsUpcoming: eventsUpcoming,
        eventsUpcomingCount,
        eventsPastCount,
      }
      : null;
    return { legacy, musicianProfile };
  } finally {
    client.release();
  }
}

export async function getStudioByName(name: string, limit = 8): Promise<StudioMini[]> {
    const sql = `
    SELECT "idUser","idUserProfile","idStudio","displayName"
    FROM "Directory".fn_get_studios_by_display_name($1, $2)
  `;
  const params = [name ?? "", limit ?? 8];
       
  try {
    const { rows } = await pool.query<StudioMini>(sql, params);
    return rows;
  } catch (err) {
    console.error("Error en getStudiosByName()", err);
    throw err;
  }
}

type UserLite = { idUser: number; displayName: string; avatarUrl: string | null };
export async function getUsersByIds(ids: number[]): Promise<UserLite[]> {
  if (!ids.length) return [];
  const sql = `
    select u."idUser",
           coalesce(up."displayName", u."email") as "displayName",
           up."avatarUrl"
      from "Security"."User" u
 left join "Directory"."UserProfile" up on up."idUser" = u."idUser"
     where u."idUser" = any($1::int[])
  `;
  const { rows } = await pool.query<UserLite>(sql, [ids]);
  return rows;
}

export async function getStudioIdByUserID(idUser: number): Promise<number | null> {
  try{
    const { rows } = await pool.query(`Select s."idStudio"
    From "Directory"."Studio" s
    INNER JOIN "Directory"."UserProfile" AS up 
    ON up."idUserProfile" = s."idUserProfile"
    INNER JOIN "Security"."User" AS u
    ON u."idUser" = up."idUser"
    WHERE u."idUser" = ${idUser};`);
  return rows?.length ? rows[0].idStudio : null;
  }catch(err){
    console.log("Error en getStudioIdByUserID()", err);
    throw err;
  }
  
}

export async function getAmenities(): Promise<Amenity[]> {
  const query = `SELECT "idAmenity", "amenityName" FROM ${AMENITY_TABLE}`;
  try {
    const result = await pool.query(query);
    return result.rows;
  } catch (err) {
    console.log("Error en getAmenities()", err);
    throw err;
  }
}

export async function getInstruments(): Promise<Instrument[]> {
  const { rows } = await pool.query(`SELECT "idInstrument", "instrumentName" FROM ${INSTRUMENT_TABLE} ORDER BY "instrumentName"`);
  return rows;
}


export async function getInstrumentById(idInstrument: number): Promise<Instrument | null> {
  const query = `"SELECT "idInstrument", "instrumentName" FROM ${INSTRUMENT_TABLE} WHERE "IdInstrument" = $1"`
  const values = [idInstrument];
  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return row;
  } catch (err) {
    console.error("Error en getInstrumentById:", err);
    throw err;
  }
}

export async function getGenres(): Promise<Genre[]> {
  const query = `Select "idGenre", "genreName" FROM ${GENRE_TABLE}`
  try {
    const { rows } = await pool.query(query);
    return rows
  } catch (err) {
    console.error("Error en getGenres", err);
    throw err;
  }
}

export async function searchMusiciansByName(
  name: string,
  genres?: string[],
  limit = 8,
  offset = 0
) {

  const params = [
    name,
    (genres && genres.length) ? genres : null,
    limit,
    offset,
  ];
  const sql = `SELECT * FROM "Directory".fn_get_musicians_by_display_name($1, $2)AS f
    JOIN "Directory"."UserProfile" up
      ON up."idUserProfile" = f."idUserProfile"
    ORDER BY f."displayName"
    LIMIT $3 OFFSET $4`;
  const { rows } = await pool.query(sql, params);

  return rows.map((r: any) => ({
    idMusician: r.idMusician,
    idUser: r.idUser,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl,
    instruments: (r.instruments ?? []).map?.((x: any) => x.instrumentName) ?? [],
    genres: (r.genres ?? []).map?.((x: any) => x.genreName) ?? [],
  }));
}

export async function searchMusiciansByInstrumentAndLevel(params: {
  instrumentId?: number;
  skillLevel?: "beginner" | "intermediate" | "advanced" | "professional";
  onlyAvailable?: boolean;
  minExperienceYears?: number;
  limit?: number;
  offset?: number;
}): Promise<MusicianProfileRow[]> {
  const sql = `SELECT * FROM "Directory".fn_search_musicians_by_instr_or_level($1,$2,$3,$4,$5,$6)`;
  const values = [
    params.instrumentId ?? null,
    params.skillLevel ?? null,
    params.onlyAvailable ?? false,
    params.minExperienceYears ?? null,
    params.limit ?? 50,
    params.offset ?? 0,
  ];
  const { rows } = await pool.query(sql, values);

  return rows.map((r: any) => ({
    ...r,
    instruments: r.instruments ?? [],
    genres: r.genres ?? [],
    bands: r.bands ?? [],
    eventsUpcoming: r.eventsupcoming ?? r.eventsUpcoming ?? [],
  }));
}

export async function getStudioProfileByUser(idUser: number) {
  const { rows } = await pool.query(
    `SELECT * FROM "Directory".fn_get_studio_profile($1)`,
    [idUser]
  );
  const r = rows[0];
  if (!r) return null;

  // normalización de lat/long a string (consistente con músico)
  const lat = r.latitude?.toString?.() ?? r.latitude ?? null;
  const lng = r.longitude?.toString?.() ?? r.longitude ?? null;

  const studio = {
    idStudio: r.idStudio,
    legalName: r.legalName,
    phone: r.phone,
    website: r.website,
    isVerified: r.isVerified,
    openingHours: r.openingHours ?? null,
    cancellationPolicy: r.cancellationPolicy ?? null,
  };

  return {
    userData: {
      idUser: r.idUser,
      idUserProfile: r.idUserProfile,
      displayName: r.displayName,
      bio: r.bio,
      avatarUrl: r.avatarUrl,
      idAddress: r.idAddress,
      latitude: lat,
      longitude: lng,
      address: r.address ?? {},
    },
    studio,
    amenities: r.amenities ?? [],
    rooms: r.rooms ?? [],
    amenityCount: Number(r.amenityCount ?? 0),
    roomCount: Number(r.roomCount ?? 0),
    eventsAtStudio: r.eventsatstudio ?? [],
    eventsUpcomingCount: Number(r.eventsupcomingcount ?? 0),
    eventsPastCount: Number(r.eventspastcount ?? 0),
  } as const;
}

export async function getStudioProfileById(idStudio: number) {
  const { rows } = await pool.query(
    `SELECT * FROM "Directory".fn_get_studio_profile_by_id($1)`,
    [idStudio]
  );
  const r = rows[0];
  if (!r) return null;

  const lat = r.latitude?.toString?.() ?? r.latitude ?? null;
  const lng = r.longitude?.toString?.() ?? r.longitude ?? null;

  return {
    userData: {
      idUser: r.idUser,
      idUserProfile: r.idUserProfile,
      displayName: r.displayName,
      bio: r.bio,
      avatarUrl: r.avatarUrl,
      idAddress: r.idAddress,
      latitude: lat,
      longitude: lng,
      address: r.address ?? {},
    },
    studio: {
      idStudio: r.idStudio,
      legalName: r.legalName,
      phone: r.phone,
      website: r.website,
      isVerified: r.isVerified,
      openingHours: r.openingHours ?? null,
      cancellationPolicy: r.cancellationPolicy ?? null,
    },
    amenities: r.amenities ?? [],
    rooms: r.rooms ?? [],
    amenityCount: Number(r.amenityCount ?? 0),
    roomCount: Number(r.roomCount ?? 0),
    eventsAtStudio: r.eventsatstudio ?? [],
    eventsUpcomingCount: Number(r.eventsupcomingcount ?? 0),
    eventsPastCount: Number(r.eventspastcount ?? 0),
  } as const;
}

export async function createMusicianProfileTx(client: PoolClient, p: CreateMusicianParams) {
  console.log("params", p);
  const birthDate =
    p.birthDate == null
      ? null
      : typeof p.birthDate === "string"
        ? p.birthDate.slice(0, 10)
        : p.birthDate.toISOString().slice(0, 10);

  const sql = `
    SELECT ok, "idUser", "idUserProfile", "idMusician", created_at
    FROM "Directory".fn_create_musician_profile(
      $1::int,       $2::text,   $3::text,   $4::int,
      $5::numeric,   $6::numeric,
      $7::smallint,  $8::text,   $9::boolean,
      $10::smallint, $11::text,  $12::date,
      $13::jsonb,    $14::jsonb
    )`;
  const values = [
    p.idUser,
    p.displayName,
    p.bio ?? null,
    p.idAddress ?? null,
    p.latitude ?? null,
    p.longitude ?? null,
    p.experienceYears ?? null,
    p.skillLevel ?? "intermediate",
    p.isAvailable ?? true,
    p.travelRadiusKm ?? 10,
    p.visibility ?? "city",
    birthDate,
    JSON.stringify(p.instruments ?? []),
    JSON.stringify(p.genres ?? []),
  ];
  const { rows } = await client.query(sql, values);
  return rows[0] as { ok: boolean; idUser: number; idUserProfile: number; idMusician: number; created_at: string };
}

export async function createStudioProfileTx(client: PoolClient, p: CreateStudioParams) {
  const sql = `
    SELECT ok, "idUser", "idUserProfile", "idStudio", created_at
    FROM "Directory".fn_create_studio_profile(
      $1,$2,$3,$4,$5,$6,
      $7,$8,$9,$10,$11::jsonb,$12,
      $13::jsonb,$14::jsonb
    )`;
  const values = [
    p.idUser,
    p.displayName,
    p.bio ?? null,
    p.idAddress ?? null,
    p.latitude ?? null,
    p.longitude ?? null,

    p.legalName ?? null,
    p.phone ?? null,
    p.website ?? null,
    p.isVerified ?? false,
    p.openingHours ? JSON.stringify(p.openingHours) : null,
    p.cancellationPolicy ?? null,

    JSON.stringify(p.amenities ?? []),
    JSON.stringify(p.rooms ?? []),
  ];

  const { rows } = await client.query(sql, values);
  return rows[0] as { ok: boolean; idUser: number; idUserProfile: number; idStudio: number; created_at: string };
}