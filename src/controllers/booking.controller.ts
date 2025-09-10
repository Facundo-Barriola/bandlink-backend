import type { Response } from "express";
import type { AuthRequest } from "../types/authRequest.js";
import { createRoomBookingService, getBookingForEmailById, listMusicianBookings, listStudioBookings, cancelBookingByStudio,
  rescheduleByMusicianService
 } from "../services/booking.service.js";
import { notifyBookingConfirmed } from "../services/notification.service.js";
function parseIntOr<T extends number>(v: unknown, fallback: T): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function reserveRoomController(req: AuthRequest, res: Response) {
  try {
    const idUser = req.user?.idUser as number;
    const idRoomParam = Number(req.params.idRoom);
    const { idRoom: bodyIdRoom, startsAt, endsAt, notes, contactNumber } = req.body ?? {};
    const idRoom = Number.isFinite(idRoomParam) ? idRoomParam : Number(bodyIdRoom);
    console.log(req.body)
    const result = await createRoomBookingService(idUser, { idRoom, startsAt, endsAt, notes, contactNumber });
    const bookingData = await getBookingForEmailById(result.idBooking as number);
    if (bookingData) {
      await notifyBookingConfirmed({
        userEmail: bookingData.userEmail,
        userName: bookingData.userName,
        studioName: bookingData.studioName,
        roomName: bookingData.roomName,
        startsAt: new Date(bookingData.startsAt),
        endsAt: new Date(bookingData.endsAt),
        amount: bookingData.totalAmount,
        streetAddress: bookingData.streetAddress,
        streetNumber: bookingData.streetNumber,
        bookingId: bookingData.idBooking
      }).catch(err => console.error("notifyBookingConfirmed error:", err));
    }
    return res.status(201).json({ ok: true, data: result });
  } catch (e: any) {
    const status = e?.status ?? 500;
    if (status >= 500) console.error("reserveRoomController()", e);
    return res.status(status).json({ ok: false, error: e?.message ?? "Error del servidor" });
  }
}

export async function getBookingsController(req: AuthRequest, res: Response) {
  try {
    const idUser = req.user?.idUser;
    if (!idUser) return res.status(401).json({ ok: false, error: "No autenticado" });

    // Tomamos el grupo del token si viene, sino consultamos al service
    let idUserGroup = req.user?.role;
    if (Number(idUserGroup) === 2) {
      const data = await listMusicianBookings(idUser);
      return res.json({ ok: true, role: "musician", count: data.length, data });
    }

    if (Number(idUserGroup) === 3) {
      const data = await listStudioBookings(idUser);
      return res.json({ ok: true, role: "studio", count: data.length, data });
    }

    return res.status(403).json({ ok: false, error: "Grupo sin permisos para ver reservas" });
  } catch (err) {
    console.error("getBookingsController error:", err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

export async function cancelBookingController(req: AuthRequest, res: Response) {
  try {
    const idUser = req.user?.idUser;
    const role = Number(req.user?.role); // 3 = studio
    if (!idUser) return res.status(401).json({ ok: false, error: "No autenticado" });
    if (role !== 3) return res.status(403).json({ ok: false, error: "No autorizado" });

    const { idBooking, refundedStatus, refundedAmount } = req.body ?? {};
    if (!Number.isFinite(idBooking)) {
      return res.status(400).json({ ok: false, error: "idBooking inválido" });
    }
    if (typeof refundedStatus !== "string" || !refundedStatus) {
      return res.status(400).json({ ok: false, error: "refundedStatus requerido" });
    }
    if (!Number.isFinite(refundedAmount)) {
      return res.status(400).json({ ok: false, error: "refundedAmount inválido" });
    }

    const data = await cancelBookingByStudio(
      Number(idBooking),
      refundedStatus,
      Number(refundedAmount)
    );

    if (!data) {
      return res.status(404).json({ ok: false, error: "Pago no encontrado para la reserva" });
    }

    return res.status(200).json({ ok: true, data });
  } catch (err) {
    console.error("[cancelBookingController]", err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

export async function rescheduleBookingController(req: AuthRequest, res: Response) {
  try {
    const idUser = req.user?.idUser;
    const role = Number(req.user?.role); // 2 = musician (según tu UI)
    if (!idUser) return res.status(401).json({ ok: false, error: "No autenticado" });
    if (role !== 2) return res.status(403).json({ ok: false, error: "No autorizado" });

    const { idBooking, newStartsAtIso, newEndsAtIso } = req.body ?? {};
    if (!Number.isFinite(Number(idBooking))) {
      return res.status(400).json({ ok: false, error: "idBooking inválido" });
    }
    if (typeof newStartsAtIso !== "string" || typeof newEndsAtIso !== "string") {
      return res.status(400).json({ ok: false, error: "Fechas inválidas" });
    }

    const r = await rescheduleByMusicianService(
      Number(idBooking),
      Number(idUser),
      newStartsAtIso,
      newEndsAtIso
    );

    if (!r.ok) {
      const map: Record<string, number> = {
        invalid_datetime: 400,
        end_before_start: 400,
        booking_not_found_or_not_owner: 404,
        booking_already_paid: 409,
        overlap: 409,
      };
      const http = map[r.code] ?? 400;
      return res.status(http).json({ ok: false, error: r.code });
    }

    return res.status(200).json({ ok: true, data: r.data });
  } catch (err) {
    console.error("[rescheduleBookingController]", err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}