import { pool, withTransaction } from "../config/database.js";

export type BandGenreInput = { idGenre: number };

export type BandMemberInput = {
  idMusician: number;
  roleInBand?: string | null;
  isAdmin?: boolean;
  joinedAt?: string | null;
  leftAt?: string | null;
};

export type CreateBandInput = {
  name: string;
  description?: string | null;
  creatorMusicianId?: number | null;
  genres?: BandGenreInput[];
  members?: BandMemberInput[];
};

export type UpdateBandInput = {
  idBand: number;
  name?: string | null;
  description?: string | null;
  genres?: BandGenreInput[] | null;
  members?: BandMemberInput[] | null;
};

export type CreateBandResult = {
  ok: boolean;
  idBand: number;
  created_at: string;
};

export type UpdateBandResult = {
  ok: boolean;
  idBand: number;
  updated_at: string;
};

export type DeleteBandResult = {
  ok: boolean;
  deleted_band: number;
};

export type GetBandResult = any;

export type BandSearchInsert = {
  idBand: number;
  title: string;
  description?: string | null;
  idInstrument?: number | null;
  minSkillLevel?: string | null;
  isRemote?: boolean;
  idAddress?: number | null;
  latitude?: number | null;
  longitude?: number | null;
};

export type BandHit = { idBand: number; idUserProfile: number | null; name: string };

export async function getMusicianIdByUserId(idUser: number): Promise<number | null> {
  const q = `
    SELECT m."idMusician"
    FROM "Directory"."Musician" m
    JOIN "Directory"."UserProfile" up ON up."idUserProfile" = m."idUserProfile"
    WHERE up."idUser" = $1
  `;
  const { rows } = await pool.query(q, [idUser]);
  return rows[0]?.idMusician ?? null;
}

export async function isBandAdmin(idBand: number, idMusician: number): Promise<boolean> {
  const q = `
    SELECT bm."isAdmin"
    FROM "Directory"."BandMember" bm
    WHERE bm."idBand" = $1 AND bm."idMusician" = $2 AND bm."leftAt" IS NULL
  `;
  const { rows } = await pool.query(q, [idBand, idMusician]);
  return Boolean(rows[0]?.isAdmin);
}

export async function insertBandSearch(payload: BandSearchInsert) {
  const {
    idBand, title, description = null,
    idInstrument = null, minSkillLevel = null,
    isRemote = false, idAddress = null, latitude = null, longitude = null,
  } = payload;

  const q = `
    INSERT INTO "Directory"."BandMusicianSearch"
      ("idBand", title, description, "idInstrument", "minSkillLevel", "isRemote",
       "idAddress", latitude, longitude)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
    RETURNING *
  `;
  const params = [idBand, title, description, idInstrument, minSkillLevel, isRemote, idAddress, latitude, longitude];
  const { rows } = await pool.query(q, params);
  return rows[0];
}

export async function listBandSearches(idBand: number) {
  const q = `
    SELECT *
    FROM "Directory"."BandMusicianSearch"
    WHERE "idBand" = $1
    ORDER BY "createdAt" DESC
  `;
  const { rows } = await pool.query(q, [idBand]);
  return rows;
}

export async function deactivateSearch(idSearch: number, idBand: number) {
  const q = `
    UPDATE "Directory"."BandMusicianSearch"
    SET "isActive" = FALSE, "updatedAt" = NOW()
    WHERE "idSearch" = $1 AND "idBand" = $2
    RETURNING *
  `;
  const { rows } = await pool.query(q, [idSearch, idBand]);
  return rows[0] ?? null;
}

export class BandRepository {

  static async getBandsByName(name: string, limit = 8) {
    const SQL_SEARCH_BANDS = `
       SELECT
        b."idBand",
        b."name",
        admin1."idUser" AS "idUserAdmin"
      FROM "Directory"."Band" AS b
      LEFT JOIN LATERAL (
        SELECT up."idUser"
        FROM "Directory"."BandMember" bm
        JOIN "Directory"."Musician"   m  ON m."idMusician"     = bm."idMusician"
        JOIN "Directory"."UserProfile" up ON up."idUserProfile" = m."idUserProfile"
        WHERE bm."idBand"  = b."idBand"
          AND bm."isAdmin" = TRUE
        LIMIT 1
      ) AS admin1 ON TRUE
      WHERE b."name" ILIKE $1
      ORDER BY b."name" ASC
      LIMIT $2;
      `;
    const { rows } = await pool.query(SQL_SEARCH_BANDS, [name, limit]);
    console.log(rows);

    return rows as BandHit[];
  }

