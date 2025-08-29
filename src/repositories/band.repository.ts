import { pool, withTransaction } from "../config/database.js";

/** ---- Tipos de entrada ---- */

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

export class BandRepository {

  static async createBand(input: CreateBandInput): Promise<CreateBandResult> {
    const sql = `
      SELECT ok, "idBand", created_at
      FROM "Directory".fn_create_band($1::text, $2::text, $3::jsonb, $4::jsonb)
    `;
    const params = [
      input.name,
      input.description ?? null,
      JSON.stringify(input.genres ?? []),
      JSON.stringify(input.members ?? []),
    ];

    try {
      const { rows } = await pool.query(sql, params);
      if (!rows.length) throw Object.assign(new Error("Sin resultado de fn_create_band"), { code: "NO_RESULT" });
      return rows[0] as CreateBandResult;
    } catch (err: any) {

      if (err.code === "23505") {
        err.httpStatus = 409; // Conflict (nombre duplicado)
      } else if (err.code === "23503") {
        err.httpStatus = 400; // Bad Request (FK inválida)
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
        err.httpStatus = 409; // nombre duplicado
      } else if (err.code === "02000") {
        err.httpStatus = 404; // banda no existe
      } else if (err.code === "23503") {
        err.httpStatus = 400; // FK inválida
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
}


