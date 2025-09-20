import { pool } from "../config/database.js";

/** Chequear si el user es creador del evento */
export async function isEventCreator(idEvent: number, idUser: number): Promise<boolean> {
  const sql = `SELECT 1 FROM "Directory"."Event" WHERE "idEvent"=$1 AND "idUser"=$2 LIMIT 1;`;
  const { rows } = await pool.query(sql, [idEvent, idUser]);
  return rows.length > 0;
}

/** Traer capacidad (puede ser null) */
export async function getEventCapacity(idEvent: number): Promise<number | null> {
  const sql = `SELECT "capacityMax" FROM "Directory"."Event" WHERE "idEvent"=$1;`;
  const { rows } = await pool.query<{ capacityMax: number | null }>(sql, [idEvent]);
  return rows[0]?.capacityMax ?? null;
}

/** Contar asistentes actuales */
export async function countEventAttendees(idEvent: number): Promise<number> {
  const sql = `SELECT COUNT(*)::int AS cnt FROM "Directory"."EventAttendee" WHERE "idEvent"=$1;`;
  const { rows } = await pool.query<{ cnt: number }>(sql, [idEvent]);
  return rows[0]?.cnt ?? 0;
}

/** Insertar asistencia (idempotente) */
export async function addEventAttendee(idEvent: number, idUser: number): Promise<boolean> {
  const sql = `
    INSERT INTO "Directory"."EventAttendee" ("idEvent","idUser")
    SELECT $1, $2
    WHERE NOT EXISTS (
      SELECT 1 FROM "Directory"."EventAttendee" WHERE "idEvent"=$1 AND "idUser"=$2
    )
    RETURNING "joinedAt";
  `;
  const { rows } = await pool.query(sql, [idEvent, idUser]);
  return rows.length > 0; // true si insertó, false si ya existía
}

/** Quitar asistencia (optativo para “cancelar” agenda) */
export async function removeEventAttendee(idEvent: number, idUser: number): Promise<boolean> {
  const sql = `DELETE FROM "Directory"."EventAttendee" WHERE "idEvent"=$1 AND "idUser"=$2;`;
  const { rowCount } = await pool.query(sql, [idEvent, idUser]);
  if (rowCount == null) return false;
  return rowCount > 0;
}

/** Verificar que el user sea admin de la banda */
export async function isUserAdminOfBand(idUser: number, idBand: number): Promise<boolean> {
  const sql = `
    SELECT 1
    FROM "Security"."User" u
    JOIN "Directory"."UserProfile" up ON up."idUser" = u."idUser"
    JOIN "Directory"."Musician" m     ON m."idUserProfile" = up."idUserProfile"
    JOIN "Directory"."BandMember" bm  ON bm."idMusician" = m."idMusician"
    WHERE u."idUser" = $1
      AND bm."idBand" = $2
      AND bm."isAdmin" = TRUE
    LIMIT 1;
  `;
  const { rows } = await pool.query(sql, [idUser, idBand]);
  return rows.length > 0;
}

/** Solicitar unirse al evento como banda -> crea/asegura invitación en pending */
export async function upsertBandJoinRequest(idEvent: number, idBand: number): Promise<number | null> {
  const sql = `
    WITH ins AS (
      INSERT INTO "Directory"."EventInviteBand" ("idEvent","idBand","status")
      SELECT $1, $2, 'pending'
      WHERE NOT EXISTS (
        SELECT 1 FROM "Directory"."EventInviteBand"
        WHERE "idEvent"=$1 AND "idBand"=$2 AND "status" IN ('pending','accepted')
      )
      RETURNING "idEventInviteBand"
    )
    SELECT "idEventInviteBand" FROM ins
    UNION ALL
    SELECT eib."idEventInviteBand"
    FROM "Directory"."EventInviteBand" eib
    WHERE eib."idEvent"=$1 AND eib."idBand"=$2
    LIMIT 1;
  `;
  const { rows } = await pool.query<{ idEventInviteBand: number }>(sql, [idEvent, idBand]);
  return rows[0]?.idEventInviteBand ?? null;
}

/** Confirmar asistencia de banda -> accepted + opcionalmente registrar performer */
export async function confirmBandAttendance(idEvent: number, idBand: number): Promise<void> {
  // 1) actualizar invitación
  await pool.query(
    `UPDATE "Directory"."EventInviteBand"
     SET status='accepted', "respondedAt"=now()
     WHERE "idEvent"=$1 AND "idBand"=$2;`,
    [idEvent, idBand]
  );

  // 2) registrar como performer (idempotente)
  await pool.query(
    `INSERT INTO "Directory"."EventPerformerBand" ("idEvent","idBand")
     VALUES ($1,$2)
     ON CONFLICT ("idEvent","idBand") DO NOTHING;`,
    [idEvent, idBand]
  );
}