  static async createBand(input: CreateBandInput): Promise<CreateBandResult> {
    const sql = `
      SELECT ok, "idBand", created_at
      FROM "Directory".fn_create_band($1::text, $2::text, $3::int ,$4::jsonb, $5::jsonb)
    `;
    const params = [
      input.name,
      input.description ?? null,
      input.creatorMusicianId ?? null,
      JSON.stringify(input.genres ?? []),
      JSON.stringify(input.members ?? []),
    ];

    try {
      const { rows } = await pool.query(sql, params);
      if (!rows.length) throw Object.assign(new Error("Sin resultado de fn_create_band"), { code: "NO_RESULT" });
      return rows[0] as CreateBandResult;
    } catch (err: any) {

      if (err.code === "23505") {
        err.httpStatus = 409;
      } else if (err.code === "23503") {
        err.httpStatus = 400;
      }
      throw err;
    }
  }

  static async updateBand(input: UpdateBandInput): Promise<UpdateBandResult> {
    const sql = `
      SELECT ok, "idBand", updated_at
      FROM "Directory".fn_update_band(
        $1::int,
        $2::text,
        $3::text,
        $4::jsonb,  -- NULL = no tocar
        $5::jsonb   -- NULL = no tocar
      )
    `;

    const params = [
      input.idBand,
      input.name ?? null,
      input.description ?? null,
      input.genres === undefined ? null : JSON.stringify(input.genres ?? []),
      input.members === undefined ? null : JSON.stringify(input.members ?? []),
    ];

    try {
      const { rows } = await pool.query(sql, params);
      if (!rows.length) throw Object.assign(new Error("Sin resultado de fn_update_band"), { code: "NO_RESULT" });
      return rows[0] as UpdateBandResult;
    } catch (err: any) {
      if (err.code === "23505") {
        err.httpStatus = 409;
      } else if (err.code === "02000") {
        err.httpStatus = 404;
      } else if (err.code === "23503") {
        err.httpStatus = 400;
      }
      throw err;
    }
  }

  static async deleteBand(idBand: number): Promise<DeleteBandResult> {
    const sql = `
      SELECT ok, deleted_band
      FROM "Directory".fn_delete_band($1::int)
    `;
    try {
      const { rows } = await pool.query(sql, [idBand]);
      if (!rows.length) throw Object.assign(new Error("Sin resultado de fn_delete_band"), { code: "NO_RESULT" });
      return rows[0] as DeleteBandResult;
    } catch (err: any) {
      if (err.code === "02000") {
        err.httpStatus = 404; // no existe
      }
      throw err;
    }
  }

  static async getBand(idBand: number): Promise<GetBandResult> {
    const sql = `
      SELECT "Directory".fn_get_band($1::int) AS band
    `;
    try {
      const { rows } = await pool.query(sql, [idBand]);
      if (!rows.length || !rows[0].band) {
        const e = new Error("Banda no encontrada");
        (e as any).httpStatus = 404;
        throw e;
      }
      return rows[0].band as GetBandResult;
    } catch (err: any) {
      if (err.code === "02000") {
        err.httpStatus = 404;
      }
      throw err;
    }
  }

  static async getBandSearches(idBand: number) {
    const sql = `SELECT "idSearch", "idBand", title, description, "minSkillLevel" FROM "Directory"."BandMusicianSearch"
    WHERE idBand = $1 `;
    const { rows } = await pool.query(sql, [idBand]);
    if (!rows.length) {
      const e = new Error("Busquedas no encontradas");
      (e as any).httpStatus = 404;
      throw e;
    }
    return rows;
  }
}

