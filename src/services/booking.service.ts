import { createRoomBooking, getBookingsForMusician, getBookingsForStudio, getBookingForEmail } from "../repositories/booking.repository.js";
import { sendMail } from "../config/mailer.js";


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
  if (isNaN(s.getTime()) || isNaN(e.getTime())) throw new ServiceError(400, "Fecha/hora inválida");
  if (e <= s) throw new ServiceError(400, "El fin debe ser posterior al inicio");
  const minMs = 30 * 60_000;
  if (e.getTime() - s.getTime() < minMs) throw new ServiceError(400, "Duración mínima: 30 minutos");
}

export async function createRoomBookingService(idUser: number, dto: CreateRoomBookingDTO) {
  if (!Number.isFinite(idUser)) throw new ServiceError(401, "No autorizado");
  validate(dto);

  const r = await createRoomBooking(idUser, dto.idRoom, dto.startsAt, dto.endsAt, dto.notes ?? null, dto.contactNumber ?? null);

  if (!r.ok) {
    if (r.info === "overlap") throw new ServiceError(409, "Horario no disponible");
    if (r.info === "invalid_range") throw new ServiceError(400, "Rango inválido");
    throw new ServiceError(500, "No se pudo crear la reserva");
  }
  return r; // { ok, info, idBooking, confirmationCode }
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