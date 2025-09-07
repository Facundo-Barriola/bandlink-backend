import { pool } from "../config/database.js";

export async function createRoomBooking(
  idUser: number,
  idRoom: number,
  startsAtIso: string, // ISO con Z
  endsAtIso: string,   // ISO con Z
  notes: string | null = null,
  contactNumber: string | null = null
): Promise<{ ok: boolean; info: string; idBooking: number | null; confirmationCode: string | null }> {
  const sql = `SELECT * FROM "Directory".fn_create_room_booking($1,$2,$3::timestamptz,$4::timestamptz,$5,$6)`;
  const params = [idUser, idRoom, startsAtIso, endsAtIso, notes, contactNumber];

  const { rows } = await pool.query(sql, params);
  const r = rows[0] ?? {};
  return {
    ok: !!r.ok,
    info: r.info ?? null,
    idBooking: r.idbooking ?? r.idBooking ?? null,
    confirmationCode: r.confirmationcode ?? r.confirmationCode ?? null,
  };
}

export async function updateRoomBooking(
  idUser: number,
  idBooking: number,
  patch: Record<string, any>
): Promise<{ ok: boolean; info: string }> {
  const body = JSON.parse(JSON.stringify(patch ?? {}));
  const sql = `SELECT * FROM "Directory".fn_update_room_booking($1,$2,$3::jsonb)`;
  const params = [idUser, idBooking, JSON.stringify(body)];

  const { rows } = await pool.query(sql, params);
  const r = rows[0] ?? {};
  return { ok: !!r.ok, info: r.info ?? null };
}

export async function cancelRoomBooking(
  idUser: number,
  idBooking: number
): Promise<{ ok: boolean; info: string }> {
  const sql = `SELECT * FROM "Directory".fn_cancel_room_booking($1,$2)`;
  const params = [idUser, idBooking];

  const { rows } = await pool.query(sql, params);
  const r = rows[0] ?? {};
  return { ok: !!r.ok, info: r.info ?? null };
}

export async function getMusicianBookings(idUser: number, limit = 50, offset = 0) {
  const sql = `SELECT * FROM "Directory".fn_get_musician_bookings($1,$2,$3)`;
  const { rows } = await pool.query(sql, [idUser, limit, offset]);
  return rows;
}

export async function getBookingsForMusician(
  idUser: number,
  limit = 50,
  offset = 0
) {
  const query = `
    SELECT * 
    FROM "Directory".fn_get_bookings_for_musician($1, $2, $3);
  `;
  const values = [idUser, limit, offset];
  const result = await pool.query(query, values);
  return result.rows;
}

// Reservas de un estudio logueado
export async function getBookingsForStudio(
  idUser: number,
  limit = 50,
  offset = 0
) {
  const query = `
    SELECT * 
    FROM "Directory".fn_get_bookings_for_studio($1, $2, $3);
  `;
  const values = [idUser, limit, offset];
  const result = await pool.query(query, values);
  return result.rows;
}

export async function getBookingWithPayment(idBooking: number) {
  // ajustá nombres reales de tus tablas/campos
  const { rows } = await pool.query(`
    SELECT b."idBooking",
           b."startsAt",
           b."endsAt",
           b.status,
           b."totalAmount",
           u."idUser",
           up."displayName",
           u.email,
           r."roomName",
           p."idPayment",
           p.status,
           p."provider"
    FROM "Directory"."RoomBooking" b
    LEFT JOIN "Security"."User" u ON u."idUser" = b."idUser"
	LEFT JOIN "Directory"."UserProfile" up ON up."idUser" = b."idUser"
    LEFT JOIN "Directory"."StudioRoom" r ON r."idRoom" = b."idRoom"
    LEFT JOIN "Billing"."Payment" p ON p."idBooking" = b."idBooking" 
    WHERE b."idBooking" = $1
    LIMIT 1
  `, [idBooking]);

  const r = rows[0];
  if (!r) return null;
  return {
    idBooking: r.idBooking,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: r.status,
    totalAmount: r.totalAmount,
    user: { idUser: r.idUser, name: r.userName, email: r.userEmail },
    room: { name: r.roomName },
    paymentId: r.paymentId,
    paymentStatus: r.paymentStatus,
    provider: r.provider,
  };
}

export async function getBookingForEmail(idBooking: number) {
  const { rows } = await pool.query(`SELECT b."idBooking", 
    b."startsAt",
    b."endsAt",
    b."totalAmount",
    up."displayName",
    ups."displayName" as "studioName",
    u.email,
    sr."roomName",
    a.street,
    a."streetNum"
    FROM "Directory"."RoomBooking" AS b
    JOIN "Directory"."UserProfile" AS up
    ON up."idUser" = b."idUser"
    JOIN "Directory"."StudioRoom" AS sr
    ON b."idRoom" = sr."idRoom"
    JOIN "Directory"."Studio" AS s
    ON sr."idStudio" = s."idStudio"
    JOIN "Directory"."UserProfile" AS ups
    ON s."idUserProfile" = ups."idUserProfile"
    JOIN "Address"."Address" AS a
    ON a."idAddress" = ups."idAddress"
    JOIN "Security"."User" AS u
    ON u."idUser" = b."idUser"
    WHERE b."idBooking" = $1 LIMIT 1`, [idBooking]);

  const r = rows[0];
  if(!r) return null;
  return {
    idBooking: r.idBooking,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    totalAmount: r.totalAmount,
    userName: r.displayName,
    studioName: r.studioName,
    userEmail: r.email,
    roomName: r.roomName,
    streetAddress: r.street,
    streetNumber: r.streetNum
  };
}