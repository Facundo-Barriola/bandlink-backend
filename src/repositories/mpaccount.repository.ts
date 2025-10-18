import { pool } from "../config/database.js";

export type MpAccountRow = {
  idMpAccount: number;
  idStudio: number;
  mp_user_id: number;
  public_key: string | null;
  access_token: string;
  refresh_token: string;
  scope: string | null;
  live_mode: boolean;
  token_expires_at: string | null; // ISO
  createdAt: string;
  updatedAt: string;
};

export async function getMpAccountByStudioId(idStudio: number): Promise<MpAccountRow | null> {
  const q = `
    SELECT * FROM "Billing"."MpAccount"
    WHERE "idStudio" = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [idStudio]);
  return rows[0] ?? null;
}

export async function upsertMpAccount(params: {
  idStudio: number;
  mp_user_id: number;
  public_key?: string | null;
  access_token: string;
  refresh_token: string;
  scope?: string | null;
  live_mode: boolean;
  token_expires_at?: Date | null;
}): Promise<MpAccountRow> {
  const q = `
    INSERT INTO "Billing"."MpAccount"
      ("idStudio","mp_user_id","public_key","access_token","refresh_token","scope","live_mode","token_expires_at","createdAt","updatedAt")
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8, now(), now())
    ON CONFLICT ("idStudio") DO UPDATE SET
      "mp_user_id" = EXCLUDED."mp_user_id",
      "public_key" = EXCLUDED."public_key",
      "access_token" = EXCLUDED."access_token",
      "refresh_token" = EXCLUDED."refresh_token",
      "scope" = EXCLUDED."scope",
      "live_mode" = EXCLUDED."live_mode",
      "token_expires_at" = EXCLUDED."token_expires_at",
      "updatedAt" = now()
    RETURNING *;
  `;
  const vals = [
    params.idStudio,
    params.mp_user_id,
    params.public_key ?? null,
    params.access_token,
    params.refresh_token,
    params.scope ?? null,
    !!params.live_mode,
    params.token_expires_at ? params.token_expires_at.toISOString() : null,
  ];
  const { rows } = await pool.query(q, vals);
  return rows[0];
}

export async function updateTokensByStudioId(idStudio: number, tokens: {
  access_token: string;
  refresh_token: string;
  scope?: string | null;
  live_mode: boolean;
  token_expires_at?: Date | null;
}) {
  const q = `
    UPDATE "Billing"."MpAccount"
    SET "access_token" = $2,
        "refresh_token" = $3,
        "scope" = $4,
        "live_mode" = $5,
        "token_expires_at" = $6,
        "updatedAt" = now()
    WHERE "idStudio" = $1
    RETURNING *;
  `;
  const { rows } = await pool.query(q, [
    idStudio,
    tokens.access_token,
    tokens.refresh_token,
    tokens.scope ?? null,
    !!tokens.live_mode,
    tokens.token_expires_at ? tokens.token_expires_at.toISOString() : null,
  ]);
  return rows[0] ?? null;
}

export async function getMpAccountById(idMpAccount: number|null): Promise<MpAccountRow | null> {
  const q = `
    SELECT * FROM "Billing"."MpAccount"
    WHERE "idMpAccount" = $1
    LIMIT 1
  `;
  const { rows } = await pool.query(q, [idMpAccount]);
  return rows[0] ?? null;
}
