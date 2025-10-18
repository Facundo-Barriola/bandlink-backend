import { pool } from "../config/database.js";

/* ========== MUSICIAN ========== */

export async function qMusicianConnectionsActive(idUser: number): Promise<number> {
  const sql = `
    SELECT COUNT(*)::int AS cnt
    FROM "Network"."Connection"
    WHERE ("idUserA" = $1 OR "idUserB" = $1)
      AND (status = 'accepted')
  `;
  const { rows } = await pool.query(sql, [idUser]);
  return rows[0]?.cnt ?? 0;
}

export async function qMusicianRequestsSent(idUser: number): Promise<number> {
  const sql = `
    SELECT COUNT(*)::int AS cnt
    FROM "Network"."Connection"
    WHERE "requestedBy" = $1
      AND (status = 'pending' )
  `;
  const { rows } = await pool.query(sql, [idUser]);
  return rows[0]?.cnt ?? 0;
}

export async function qMusicianAvgRating(idUser: number): Promise<{ value: number | null, count: number }> {
  const sql = `
    SELECT ROUND(AVG(rating)::numeric,2)::float AS value, COUNT(*)::int AS count
    FROM "Feedback"."Review"
    WHERE "targetIdUser" = $1
  `;
  const { rows } = await pool.query(sql, [idUser]);
  return { value: rows[0]?.value ?? null, count: rows[0]?.count ?? 0 };
}

export async function qMusicianActiveBands(idUser: number): Promise<number> {
  const sql = `
    SELECT COUNT(*)::int AS cnt
    FROM "Directory"."BandMember" bm
    JOIN "Directory"."Musician" m      ON m."idMusician" = bm."idMusician"
    JOIN "Directory"."UserProfile" up  ON up."idUserProfile" = m."idUserProfile"
    WHERE up."idUser" = $1
      AND bm."leftAt" IS NULL
  `;
  const { rows } = await pool.query(sql, [idUser]);
  return rows[0]?.cnt ?? 0;
}

export async function qStudioMonthlyBookings(idUser: number): Promise<number> {
  const sql = `
    SELECT COUNT(*)::int AS cnt
    FROM "Directory"."RoomBooking" as b
    INNER JOIN "Directory"."StudioRoom" as sr
    ON b."idRoom" = sr."idRoom"
    INNER JOIN "Directory"."Studio" as s
    ON s."idStudio" = sr."idStudio"
    INNER JOIN "Directory"."UserProfile" as up
    ON up."idUserProfile" = s."idUserProfile"
    WHERE up."idUser" = $1
      AND "startsAt" >= date_trunc('month', now())
      AND "startsAt" <  (date_trunc('month', now()) + interval '1 month')
  `;
  const { rows } = await pool.query(sql, [idUser]);
  return rows[0]?.cnt ?? 0;
}

export async function qStudioMonthlyRevenue(idUser: number): Promise<number> {
  const sql = `
    SELECT COALESCE(SUM("totalAmount"),0)::float AS revenue
    FROM "Directory"."RoomBooking" as b
    INNER JOIN "Directory"."StudioRoom" as sr
    ON b."idRoom" = sr."idRoom"
    INNER JOIN "Directory"."Studio" as s
    ON s."idStudio" = sr."idStudio"
    INNER JOIN "Directory"."UserProfile" as up
    ON up."idUserProfile" = s."idUserProfile"
    WHERE up."idUser" = $1
      AND "startsAt" >= date_trunc('month', now())
      AND "startsAt" <  (date_trunc('month', now()) + interval '1 month')
      AND LOWER(COALESCE("status", '')) IN ('approved','paid','completed')
  `;
  const { rows } = await pool.query(sql, [idUser]);
  return rows[0]?.revenue ?? 0;
}

export async function qStudioAvgRating(idUser: number): Promise<{ value: number | null, count: number }> {
  const sql = `
    SELECT ROUND(AVG(rating)::numeric,2)::float AS value, COUNT(*)::int AS count
    FROM "Feedback"."Review"
    WHERE "targetIdUser" = $1
  `;
  const { rows } = await pool.query(sql, [idUser]);
  return { value: rows[0]?.value ?? null, count: rows[0]?.count ?? 0 };
}

export async function qStudioTopWeekday(idUser: number): Promise<{ label: string, count: number } | null> {
  const sql = `
    SELECT TO_CHAR("startsAt", 'FMDay') AS label, COUNT(*)::int AS count
    FROM "Directory"."RoomBooking" as b
    INNER JOIN "Directory"."StudioRoom" as sr
    ON b."idRoom" = sr."idRoom"
    INNER JOIN "Directory"."Studio" as s
    ON s."idStudio" = sr."idStudio"
    INNER JOIN "Directory"."UserProfile" as up
    ON up."idUserProfile" = s."idUserProfile"
    WHERE up."idUser" = $1
      AND "startsAt" >= (now() - interval '90 days')
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [idUser]);
  return rows[0] ?? null;
}

export async function qStudioTopHourBand(idUser: number): Promise<{ label: string, count: number } | null> {
  const sql = `
    SELECT
      LPAD(EXTRACT(HOUR FROM "startsAt")::int::text, 2, '0') || ':00-' ||
      LPAD(((EXTRACT(HOUR FROM "startsAt")::int)+1)::text, 2, '0') || ':00' AS label,
      COUNT(*)::int AS count
    FROM "Directory"."RoomBooking" as b
    INNER JOIN "Directory"."StudioRoom" as sr
    ON b."idRoom" = sr."idRoom"
    INNER JOIN "Directory"."Studio" as s
    ON s."idStudio" = sr."idStudio"
    INNER JOIN "Directory"."UserProfile" as up
    ON up."idUserProfile" = s."idUserProfile"
    WHERE up."idUser" = $1
      AND "startsAt" >= (now() - interval '90 days')
    GROUP BY 1
    ORDER BY 2 DESC
    LIMIT 1
  `;
  const { rows } = await pool.query(sql, [idUser]);
  return rows[0] ?? null;
}

export async function qStudioBookingHistory(
  idUser: number,
  pastDays = 90,
  limit = 100
): Promise<Array<{
  idBooking: number;
  startsAt: string;
  endsAt: string | null;
  totalAmount: number | null;
  paymentStatus: string | null;
  customerName: string | null;
}>> {
  const sql = `
 SELECT
      b."idBooking",
      b."startsAt",
      b."endsAt",
      b."totalAmount",
      b."status" AS "paymentStatus",
      booker."displayName" AS "customerName"
    FROM "Directory"."RoomBooking" b
    INNER JOIN "Directory"."StudioRoom"  sr ON sr."idRoom"   = b."idRoom"
    INNER JOIN "Directory"."Studio"      s  ON s."idStudio"  = sr."idStudio"
    -- Perfil del dueño/usuario de la sala (para filtrar por $1):
    INNER JOIN "Directory"."UserProfile" up ON up."idUserProfile" = s."idUserProfile"
    -- Perfil de quien reservó (booker):
    LEFT JOIN  "Directory"."UserProfile" booker ON booker."idUser" = b."idUser"
    WHERE up."idUser" = $1
      AND b."startsAt" >= (now() - ($2 || ' days')::interval)
    ORDER BY b."startsAt" DESC
    LIMIT $3
  `;
  const { rows } = await pool.query(sql, [idUser, pastDays, limit]);
  return rows ?? [];
}