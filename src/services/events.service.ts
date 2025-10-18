import {
  listEvents,
  getById,
  createEventTx,
  updateEventTx,
  deleteEvent,
  upsertUserInvite,
  upsertBandInvite,
  getMyEventsList,
  getEventsByName, EventHit,
  updateLocation,
  getAttendingEventIdsByUser,
  type UpdateEventDTO,
} from "../repositories/events.repository.js";
import { AddressService } from "./address.service.js";
import { pool } from "../config/database.js";
import { notifyUser } from "../services/notification.service.js";
import { getAdminUserId } from "../repositories/band.repository.js";

export type eventDataCreate = {
  name: string;
  description?: string | null;
  visibility?: "public" | "private";
  capacityMax?: number | null;

  address: {
    idCity: number;
    street: string;
    streetNum: number;
    addressDesc?: string | null;

    lat: number | null;
    lon: number | null;
    municipioName?: string | null;
    provinceName?: string | null;
    barrioName?: string | null;
  }
  startsAtIso: string;
  endsAtIso?: string | null;
  idUser?: number | null;
}
type InviteBand = { kind: "band"; idBand: number; idUserAdmin?: number | null; label?: string };
type InviteMusician = { kind: "musician"; idMusician: number; idUser: number; label?: string };
type InviteTarget = InviteBand | InviteMusician;
export async function newEvent(idUser: number, eventData: eventDataCreate) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { street, streetNum, addressDesc } = eventData.address ?? {};
    if (!street?.trim() || !Number.isFinite(Number(streetNum))) {
      throw new Error("Faltan datos para crear la dirección");
    }

    const idAddress = await AddressService.createAddress(client, {
      street: street.trim(),
      streetNum: Number(streetNum),
      addressDesc: addressDesc ?? null,
      provinceName: eventData.address.provinceName ?? null,
      municipioName: eventData.address.municipioName ?? null,
      barrioName: eventData.address.barrioName ?? null,
    });

    const idEvent = await createEventTx(client, idUser, {
      name: eventData.name,
      description: eventData.description ?? null,
      visibility: eventData.visibility ?? "public",
      capacityMax: eventData.capacityMax ?? null,
      idAddress,
      startsAtIso: eventData.startsAtIso,
      endsAtIso: eventData.endsAtIso ?? null,
      latitude: Number.isFinite(Number(eventData.address.lat)) ? Number(eventData.address.lat) : null,
      longitude: Number.isFinite(Number(eventData.address.lon)) ? Number(eventData.address.lon) : null,
    });

    await client.query("COMMIT");

    return await getById(idEvent);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export function listEventsSvc(limit = 20, offset = 0) {
  return listEvents(limit, offset);
}
export function getEventSvc(idEvent: number) {
  return getById(idEvent);
}

async function notifyEventParticipants(idEvent: number, payload: any) {
  const { rows } = await pool.query(`select "idUser" from "Directory"."EventAttendee" where "idEvent"=$1`, [idEvent]);
  await Promise.all(rows.map(r => notifyUser(r.idUser, payload).catch(console.error)));
}

export async function updateEventSvc(idEvent: number, idUser: number, dto: any) {
  if (dto?.startsAtIso && dto?.endsAtIso) {
    const s = new Date(dto.startsAtIso);
    const e = new Date(dto.endsAtIso);
    if (isNaN(s.getTime())) throw new Error("invalid_startsAt");
    if (isNaN(e.getTime())) throw new Error("invalid_endsAt");
    if (e <= s) throw new Error("ends_before_starts");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    if (dto?.address) {
      const a = dto.address;

      // normalizar texto (aceptar ambos esquemas)
      const provinceName = a.province ?? a.provinceName ?? null;
      const cityName = a.city ?? a.cityName ?? null;
      const neighborhood = a.neighborhood ?? a.neighborhoodName ?? null;

      const lat = (a.lat === null || a.lat === undefined) ? null : Number(a.lat);
      const lon = (a.lon === null || a.lon === undefined) ? null : Number(a.lon);
      if (a.lat !== undefined) dto.latitude = Number.isFinite(lat!) ? lat : null;
      if (a.lon !== undefined) dto.longitude = Number.isFinite(lon!) ? lon : null;
      if (!a.street?.trim() || !Number.isFinite(Number(a.streetNum))) {
        throw new Error("Faltan datos para crear la dirección");
      }
      const idAddress = await AddressService.createAddress(client, {
        street: a.street.trim(),
        streetNum: Number(a.streetNum),
        addressDesc: a.addressDesc ?? null,
        provinceName,
        municipioName: cityName,
        barrioName: neighborhood,
      });
      dto.idAddress = idAddress;
    }
    await updateEventTx(client, idEvent, idUser, dto as UpdateEventDTO);

    await notifyEventParticipants(idEvent, {
      type: "event.updated",
      title: "Evento actualizado",
      body: "Se actualizaron detalles del evento",
      data: { idEvent },
      channel: "push",
    });

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export async function deleteEventSvc(idEvent: number, idUser: number) {
  await deleteEvent(idEvent, idUser);
  await notifyEventParticipants(idEvent, {
    type: "event.canceled",
    title: "Evento cancelado",
    body: "El evento ha sido cancelado",
    data: { idEvent },
    channel: "push",
  });

}

export async function createEventInvites(idEvent: number, targets: InviteTarget[]) {
  let created = 0;
  let duplicated = 0;
  const notified: number[] = [];

  for (const t of targets) {
    if (t.kind === "musician") {
      const ok = await upsertUserInvite(idEvent, t.idUser);
      if (ok) {
        created++;
        await notifyUser(t.idUser, {
          type: "event_invite_user",
          title: "🎟️ Invitación a un evento",
          body: "Te invitaron a un evento",
          data: { idEvent },
          channel: "push",
        });
        notified.push(t.idUser);
      } else {
        duplicated++;
      }
    } else {
      const ok = await upsertBandInvite(idEvent, t.idBand);
      if (ok) {
        created++;
        const adminUserId = t.idUserAdmin ?? (await getAdminUserId(t.idBand));
        if (adminUserId) {
          await notifyUser(adminUserId, {
            type: "event_invite_band_admin",
            title: "🎸 Invitaron a tu banda",
            body: "Invitaron a tu banda al evento",
            data: { idEvent, idBand: t.idBand }, // <- datos en data
            channel: "push",
          });
          notified.push(adminUserId);
        }
      } else {
        duplicated++;
      }
    }
  }

  return { created, duplicated, notified };
}

export async function getMyCreatedEvents(idUser: number, limit = 50, offset = 0) {
  return getMyEventsList(idUser, limit, offset);
}

export async function searchEventsByName(name: string, limit = 8): Promise<EventHit[]> {
  return await getEventsByName(name, limit);
}

export async function updateEventLocationService(
  idEvent: number,
  latitude: number,
  longitude: number
) {
  return await updateLocation(idEvent, latitude, longitude);
}

export async function getMyAttendingEventsService(idUser: number) {
  if (!Number.isFinite(idUser)) return [];

  const ids = await getAttendingEventIdsByUser(idUser);
  if (ids.length === 0) return [];

  const events = await Promise.all(ids.map(id => getById(id).catch(() => null)));

  const items = events
    .filter((e): e is NonNullable<typeof e> => !!e)
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  return items;
}
