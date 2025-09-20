import {
  isEventCreator,
  getEventCapacity,
  countEventAttendees,
  addEventAttendee,
  removeEventAttendee,
  isUserAdminOfBand,
  upsertBandJoinRequest,
  confirmBandAttendance,
} from "../repositories/events-participation.repository.js";

/** CU60 + CU39 (usuario): agendar/unirse como asistente */
export async function attendEventSvc(idEvent: number, idUser: number) {
  if (await isEventCreator(idEvent, idUser)) {
    throw new Error("creator_cannot_attend"); // 403
  }

  const cap = await getEventCapacity(idEvent);
  if (cap != null) {
    const current = await countEventAttendees(idEvent);
    if (current >= cap) throw new Error("capacity_full"); // 409
  }

  await addEventAttendee(idEvent, idUser);
  return { ok: true };
}

/** Cancelar asistencia */
export async function unAttendEventSvc(idEvent: number, idUser: number) {
  await removeEventAttendee(idEvent, idUser);
  return { ok: true };
}

/** CU39 (banda): solicitar unirse al evento (solo admins) */
export async function bandJoinEventSvc(idEvent: number, idUser: number, idBand: number) {
  const isAdmin = await isUserAdminOfBand(idUser, idBand);
  if (!isAdmin) throw new Error("not_band_admin"); // 403

  const id = await upsertBandJoinRequest(idEvent, idBand);
  return { ok: true, idEventInviteBand: id };
}

/** CU37: confirmar asistencia de banda (solo admin) */
export async function bandConfirmAttendanceSvc(idEvent: number, idUser: number, idBand: number) {
  const isAdmin = await isUserAdminOfBand(idUser, idBand);
  if (!isAdmin) throw new Error("not_band_admin"); // 403

  await confirmBandAttendance(idEvent, idBand);
  return { ok: true };
}
