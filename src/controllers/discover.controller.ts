import type { Request, Response } from "express";
import { discoverEventsSvc, discoverBandsSvc,  discoverStudiosSvc, discoverMusiciansSvc} from "../services/discover.service.js";

export async function discoverEventsController(req: Request, res: Response) {
  const idUser = (req as any)?.user?.idUser;
  if (!idUser) return res.status(401).json({ ok: false, error: "unauthorized" });

  const limit = Math.min(Number(req.query.limit ?? 20), 50);
  const days  = Math.min(Number(req.query.days  ?? 60), 90);

  try {
    const items = await discoverEventsSvc(idUser, days, limit);
    res.json({ ok: true, data: { items, limit, days } });
  } catch (e: any) {
    console.error("discoverEventsController()", e);
    res.status(500).json({ ok: false, error: "server_error" });
  }
}

export async function discoverBandsController(req: Request, res: Response) {
  const idUser = (req as any)?.user?.idUser;
  if (!idUser) return res.status(401).json({ ok: false, error: "unauthorized" });
  const limit  = Math.min(Number(req.query.limit ?? 12), 30);

  try {
    const items = await discoverBandsSvc(idUser, limit);
    res.json({ ok: true, data: { items, limit } });
  } catch (e:any) {
    res.status(500).json({ ok: false, error: e?.message ?? "server_error" });
  }
}

export async function discoverStudiosController(req: Request, res: Response) {
  const idUser = (req as any)?.user?.idUser;
  if (!idUser) return res.status(401).json({ ok: false, error: "unauthorized" });
  const limit = Math.min(Number(req.query.limit ?? 9), 30);

  try {
    const items = await discoverStudiosSvc(idUser, limit);
    res.json({ ok: true, data: { items, limit } });
  } catch (e:any) {
    res.status(500).json({ ok: false, error: e?.message ?? "server_error" });
  }
}

export async function discoverMusiciansController(req: Request, res: Response) {
  const idUser = (req as any)?.user?.idUser;
  if (!idUser) return res.status(401).json({ ok: false, error: "unauthorized" });
  const limit = Math.min(Number(req.query.limit ?? 12), 40);

  try {
    const items = await discoverMusiciansSvc(idUser, limit);
    res.json({ ok: true, data: { items, limit } });
  } catch (e:any) {
    res.status(500).json({ ok: false, error: e?.message ?? "server_error" });
  }
}