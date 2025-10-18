import { Request, Response } from "express";
import { MapService } from "../services/map.service.js";

/**
 * GET /directory/studios/near?lat=&lon=&radiusKm=&limit=
 * Responde: { ok: true, data: StudioPOI[] }
 */
export async function studiosNearController(req: Request, res: Response) {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const radiusKm = Number(req.query.radiusKm ?? 5);
    const limitParam = req.query.limit;

    const data = await MapService.getStudiosNear({ 
        lat, 
        lon, 
        radiusKm, 
        ...(limitParam !== undefined ? { limit: Number(limitParam) } : {}),
     });
     console.log(data);
    res.json({ ok: true, data });
  } catch (e: any) {
    const status = e?.status ?? 500;
    res.status(status).json({ ok: false, error: e?.message ?? "server_error" });
  }
}

export async function eventsNearController(req: Request, res: Response) {
  try {
    const lat = Number(req.query.lat);
    const lon = Number(req.query.lon);
    const radiusKm = Number(req.query.radiusKm ?? 5);
    const limitParam = req.query.limit;

    const data = await MapService.getEventsNear({
      lat,
      lon,
      radiusKm,
      ...(limitParam !== undefined ? { limit: Number(limitParam) } : {}),
    });

    res.json({ ok: true, data });
  } catch (e: any) {
    const status = e?.status ?? 500;
    res.status(status).json({ ok: false, error: e?.message ?? "server_error" });
  }
}
