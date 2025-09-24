import {   listEvents,
  getById,
  createEventTx,
  updateEventTx,
  deleteEvent,
  upsertUserInvite,
  upsertBandInvite,
  getMyEventsList,
  getEventsByName, EventHit ,
  updateLocation,
  getAttendingEventIdsByUser,
type UpdateEventDTO,} from "../repositories/events.repository.js";
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

    const { idCity, street, streetNum, addressDesc } = eventData.address ?? {};
    if (!idCity || !street?.trim() || !Number.isFinite(Number(streetNum))) {
      throw new Error("Faltan datos para crear la dirección");
    }

    const idAddress = await AddressService.createAddress(client, {
      idCity,
      street: street.trim(),
      streetNum: Number(streetNum),
      addressDesc: addressDesc ?? null,
    });

    const idEvent = await createEventTx(client, idUser, {
      name: eventData.name,
      description: eventData.description ?? null,
      visibility: eventData.visibility ?? "public",
      capacityMax: eventData.capacityMax ?? null,
      idAddress, 
      startsAtIso: eventData.startsAtIso,
      endsAtIso: eventData.endsAtIso ?? null,
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
      const { idCity, street, streetNum, addressDesc } = dto.address;
      if (!idCity || !street?.trim() || !Number.isFinite(Number(streetNum))) {
        throw new Error("Faltan datos para crear la dirección");
      }
      const idAddress = await AddressService.createAddress(client, {
        idCity,
        street: street.trim(),
        streetNum: Number(streetNum),
        addressDesc: addressDesc ?? null,
      });
      dto.idAddress = idAddress;
    }
    await updateEventTx(client, idEvent, idUser, dto as UpdateEventDTO);

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

export function deleteEventSvc(idEvent: number, idUser: number) {
  return deleteEvent(idEvent, idUser);
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
          idEvent,
          message: `Te invitaron a un evento`,
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
            idEvent,
            idBand: t.idBand,
            message: `Invitaron a tu banda al evento`,
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