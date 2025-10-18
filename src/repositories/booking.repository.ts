import { pool } from "../config/database.js";
import { PoolClient } from "pg";

export type CreateRoomBookingResult = {
  ok: boolean;
  info: "overlap" | "invalid_range" | "outside_opening_hours" | string | null;
  idBooking: number | null;
  confirmationCode: string | null;
};

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

export async function createRoomBookingWithClient(
  client: PoolClient,
  idUser: number,
  idRoom: number,
  startsAtIso: string, // ISO con Z
  endsAtIso: string,   // ISO con Z
  notes: string | null = null,
  contactNumber: string | null = null
): Promise<CreateRoomBookingResult> {
  const sql = `
    select * from "Directory".fn_create_room_booking(
      $1, $2, $3::timestamptz, $4::timestamptz, $5, $6
    )
  `;
  const params = [idUser, idRoom, startsAtIso, endsAtIso, notes, contactNumber];

  const { rows } = await client.query(sql, params);
  const r = rows?.[0] ?? {};

  return {
    ok: !!r.ok,
    info: r.info ?? null,
    idBooking: r.idbooking ?? r.idBooking ?? null,
    confirmationCode: r.confirmationcode ?? r.confirmationCode ?? null,
  };
}

export async function getPaymentByBooking(idBooking: number) {
  const { rows } = await pool.query(
    `SELECT * FROM "Billing"."Payment" WHERE "idBooking" = $1 LIMIT 1`,
    [idBooking]
  );
  return rows[0] ?? null;
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

export type BookingWithPaymentRow = {
  idBooking: number;
  startsAt: string;   // ISO en PG -> string
  endsAt: string;
  bookingStatus: string;
  totalAmount: string | number | null;

  userId: number | null;
  userDisplayName: string | null;
  userEmail: string | null;

  roomName: string | null;

  paymentId: string | number | null;
  paymentStatus: string | null;
  provider: string | null;
  paymentAmount: string | number | null;
  paymentCurrency: string | null;
  paidAt: string | null;
};

export async function refundPaymentByBooking(
  idBooking: number,
  refundedStatus: string,
  refundedAmount: number
) {
  const { rows } = await pool.query(
    `
    UPDATE "Billing"."Payment"
    SET 
      status = $2,
      amount = $3
    WHERE "idBooking" = $1
    RETURNING *;
    `,
    [idBooking, refundedStatus, refundedAmount]
  );

  return rows[0];
}

export async function getBookingWithPayment(idBooking: number) {
  const { rows } = await pool.query<BookingWithPaymentRow>(
    `
    SELECT
      b."idBooking"                               AS "idBooking",
      b."startsAt"                                AS "startsAt",
      b."endsAt"                                  AS "endsAt",
      b.status                                    AS "bookingStatus",
      b."totalAmount"                             AS "totalAmount",

      u."idUser"                                  AS "userId",
      up."displayName"                            AS "userDisplayName",
      u.email                                     AS "userEmail",

      r."roomName"                                AS "roomName",

      p."idPayment"                               AS "paymentId",
      p.status                                    AS "paymentStatus",
      p.provider                                  AS "provider",
      p.amount                                    AS "paymentAmount",
      TRIM(p.currency)                            AS "paymentCurrency",
      to_char(p."paidAt", 'YYYY-MM-DD"T"HH24:MI:SS"Z"') AS "paidAt"
    FROM "Directory"."RoomBooking" b
    LEFT JOIN "Security"."User" u
      ON u."idUser" = b."idUser"
    LEFT JOIN "Directory"."UserProfile" up
      ON up."idUser" = b."idUser"
    LEFT JOIN "Directory"."StudioRoom" r
      ON r."idRoom" = b."idRoom"
    -- Traer SOLO el último pago de esa reserva
    LEFT JOIN LATERAL (
      SELECT p2.*
      FROM "Billing"."Payment" p2
      WHERE p2."idBooking" = b."idBooking"
      ORDER BY p2."createdAt" DESC
      LIMIT 1
    ) p ON TRUE
    WHERE b."idBooking" = $1
    LIMIT 1
    `,
    [idBooking]
  );

  const r = rows[0];
  if (!r) return null;

  return {
    idBooking: r.idBooking,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    status: r.bookingStatus,
    totalAmount: r.totalAmount != null ? Number(r.totalAmount) : null,

    user: {
      idUser: r.userId,
      name: r.userDisplayName,
      email: r.userEmail,
    },

    room: { name: r.roomName },

    payment: r.paymentId
      ? {
          idPayment: r.paymentId,
          status: r.paymentStatus,
          provider: r.provider,
          amount: r.paymentAmount != null ? Number(r.paymentAmount) : null,
          currency: r.paymentCurrency ?? null,
          paidAt: r.paidAt,
        }
      : null,
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

export async function getForUpdateByOwner(client: PoolClient, idBooking: number, idUser: number) {
    const { rows } = await client.query(
      `
      SELECT b.*
      FROM "Directory"."RoomBooking" b
      WHERE b."idBooking" = $1
        AND b."idUser" = $2
        AND b.status NOT IN ('cancelled_by_studio','cancelled_by_user')
      FOR UPDATE
      `,
      [idBooking, idUser]
    );
    return rows[0] ?? null;
}

export async function hasOverlapInRoom(
    client: PoolClient,
    idRoom: number,
    newStartsAtIso: string,
    newEndsAtIso: string,
    excludeIdBooking: number
  ) {
    const { rows } = await client.query(
      `
      SELECT 1
      FROM "Directory"."RoomBooking" rb
      WHERE rb."idRoom" = $1
        AND rb."idBooking" <> $4
        AND rb.status NOT IN ('cancelled_by_studio','cancelled_by_user')
        -- overlap simple: NOT(end <= other.start OR start >= other.end)
        AND NOT ($3::timestamp <= rb."startsAt" OR $2::timestamp >= rb."endsAt")
      LIMIT 1
      `,
      [idRoom, newStartsAtIso, newEndsAtIso, excludeIdBooking]
    );
    return Boolean(rows[0]);
}

export async function updateScheduleAndMaybeTotal(
    client: PoolClient,
    idBooking: number,
    newStartsAtIso: string,
    newEndsAtIso: string
  ) {
    // Si hay pricePerHour, recalcula; si no, deja totalAmount como está.
    const { rows } = await client.query(
      `
      UPDATE "Directory"."RoomBooking" b
      SET
        "startsAt" = $2::timestamp,
        "endsAt"   = $3::timestamp,
        "totalAmount" = CASE
          WHEN b."pricePerHour" IS NULL THEN b."totalAmount"
          ELSE b."pricePerHour" * (EXTRACT(EPOCH FROM ($3::timestamp - $2::timestamp)) / 3600.0)
        END
      WHERE b."idBooking" = $1
      RETURNING *;
      `,
      [idBooking, newStartsAtIso, newEndsAtIso]
    );
    return rows[0] ?? null;
}

export async function getStudioOpeningHoursAndTZByRoom(idRoom: number): Promise<{ openingHours: any | null; timezone: string | null }> {
  const { rows } = await pool.query(
    `
    SELECT s."openingHours", s."timezone"
    FROM "Directory"."Studio" s
    JOIN "Directory"."StudioRoom" r ON r."idStudio" = s."idStudio"
    WHERE r."idRoom" = $1
    LIMIT 1
    `,
    [idRoom]
  );
  const r = rows[0];
  return {
    openingHours: r?.openingHours ?? null,
    timezone: (r?.timezone && String(r.timezone).trim()) || null,
  };
}