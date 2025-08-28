import { Instrument, Amenity, Genre } from "../models/directory.model.js"
import { CreateMusicianInput } from "../types/createMusicianInput.js";
import { LegacyReturn } from "../types/LegacyReturn.js";
import { CreatedMusician } from "../types/createdMusician.js";
import { CreateStudioInput } from "../types/createStudioInput.js";
import { MusicianProfileRow } from "../types/musicianRow.js";
import { pool, withTransaction } from "../config/database.js";
import { PoolClient } from "pg";

const INSTRUMENT_TABLE = `"Directory"."Instrument"`;
const MUSICIAN_TABLE = `"Directory"."Musician"`;
const USER_PROFILE_TABLE = `"Directory"."UserProfile"`;
const STUDIO_TABLE = `"Directory"."Studio"`;
const AMENITY_TABLE = `"Directory"."Amenity"`;
const GENRE_TABLE = `"Directory"."Genre"`;
const STUDIO_ROOM_TABLE = `"Directory"."StudioRoom"`;
const STUDIO_ROOM_EQUIPMENT_TABLE = `"Directory"."StudioRoomEquipment"`;
const STUDIO_AMENITY_TABLE = `"Directory"."StudioAmenity"`;
const MUSICIAN_INSTRUMENT_TABLE = `"Directory"."MusicianInstrument"`;

//Con transacciones
export async function createUserProfileTx(client: PoolClient, args: {
  idUser: number;
  displayName: string;
  bio?: string | null;
  idAddress?: number | null;
  latitude?: number | null;
  longitude?: number | null;
}): Promise<number> {
  const q = `
    INSERT INTO ${USER_PROFILE_TABLE}
      ("idUser","displayName","bio","idAddress","latitude","longitude")
    VALUES ($1,$2,$3,$4,$5,$6)
    RETURNING "idUserProfile"
  `;
  const { rows } = await client.query(q, [
    args.idUser,
    args.displayName,
    args.bio ?? null,
    args.idAddress ?? null,
    args.latitude ?? null,
    args.longitude ?? null,
  ]);
  return rows[0].idUserProfile as number;
}

export async function createMusicianTx(client: PoolClient, args: {
  idUserProfile: number;
  birthDate?: string | null;
  experienceYears?: number | null;
  skillLevel?: "beginner" | "intermediate" | "advanced" | "professional";
  isAvailable?: boolean;
  travelRadiusKm?: number | null;
  visibility?: "city" | "province" | "country" | "global";
  instruments: Array<{ idInstrument: number; isPrimary?: boolean }>;
}): Promise<number> {
  if (!args.instruments?.length) throw new Error("Debe especificar al menos un instrumento");

  const skill = args.skillLevel ?? "intermediate";
  const avail = args.isAvailable ?? true;
  const travel = args.travelRadiusKm ?? 10;
  const visibility = args.visibility ?? "city";

  const q = `
    INSERT INTO ${MUSICIAN_TABLE}
      ("idUserProfile","experienceYears","skillLevel","isAvailable","travelRadiusKm","visibility","birthDate")
    VALUES ($1,$2,$3,$4,$5,$6,$7)
    RETURNING "idMusician"
  `;
  const { rows } = await client.query(q, [
    args.idUserProfile,
    args.experienceYears ?? null,
    skill,
    avail,
    travel,
    visibility,
    args.birthDate ?? null,
  ]);
  const idMusician = rows[0].idMusician as number;

  // instrumentos
  const tuples = args.instruments.map((_, i) => `($1,$${i * 2 + 2},$${i * 2 + 3})`).join(", ");
  const params: any[] = [idMusician];
  args.instruments.forEach(it => params.push(it.idInstrument, !!it.isPrimary));
  await client.query(
    `INSERT INTO ${MUSICIAN_INSTRUMENT_TABLE} ("idMusician","idInstrument","isPrimary") VALUES ${tuples}`,
    params
  );

  return idMusician;
}

