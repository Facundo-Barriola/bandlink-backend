import { pool } from "../config/database.js";

export type InviteResult = { ok: boolean; idBandInvite: number | null; status: string | null; info: string | null };
export type SimpleResult = { ok: boolean; info: string | null };
export type InviteDecisionResult = { ok: boolean; idBand: number | null; status: string | null; info: string | null };
export type BandInviteStatus = "pending" | "accepted" | "rejected" | "canceled";


export type BandInviteRow = {
  idBandInvite: number;
  idBand: number;
  bandName: string;
  roleSuggested: string | null;
  message: string | null;
  status: BandInviteStatus;
  invitedAt: string;
  respondedAt: string | null;
  invitedByName: string | null;
  membersCount: number;
  genres: Array<{ idGenre: number; genreName: string }>;
};

function normalizeStatus(status?: string | null): BandInviteStatus | null {
  if (!status) return null;
  const s = String(status).toLowerCase();
  if (s === "pending" || s === "accepted" || s === "rejected" || s === "canceled") {
    return s as BandInviteStatus;
  }
  return null;
}
export async function getMusicianIdByUserId(idUser: number): Promise<number | null> {
  const q = `SELECT public.get_musician_id_by_user_id($1)::int AS "idMusician"`;
  const { rows } = await pool.query<{ idMusician: number | null }>(q, [idUser]);
  return rows[0]?.idMusician ?? null;
}

export async function getUserByMusicianId(idMusician: number): Promise<number | null>{
  const q = `SELECT up."idUser" 
  FROM "Directory"."UserProfile" AS up
  INNER JOIN "Directory"."Musician" AS m
  ON up."idUserProfile" = m."idUserProfile"
  WHERE m."idMusician" = $1`
  const { rows } = await pool.query<{idUser: number | null}>(q, [idMusician]);
  return rows[0]?.idUser ?? null;
}

export async function getInvitesForMusician(
  idMusician: number,
  status?: string | null
): Promise<BandInviteRow[]> {
  const st = normalizeStatus(status);
  const q = `SELECT * FROM public.band_invites_for_musician($1, $2)`;
  const { rows } = await pool.query<BandInviteRow>(q, [idMusician, st]);
  return rows;
}

export async function getInvitesForUser(
  idUser: number,
  status?: string | null
): Promise<BandInviteRow[]> {
  const st = normalizeStatus(status);
  const q = `SELECT * FROM public.band_invites_for_user($1, $2)`;
  const { rows } = await pool.query<BandInviteRow>(q, [idUser, st]);
  return rows;
}

export async function inviteMusicianToBand(
  adminMusicianId: number,
  idBand: number,
  targetMusicianId: number,
  roleSuggested?: string | null,
  message?: string | null
): Promise<InviteResult> {
  const sql = `
    SELECT ok, "idBandInvite", status, info
    FROM "Directory".fn_invite_musician_to_band($1,$2,$3,$4,$5)
  `;
  const { rows } = await pool.query(sql, [adminMusicianId, idBand, targetMusicianId, roleSuggested ?? null, message ?? null]);
  const r = rows[0] || {};
  return {
    ok: !!r.ok,
    idBandInvite: r.idBandInvite ?? null,
    status: r.status ?? null,
    info: r.info ?? null,
  };
}

export async function acceptBandInvite(
  targetMusicianId: number,
  idBandInvite: number
): Promise<InviteDecisionResult> {
  const sql = `
    SELECT ok, "out_idBand", status, info
    FROM "Directory".fn_accept_band_invite($1,$2)
  `;
  const { rows } = await pool.query(sql, [targetMusicianId, idBandInvite]);
  const r = rows[0] || {};
  return { ok: !!r.ok, idBand: r.out_idBand ?? null, status: r.status ?? null, info: r.info ?? null };
}

export async function rejectBandInvite(
  targetMusicianId: number,
  idBandInvite: number
): Promise<InviteDecisionResult> {
  const sql = `
    SELECT ok, "idBand", status, info
    FROM "Directory".fn_reject_band_invite($1,$2)
  `;
  const { rows } = await pool.query(sql, [targetMusicianId, idBandInvite]);
  const r = rows[0] || {};
  return { ok: !!r.ok, idBand: r.idBand ?? null, status: r.status ?? null, info: r.info ?? null };
}

export async function kickBandMember(
  adminMusicianId: number,
  idBand: number,
  targetMusicianId: number
): Promise<SimpleResult> {
  const sql = `
    SELECT ok, info
    FROM "Directory".fn_kick_band_member($1,$2,$3)
  `;
  const { rows } = await pool.query(sql, [adminMusicianId, idBand, targetMusicianId]);
  const r = rows[0] || {};
  return { ok: !!r.ok, info: r.info ?? null };
}

export async function leaveBand(
  musicianId: number,
  idBand: number
): Promise<SimpleResult> {
  const sql = `
    SELECT ok, info
    FROM "Directory".fn_leave_band($1,$2)
  `;
  const { rows } = await pool.query(sql, [musicianId, idBand]);
  const r = rows[0] || {};
  return { ok: !!r.ok, info: r.info ?? null };
}
