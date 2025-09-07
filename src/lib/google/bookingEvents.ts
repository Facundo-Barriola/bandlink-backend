import { pool } from "../../config/database.js";
import { calendarClientWithTokens } from "./calendar.js";

export async function publishGCalEventForBooking(bookingId: number) {
  const { rows } = await pool.query(`
    SELECT b."idBooking", b."startsAt", b."endsAt", b."confirmationCode",
           sr."idRoom", sr."roomName", sr."calendarId",
           s."idStudio",
           up."idUser" AS ownerUserId,
           gt."accessToken", gt."refreshToken", gt."expiryDate"
    FROM "Directory"."RoomBooking" b
    JOIN "Directory"."StudioRoom" sr ON sr."idRoom" = b."idRoom"
    JOIN "Directory"."Studio" s ON s."idStudio" = sr."idStudio"
    JOIN "Directory"."UserProfile" up ON up."idUserProfile" = s."idUserProfile"
    LEFT JOIN "Integration"."GoogleTokens" gt ON gt."idUser" = up."idUser"
    WHERE b."idBooking" = $1
    LIMIT 1
  `, [bookingId]);

  const r = rows[0];
  if (!r || !r.accessToken) return;

  if (!r.calendarId) return;

  const { calendar } = calendarClientWithTokens({
    accessToken: r.accesstoken ?? r.accessToken,
    refreshToken: r.refreshtoken ?? r.refreshToken,
    expiryDate: r.expirydate ?? r.expiryDate,
  });

  const ev = await calendar.events.insert({
    calendarId: r.calendarId,
    requestBody: {
      summary: `Reserva ${r.roomName}`,
      description: `Booking #${r.idBooking} · Código: ${r.confirmationCode ?? "-"}`,
      start: { dateTime: r.startsAt },
      end: { dateTime: r.endsAt },
      extendedProperties: { private: { bookingId: String(r.idBooking) } },
    },
  });

  await pool.query(
    `ALTER TABLE "Directory"."RoomBooking" ADD COLUMN IF NOT EXISTS "gcalEventId" text;`
  );
  await pool.query(
    `UPDATE "Directory"."RoomBooking" SET "gcalEventId" = $1 WHERE "idBooking" = $2`,
    [ev.data.id ?? null, bookingId]
  );
}

export async function updateGCalEventForBooking(bookingId: number) {
  const { rows } = await pool.query(`
    SELECT b."idBooking", b."gcalEventId", b."startsAt", b."endsAt",
           sr."calendarId",
           up."idUser" AS ownerUserId,
           gt."accessToken", gt."refreshToken", gt."expiryDate"
    FROM "Directory"."RoomBooking" b
    JOIN "Directory"."StudioRoom" sr ON sr."idRoom" = b."idRoom"
    JOIN "Directory"."Studio" s ON s."idStudio" = sr."idStudio"
    JOIN "Directory"."UserProfile" up ON up."idUserProfile" = s."idUserProfile"
    LEFT JOIN "Integration"."GoogleTokens" gt ON gt."idUser" = up."idUser"
    WHERE b."idBooking" = $1
    LIMIT 1
  `, [bookingId]);

  const r = rows[0];
  if (!r || !r.gcalEventId || !r.calendarId || !r.accessToken) return;

  const { calendar } = calendarClientWithTokens({
    accessToken: r.accessToken,
    refreshToken: r.refreshToken,
    expiryDate: r.expiryDate,
  });

  await calendar.events.patch({
    calendarId: r.calendarId,
    eventId: r.gcalEventId,
    requestBody: {
      start: { dateTime: r.startsAt },
      end: { dateTime: r.endsAt },
    },
  });
}

export async function deleteGCalEventForBooking(bookingId: number) {
  const { rows } = await pool.query(`
    SELECT b."gcalEventId", sr."calendarId",
           up."idUser" AS ownerUserId,
           gt."accessToken", gt."refreshToken", gt."expiryDate"
    FROM "Directory"."RoomBooking" b
    JOIN "Directory"."StudioRoom" sr ON sr."idRoom" = b."idRoom"
    JOIN "Directory"."Studio" s ON s."idStudio" = sr."idStudio"
    JOIN "Directory"."UserProfile" up ON up."idUserProfile" = s."idUserProfile"
    LEFT JOIN "Integration"."GoogleTokens" gt ON gt."idUser" = up."idUser"
    WHERE b."idBooking" = $1
    LIMIT 1
  `, [bookingId]);

  const r = rows[0];
  if (!r || !r.gcalEventId || !r.calendarId || !r.accessToken) return;

  const { calendar } = calendarClientWithTokens({
    accessToken: r.accessToken,
    refreshToken: r.refreshToken,
    expiryDate: r.expiryDate,
  });

  await calendar.events.delete({
    calendarId: r.calendarId,
    eventId: r.gcalEventId,
  });
}