export async function createStudioTx(
  client: PoolClient,
  args: { idUserProfile: number; studio: CreateStudioInput }
): Promise<number> {
  const s = args.studio ?? {};
  const q = `
    INSERT INTO ${STUDIO_TABLE}
      ("idUserProfile","legalName","phone","website","isVerified","openingHours","cancellationPolicy")
    VALUES ($1,$2,$3,$4,false,$5,$6)
    RETURNING "idStudio"
  `;
  const { rows } = await client.query(q, [
    args.idUserProfile,
    s.legalName ?? null,
    s.phone ?? null,
    s.website ?? null,
    s.openingHours ?? null,      // jsonb
    s.cancellationPolicy ?? null
  ]);
  console.log(rows);
  return rows[0].idStudio as number;
}

export async function addStudioAmenitiesTx(
  client: PoolClient,
  args: { idStudio: number; amenityIds?: number[] | null }
): Promise<void> {
  const ids = (args.amenityIds ?? []).filter(n => Number.isFinite(n));
  if (!ids.length) return;
  console.log("add studioAmenitiesTx");
  const tuples = ids.map((_, i) => `($1,$${i + 2})`).join(", ");
  await client.query(
    `INSERT INTO ${STUDIO_AMENITY_TABLE} ("idStudio","idAmenity") VALUES ${tuples}
     ON CONFLICT DO NOTHING`,
    [args.idStudio, ...ids]
  );
}

export async function addStudioRoomsTx(
  client: PoolClient,
  args: {
    idStudio: number;
    rooms?: Array<{
      roomName: string;
      capacity?: number | null;
      hourlyPrice: number;
      notes?: string | null;
      equipment?: Record<string, any> | any[] | null;
    }> | null;
  }
): Promise<Array<{ idRoom: number; roomName: string }>> {
  const out: Array<{ idRoom: number; roomName: string }> = [];
  const rooms = args.rooms ?? [];
  if (!rooms.length) return out;

  for (const r of rooms) {
    if (!r?.roomName?.trim() || typeof r.hourlyPrice !== "number" || !Number.isFinite(r.hourlyPrice)) {
      throw new Error("Cada sala debe incluir roomName y hourlyPrice numérico.");
    }

    const insertRoom = `
      INSERT INTO ${STUDIO_ROOM_TABLE}
        ("idStudio","roomName","capacity","hourlyPrice","notes")
      VALUES ($1,$2,$3,$4,$5)
      RETURNING "idRoom"
    `;
    const { rows } = await client.query(insertRoom, [
      args.idStudio,
      r.roomName.trim(),
      (r.capacity ?? null),
      r.hourlyPrice,
      (r.notes ?? null)
    ]);
    const idRoom = rows[0].idRoom as number;

    const eq = r.equipment;
    const hasEquipment =
      Array.isArray(eq) ? eq.length > 0 :
        eq && typeof eq === "object" ? Object.keys(eq).length > 0 :
          false;

    if (hasEquipment) {
      await client.query(
        `INSERT INTO ${STUDIO_ROOM_EQUIPMENT_TABLE} ("idRoom","equipment") VALUES ($1, $2::jsonb)`,
        [idRoom, JSON.stringify(eq)] 
      );
    }

    out.push({ idRoom, roomName: r.roomName });
  }

  return out;
}

//sin tx
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
        [idMusician, false, null, null, 100, 0]
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

export async function getGenres(): Promise<Genre | null> {
  const query = `Select "idGenre", "genreName" FROM ${GENRE_TABLE}`
  try {
    const result = await pool.query(query);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return row;
  } catch (err) {
    console.error("Error en getGenres", err);
    throw err;
  }
}

export async function createMusician(input: CreateMusicianInput): Promise<CreatedMusician> {
  if (!input.instruments?.length) {
    throw new Error("Debe especificar al menos un instrumento");
  }

  const m = input.musician ?? {};
  const skill = m.skillLevel ?? "intermediate";
  const avail = m.isAvailable ?? true;
  const travel = m.travelRadiusKm ?? 10;
  const visibility = m.visibility ?? "city";

  return withTransaction(async (client) => {

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