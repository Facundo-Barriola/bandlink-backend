import {
  createRoomBooking, getBookingsForMusician, getBookingsForStudio, getBookingForEmail, refundPaymentByBooking, getPaymentByBooking
  , getForUpdateByOwner, hasOverlapInRoom, updateScheduleAndMaybeTotal, getStudioOpeningHoursAndTZByRoom
} from "../repositories/booking.repository.js";
import { getPaidStatusForBooking } from "../repositories/payment.repository.js"
import { mpRefund } from "../services/payments/providers/mp.provider.js";
import { stripeRefund } from "./payments/providers/stripe.provider.js";
import { pool } from "../config/database.js";
import { normalizeOpeningHours, isWithinOpeningHoursZoned } from "../utils/openingHours.js";
import { formatInTimeZone } from "date-fns-tz";

export type CreateRoomBookingDTO = {
  idRoom: number;
  startsAt: string; // ISO Z
  endsAt: string;   // ISO Z
  notes?: string | null;
  contactNumber?: string | null;
};

class ServiceError extends Error {
  status: number;
  constructor(status: number, msg: string) { super(msg); this.status = status; }
}

function validate(dto: CreateRoomBookingDTO) {
  if (!Number.isFinite(dto.idRoom)) throw new ServiceError(400, "idRoom inválido");
  const s = new Date(dto.startsAt), e = new Date(dto.endsAt);
  if (isNaN(+s) || isNaN(+e)) throw new ServiceError(400, "Fecha/hora inválida");
  if (e <= s) throw new ServiceError(400, "El fin debe ser posterior al inicio");
  const minMs = 30 * 60_000;
  if (e.getTime() - s.getTime() < minMs) throw new ServiceError(400, "Duración mínima: 30 minutos");
}

export async function createRoomBookingService(idUser: number, dto: CreateRoomBookingDTO) {
  if (!Number.isFinite(idUser)) throw new ServiceError(401, "No autorizado");
  validate(dto);

  const { openingHours, timezone } = await getStudioOpeningHoursAndTZByRoom(dto.idRoom);
  const tz = timezone || process.env.DEFAULT_TZ || "America/Argentina/Buenos_Aires";

  if (openingHours) {
    const norm = normalizeOpeningHours(openingHours as any);

    // DEBUG: te muestra cómo lo está evaluando
    console.log("[opening-hours-check]", {
      tz,
      localStart: formatInTimeZone(dto.startsAt, tz, "yyyy-MM-dd HH:mm"),
      localEnd:   formatInTimeZone(dto.endsAt,   tz, "yyyy-MM-dd HH:mm"),
      normForDay: norm, // si molesta mucho, logueá solo el día en cuestión
    });

    const ok = isWithinOpeningHoursZoned(dto.startsAt, dto.endsAt, norm, tz);
    if (!ok) throw new ServiceError(400, "outside_opening_hours");
  }

  const r = await createRoomBooking(
    idUser,
    dto.idRoom,
    dto.startsAt,
    dto.endsAt,
    dto.notes ?? null,
    dto.contactNumber ?? null
  );

  if (!r.ok) {
    if (r.info === "overlap")        throw new ServiceError(409, "Horario no disponible");
    if (r.info === "invalid_range")  throw new ServiceError(400, "Rango inválido");
    if (r.info === "outside_opening_hours") throw new ServiceError(400, "outside_opening_hours");
    throw new ServiceError(500, "No se pudo crear la reserva");
  }
  return r;
}

export async function listMusicianBookings(idUser: number) {
  return await getBookingsForMusician(idUser);
}

export async function listStudioBookings(idUser: number) {
  return await getBookingsForStudio(idUser);
}

export async function getBookingForEmailById(bookingId: number) {
  return await getBookingForEmail(bookingId);
}

export async function cancelBookingByStudio(bookingId: number, refundedStatus: string, refundedAmount: number) {
  const payment = await getPaymentByBooking(bookingId);
  if (!payment) return null;

  if (payment.provider === "mp") {
    await mpRefund(payment.providerPaymentId, process.env.MP_ACCESS_TOKEN!, refundedAmount);
  } else if (payment.provider === "stripe") {
    // ojo: en Stripe solés guardar payment_intent, no el charge
    await stripeRefund(payment.providerPaymentId /* payment_intent */, Math.round(refundedAmount * 100));
  }
  return await refundPaymentByBooking(bookingId, refundedStatus, refundedAmount);
}

export async function rescheduleByMusicianService(
  idBooking: number,
  idUser: number,
  newStartsAtIso: string,
  newEndsAtIso: string
) {
  // validaciones rápidas a nivel service (simple)
  const start = new Date(newStartsAtIso);
  const end = new Date(newEndsAtIso);
  if (!(start instanceof Date) || isNaN(+start) || !(end instanceof Date) || isNaN(+end)) {
    return { ok: false as const, code: "invalid_datetime" };
  }
  if (end <= start) {
    return { ok: false as const, code: "end_before_start" };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const booking = await getForUpdateByOwner(client, idBooking, idUser);
    if (!booking) {
      await client.query("ROLLBACK");
      return { ok: false as const, code: "booking_not_found_or_not_owner" };
    }

    // si está paga, no permitir
    const pay = await getPaidStatusForBooking(client, idBooking);
    if (pay.isPaid) {
      await client.query("ROLLBACK");
      return { ok: false as const, code: "booking_already_paid" };
    }

    const openingRaw = await getStudioOpeningHoursAndTZByRoom(booking.idRoom);
    if (openingRaw) {
      const norm = normalizeOpeningHours(openingRaw as any);
      const ok = isWithinOpeningHoursZoned(newStartsAtIso, newEndsAtIso, norm, process.env.DEFAULT_TZ || "America/Argentina/Buenos_Aires");
      if (!ok) { await client.query("ROLLBACK"); return { ok: false as const, code: "outside_opening_hours" }; }
    }

    // evitar solapamientos en el mismo room
    const overlapping = await hasOverlapInRoom(
      client,
      booking.idRoom,
      newStartsAtIso,
      newEndsAtIso,
      idBooking
    );
    if (overlapping) {
      await client.query("ROLLBACK");
      return { ok: false as const, code: "overlap" };
    }

    const updated = await updateScheduleAndMaybeTotal(
      client,
      idBooking,
      newStartsAtIso,
      newEndsAtIso
    );

    await client.query("COMMIT");
    return { ok: true as const, data: updated };
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}