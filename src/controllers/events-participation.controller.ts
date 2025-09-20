import type { Response } from "express";
import type { AuthRequest } from "../types/authRequest.js";
import {
  attendEventSvc,
  unAttendEventSvc,
  bandJoinEventSvc,
  bandConfirmAttendanceSvc,
} from "../services/events-participation.service.js";

/** POST /events/:idEvent/attendees  -> agendar/unirse (usuario, no creador) */
export async function attendEventController(req: AuthRequest, res: Response) {
  try {
    const idUser = req.user?.idUser;
    if (!idUser) return res.status(401).json({ ok: false, error: "unauthorized" });

    const idEvent = Number(req.params.idEvent);
    if (!Number.isFinite(idEvent)) return res.status(400).json({ ok: false, error: "invalid_id" });

    const data = await attendEventSvc(idEvent, idUser);
    res.json({ ok: true, data });
  } catch (err: any) {
    const map: Record<string, number> = {
      creator_cannot_attend: 403,
      capacity_full: 409,
    };
    res.status(map[err.message] ?? 500).json({ ok: false, error: err.message });
  }
}

/** DELETE /events/:idEvent/attendees -> cancelar agenda */
export async function unAttendEventController(req: AuthRequest, res: Response) {
  try {
    const idUser = req.user?.idUser;
    if (!idUser) return res.status(401).json({ ok: false, error: "unauthorized" });

    const idEvent = Number(req.params.idEvent);
    if (!Number.isFinite(idEvent)) return res.status(400).json({ ok: false, error: "invalid_id" });

    const data = await unAttendEventSvc(idEvent, idUser);
    res.json({ ok: true, data });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err.message });
  }
}

/** POST /events/:idEvent/bands/join  { idBand } -> solicitar unirse (solo admin) */
export async function bandJoinEventController(req: AuthRequest, res: Response) {
  try {
    const idUser = req.user?.idUser;
    if (!idUser) return res.status(401).json({ ok: false, error: "unauthorized" });

    const idEvent = Number(req.params.idEvent);
    const idBand = Number(req.body?.idBand);
    if (!Number.isFinite(idEvent) || !Number.isFinite(idBand)) {
      return res.status(400).json({ ok: false, error: "invalid_params" });
    }

    const data = await bandJoinEventSvc(idEvent, idUser, idBand);
    res.json({ ok: true, data });
  } catch (err: any) {
    const code = err.message === "not_band_admin" ? 403 : 500;
    res.status(code).json({ ok: false, error: err.message });
  }
}

/** POST /events/:idEvent/bands/:idBand/confirm -> confirmar (solo admin) */
export async function bandConfirmAttendanceController(req: AuthRequest, res: Response) {
  try {
    const idUser = req.user?.idUser;
    if (!idUser) return res.status(401).json({ ok: false, error: "unauthorized" });

    const idEvent = Number(req.params.idEvent);
    const idBand = Number(req.params.idBand);
    if (!Number.isFinite(idEvent) || !Number.isFinite(idBand)) {
      return res.status(400).json({ ok: false, error: "invalid_params" });
    }

    const data = await bandConfirmAttendanceSvc(idEvent, idUser, idBand);
    res.json({ ok: true, data });
  } catch (err: any) {
    const code = err.message === "not_band_admin" ? 403 : 500;
    res.status(code).json({ ok: false, error: err.message });
  }
}
