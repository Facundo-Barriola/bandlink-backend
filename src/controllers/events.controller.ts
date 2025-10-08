import type { Request, Response } from "express";
import type { AuthRequest } from "../types/authRequest.js";
import { newEvent, listEventsSvc, getEventSvc, deleteEventSvc, updateEventSvc, createEventInvites, 
  getMyCreatedEvents, searchEventsByName,
  getMyAttendingEventsService,
updateEventLocationService } from "../services/events.service.js";

type InviteBand = { kind: "band"; idBand: number; idUserAdmin?: number | null; label?: string };
type InviteMusician = { kind: "musician"; idMusician: number; idUser: number; label?: string };
type InviteTarget = InviteBand | InviteMusician;

export async function listEventsController(req: Request, res: Response) {
  try {
    const limit = Math.max(0, parseInt(String(req.query.limit ?? "20"), 10));
    const offset = Math.max(0, parseInt(String(req.query.offset ?? "0"), 10));
    const data = await listEventsSvc(limit, offset);
    res.json({ ok: true, data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

/* GET /events/:idEvent */
export async function getEventController(req: Request, res: Response) {
  try {
    const idEvent = Number(req.params.idEvent);
    if (!Number.isFinite(idEvent)) {
      return res.status(400).json({ ok: false, error: "invalid_id" });
    }
    const data = await getEventSvc(idEvent);
    if (!data) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

export async function createEventController(req: AuthRequest, res: Response) {
  try {
    console.log("createEventController");
    const idUser = req.user?.idUser;
    if (!idUser) return res.status(401).json({ ok: false, error: "unauthorized" });

    const { name, startsAtIso, address } = req.body || {};
    if (!name || !startsAtIso || !address?.idCity || !address?.street || address?.streetNum == null) {
      return res.status(400).json({ ok: false, error: "missing_fields" });
    }

    // Normalizar numéricos que podrían venir como string
    if (typeof address.streetNum === "string") address.streetNum = Number(address.streetNum);
    if (typeof req.body.capacityMax === "string") req.body.capacityMax = Number(req.body.capacityMax);
    if (typeof req.body.idStudio === "string") req.body.idStudio = Number(req.body.idStudio);
    if (address.lat != null && typeof address.lat === "string") address.lat = Number(address.lat);
    if (address.lon != null && typeof address.lon === "string") address.lon = Number(address.lon);

    const created = await newEvent(idUser, req.body);
    res.status(201).json({ ok: true, data: created });
  } catch (err: any) {
    const code =
      [
        "Faltan datos para crear la dirección",
        "name_required",
        "starts_required",
        "invalid_startsAt",
        "invalid_endsAt",
        "ends_before_starts",
        "invalid_visibility",
      ].includes(err.message)
        ? 400
        : 500;
    res.status(code).json({ ok: false, error: err.message });
  }
}

export async function updateEventController(req: AuthRequest, res: Response) {
  try {
    const idUser = req.user?.idUser;
    if (!idUser) return res.status(401).json({ ok: false, error: "unauthorized" });

    const idEvent = Number(req.params.idEvent);
    if (!Number.isFinite(idEvent)) {
      return res.status(400).json({ ok: false, error: "invalid_id" });
    }

    // Normalizar posibles strings
    if (typeof req.body.capacityMax === "string") req.body.capacityMax = Number(req.body.capacityMax);
    if (req.body?.address && typeof req.body.address.streetNum === "string") {
      req.body.address.streetNum = Number(req.body.address.streetNum);
    }

    await updateEventSvc(idEvent, idUser, req.body || {});
    const data = await getEventSvc(idEvent);
    if (!data) return res.status(404).json({ ok: false, error: "not_found" });
    res.json({ ok: true, data });
  } catch (err: any) {
    const code =
      err.message === "forbidden_or_not_found"
        ? 403
        : ["invalid_startsAt", "invalid_endsAt", "ends_before_starts", "invalid_visibility"].includes(err.message)
          ? 400
          : 500;
    res.status(code).json({ ok: false, error: err.message });
  }
}

export async function deleteEventController(req: AuthRequest, res: Response) {
  try {
    const idUser = req.user?.idUser;
    if (!idUser) return res.status(401).json({ ok: false, error: "unauthorized" });

    const idEvent = Number(req.params.idEvent);
    if (!Number.isFinite(idEvent)) {
      return res.status(400).json({ ok: false, error: "invalid_id" });
    }

    await deleteEventSvc(idEvent, idUser);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(err.message === "forbidden_or_not_found" ? 403 : 500).json({ ok: false, error: err.message });
  }
}

export async function createEventInvitesController(req: Request, res: Response) {
  const idEvent = Number(req.params.idEvent);
  if (!Number.isFinite(idEvent)) {
    return res.status(400).json({ ok: false, error: "idEvent inválido" });
  }

  const body = req.body;
  const targets: InviteTarget[] = Array.isArray(body) ? body : (body ? [body] : []);

  if (targets.length === 0) {
    return res.status(400).json({ ok: false, error: "Faltan destinatarios" });
  }

  try {
    const result = await createEventInvites(idEvent, targets);
    return res.json({ ok: true, data: result });
  } catch (e: any) {
    console.error("createEventInvitesController()", e);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

export async function listMyEventsController(req: Request, res: Response) {
  const n = Number(req.query.limit);
  const p = Number(req.query.offset);
  const limit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 100) : 50;
  const offset = Number.isFinite(p) ? Math.max(p, 0) : 0;

  try {
    const idUser = (req as any)?.user?.idUser;
    if (!idUser) return res.status(401).json({ ok: false, error: "No autenticado" });

    const items = await getMyCreatedEvents(idUser, limit, offset);
    return res.json({ ok: true, data: { items, limit, offset } });

  } catch (e: any) {
    console.error("listEventsController()", e);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

export async function searchEventByNameController(req: Request, res: Response) {
  const qRaw = req.query.q;
  const q = String(Array.isArray(qRaw) ? qRaw[0] ?? "" : qRaw ?? "").trim();

  const n = Number(req.query.limit);
  const limit = Number.isFinite(n) ? Math.min(Math.max(n, 1), 50) : 8;

  // misma UX que tus otros search: con menos de 2 chars, devolver vacío
  if (q.length < 2) {
    return res.json({ ok: true, data: { items: [], q, limit } });
  }

  try {
    const items = await searchEventsByName(q, limit);
    return res.json({ ok: true, data: { items, q, limit } });
  } catch (e: any) {
    console.error("searchEventByNameController()", e);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

export async function updateEventLocationController(req: Request, res: Response) {
  try {
    const idEvent = Number(req.params.idEvent);
    const { latitude, longitude } = req.body ?? {};
    const lat = Number(latitude);
    const lon = Number(longitude);

    if (!Number.isFinite(idEvent) || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      return res.status(400).json({ ok: false, error: "invalid_params" });
    }
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
      return res.status(400).json({ ok: false, error: "invalid_coordinates" });
    }

    const updated = await updateEventLocationService(idEvent, lat, lon);
    if (!updated) {
      return res.status(404).json({ ok: false, error: "event_not_found" });
    }

    return res.json({ ok: true, data: updated }); // { idEvent, latitude, longitude }
  } catch (e) {
    console.error("[updateEventLocationController]", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}

export async function getMyAttendingEventsController(req: Request, res: Response) {
  try {
    const idUser = Number((req as any)?.user?.idUser);
    if (!Number.isFinite(idUser)) {
      return res.status(401).json({ ok: false, error: "unauthorized" });
    }

    const items = await getMyAttendingEventsService(idUser);
    return res.json({ ok: true, data: { items } });
  } catch (e) {
    console.error("[getMyAttendingEventsController]", e);
    return res.status(500).json({ ok: false, error: "internal_error" });
  }
}