
import { calendarClientWithTokens } from "./calendar.js";
import { pool } from "../../config/database.js";

export async function ensureCalendarForRoom(ownerUserId: number, idRoom: number, roomName: string) {
  const { rows } = await pool.query(`
    SELECT gt."accessToken", gt."refreshToken", gt."expiryDate", sr."calendarId"
    FROM "Integration"."GoogleTokens" gt
    JOIN "Directory"."StudioRoom" sr ON sr."idRoom" = $2
    JOIN "Directory"."Studio" s ON s."idStudio" = sr."idStudio"
    JOIN "Directory"."UserProfile" up ON up."idUserProfile" = s."idUserProfile"
    WHERE gt."idUser" = $1
    LIMIT 1
  `, [ownerUserId, idRoom]);

  const r = rows[0];
  if (!r) throw new Error("owner_without_google_tokens");

  if (r.calendarId) return r.calendarId;

  const { calendar } = calendarClientWithTokens({
    accessToken: r.accessToken,
    refreshToken: r.refreshToken,
    expiryDate: r.expiryDate,
  });

  const created = await calendar.calendars.insert({
    requestBody: { summary: `Sala ${roomName} - Bandlink` },
  });

  const calendarId = created.data.id!;
  await pool.query(`UPDATE "Directory"."StudioRoom" SET "calendarId" = $1 WHERE "idRoom" = $2`, [calendarId, idRoom]);
  return calendarId;
}