export async function getAdminUserId(idBand: number): Promise<number | null> {
  const sql = `
      SELECT up."idUser" AS "idUserAdmin"
      FROM "Directory"."BandMember" bm
      JOIN "Directory"."Musician"    m  ON m."idMusician" = bm."idMusician"
      JOIN "Directory"."UserProfile" up ON up."idUserProfile" = m."idUserProfile"
      WHERE bm."idBand"  = $1
        AND bm."isAdmin" = TRUE
      ORDER BY bm."joinedAt" ASC NULLS LAST
      LIMIT 1;
    `;
  const { rows } = await pool.query(sql, [idBand]);
  return rows[0]?.idUserAdmin ?? null;
}
export async function getBandAdminUserIds(idBand: number): Promise<number[]> {
  const sql = `
    SELECT up."idUser" AS "idUserAdmin"
    FROM "Directory"."BandMember" bm
    JOIN "Directory"."Musician"    m  ON m."idMusician" = bm."idMusician"
    JOIN "Directory"."UserProfile" up ON up."idUserProfile" = m."idUserProfile"
    WHERE bm."idBand" = $1
      AND bm."isAdmin" = TRUE
      AND bm."leftAt" IS NULL
  `;
  const { rows } = await pool.query(sql, [idBand]);
  return rows.map(r => r.idUserAdmin).filter((x: number | null) => typeof x === "number") as number[];
}

export async function getAllBandsByAdminId(idUser: number) {
  const sql = `
    SELECT b."idBand", b."name"
    FROM "Directory"."Band" AS b
    JOIN "Directory"."BandMember" AS bm ON bm."idBand" = b."idBand"
    JOIN "Directory"."Musician" AS m ON m."idMusician" = bm."idMusician"
    JOIN "Directory"."UserProfile" AS up ON up."idUserProfile" = m."idUserProfile"
    WHERE bm."isAdmin" = true AND up."idUser" = $1
    ORDER BY b."name";
  `;
  const { rows } = await pool.query(sql, [Number(idUser)]);
  return rows;
}

export async function isBandMember(idBand: number, idMusician: number): Promise<boolean> {
  const sql = `
    SELECT 1
    FROM "Directory"."BandMember"
    WHERE "idBand" = $1
      AND "idMusician" = $2
      AND "leftAt" IS NULL
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [idBand, idMusician]);
  return !!rows[0];
}

export async function isFollowingByUser(idBand: number, idUser: number): Promise<boolean> {
  const sql = `
    SELECT 1
    FROM "Directory"."BandFollow"
    WHERE "idBand" = $1
      AND "idUser" = $2
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [idBand, idUser]);
  return !!rows[0];
}

export async function followByUser(idBand: number, idUser: number): Promise<boolean> {
  const sql = `
    INSERT INTO "Directory"."BandFollow" ("idBand","idUser")
    VALUES ($1,$2)
    ON CONFLICT DO NOTHING
    RETURNING 1
  `;
  const { rows } = await pool.query(sql, [idBand, idUser]);
  return !!rows[0];
}

export async function unfollowByUser(idBand: number, idUser: number): Promise<void> {
  const sql = `
    DELETE FROM "Directory"."BandFollow"
    WHERE "idBand" = $1 AND "idUser" = $2
  `;
  await pool.query(sql, [idBand, idUser]);
}

export async function getBandName(idBand: number): Promise<string | null> {
  const sql = `SELECT "name" FROM "Directory"."Band" WHERE "idBand" = $1`;
  const { rows } = await pool.query(sql, [idBand]);
  return rows[0]?.name ?? null;
}

export async function insertNotificationsForUsers(
  userIds: number[],
  type: string,
  title: string,
  body: string | null,
  data?: any,
  channel = "push"
): Promise<void> {
  if (!userIds?.length) return;
  const sql = `
    INSERT INTO "Notification"."Notification" ("idUser", "type", "title", "body", "data", "channel", "createdat")
    SELECT unnest($1::int[]), $2, $3, $4, $5::jsonb, $6, NOW()
  `;
   const params = [
    userIds,
    type,
    title,
    body ?? null,
    JSON.stringify(data ?? {}),
    channel,
  ];
  await pool.query(sql, params);
}