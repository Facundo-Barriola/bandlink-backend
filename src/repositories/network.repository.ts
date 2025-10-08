import { pool } from "../config/database.js";

export type ConnectionStatus = "pending" | "accepted" | "rejected" | "canceled";
export interface SendRequestResult {
  ok: boolean;
  idConnection: number | null;
  status: ConnectionStatus | null;
  info: string | null;
}

export interface AcceptRejectResult {
  ok: boolean;
  status: ConnectionStatus | null;
  info: string | null;
}

export interface ArchiveResult {
  ok: boolean;
  archivedByA: boolean | null;
  archivedByB: boolean | null;
  info: string | null;
}

export interface DeleteResult {
  ok: boolean;
  status: ConnectionStatus | null;
  info: string | null;
}

export async function sendConnectionRequest(
  requesterId: number,
  targetId: number
): Promise<SendRequestResult> {
  const sql = `
    SELECT ok, "idConnection", status, info
    FROM "Network".fn_send_connection_request($1, $2)
  `;
  const { rows } = await pool.query<SendRequestResult>(sql, [requesterId, targetId]);
  const row = rows?.[0];
  return {
    ok: !!row?.ok,
    idConnection: row?.idConnection ?? null,
    status: (row?.status as ConnectionStatus) ?? null,
    info: row?.info ?? null,
  };
}

export async function acceptConnectionRequest(
  actorUserId: number,
  idConnection: number
): Promise<AcceptRejectResult> {
  const sql = `
    SELECT ok, status, info
    FROM "Network".fn_accept_connection_request($1, $2)
  `;
  const { rows } = await pool.query<AcceptRejectResult>(sql, [actorUserId, idConnection]);
  const row = rows?.[0];
  return {
    ok: !!row?.ok,
    status: (row?.status as ConnectionStatus) ?? null,
    info: row?.info ?? null,
  };
}


export async function rejectConnectionRequest(
  actorUserId: number,
  idConnection: number
): Promise<AcceptRejectResult> {
  const sql = `
    SELECT ok, status, info
    FROM "Network".fn_reject_connection_request($1, $2)
  `;
  const { rows } = await pool.query<AcceptRejectResult>(sql, [actorUserId, idConnection]);
  const row = rows?.[0];
  return {
    ok: !!row?.ok,
    status: (row?.status as ConnectionStatus) ?? null,
    info: row?.info ?? null,
  };
}

export async function archiveConnection(
  actorUserId: number,
  idConnection: number,
  archived: boolean = true
): Promise<ArchiveResult> {
  const sql = `
    SELECT ok, "archivedByA", "archivedByB", info
    FROM "Network".fn_archive_connection($1, $2, $3)
  `;
  const { rows } = await pool.query<ArchiveResult>(sql, [actorUserId, idConnection, archived]);
  const row = rows?.[0];
  return {
    ok: !!row?.ok,
    archivedByA: row?.archivedByA ?? null,
    archivedByB: row?.archivedByB ?? null,
    info: row?.info ?? null,
  };
}

export async function deleteConnection(
  actorUserId: number,
  idConnection: number
): Promise<DeleteResult> {
  const sql = `
    SELECT ok, status, info
    FROM "Network".fn_delete_connection($1, $2)
  `;
  const { rows } = await pool.query<DeleteResult>(sql, [actorUserId, idConnection]);
  const row = rows?.[0];
  return {
    ok: !!row?.ok,
    status: (row?.status as ConnectionStatus) ?? null,
    info: row?.info ?? null,
  };
}

export async function listIncomingPending(userId: number) {
  const sql = `
    SELECT c."idConnection", c."idUserA", c."idUserB", c.status, c."requestedBy",
           c."requestedAt", c."updatedAt"
    FROM "Network"."Connection" c
    WHERE c.status = 'pending'
      AND c."deletedAt" IS NULL
      AND c."requestedBy" <> $1
      AND ($1 = c."idUserA" OR $1 = c."idUserB")
    ORDER BY c."requestedAt" DESC
  `;
  const{ rows } = await pool.query(sql, [userId]);
  return rows;
}


export async function listOutgoingPending(userId: number) {
  const sql = `
    SELECT c."idConnection", c."idUserA", c."idUserB", c.status, c."requestedBy",
           c."requestedAt", c."updatedAt"
    FROM "Network"."Connection" c
    WHERE c.status = 'pending'
      AND c."deletedAt" IS NULL
      AND c."requestedBy" = $1
    ORDER BY c."requestedAt" DESC
  `;
  const{ rows } = await pool.query(sql, [userId]);
  return rows;
}

export async function listAccepted(userId: number) {
  const sql = `
    SELECT c."idConnection", c."idUserA", c."idUserB", c.status,
           c."respondedBy", c."respondedAt", c."updatedAt"
    FROM "Network"."Connection" c
    WHERE c.status = 'accepted'
      AND c."deletedAt" IS NULL
      AND ($1 = c."idUserA" OR $1 = c."idUserB")
    ORDER BY c."updatedAt" DESC
  `;
  const{ rows } = await pool.query(sql, [userId]);
  console.log(rows);
  return rows;
}

export async function listArchived(userId: number) {
  const sql = `
    SELECT c."idConnection", c."idUserA", c."idUserB", c.status,
           c."archivedByA", c."archivedByB", c."updatedAt"
    FROM "Network"."Connection" c
    WHERE c."deletedAt" IS NULL
      AND (
           ($1 = c."idUserA" AND c."archivedByA" = true) OR
           ($1 = c."idUserB" AND c."archivedByB" = true)
      )
    ORDER BY c."updatedAt" DESC
  `;
  const{ rows } = await pool.query(sql, [userId]);
  return rows;
}

export type ConnectionCore = {
  idConnection: number;
  idUserA: number;
  idUserB: number;
  requestedBy: number;
};

export async function getConnectionCore(
  idConnection: number
): Promise<ConnectionCore | null> {
  const sql = `
    SELECT "idConnection","idUserA","idUserB","requestedBy"
    FROM "Network"."Connection"
    WHERE "idConnection" = $1
  `;
  const { rows } = await pool.query<ConnectionCore>(sql, [idConnection]);
  return rows[0] ?? null;
}
export async function isBlocked(a: number, b: number): Promise<boolean> {
  const q = `
    select 1
      from "Network"."Block"
     where ("blockerId"=$1 and "blockedId"=$2)
        or ("blockerId"=$2 and "blockedId"=$1)
     limit 1`;
  const { rows } = await pool.query(q, [a, b]);
  return rows.length > 0;
}