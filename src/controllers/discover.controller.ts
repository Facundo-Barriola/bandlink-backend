import type { Request, Response } from "express";
import { discoverEventsSvc } from "../services/discover.service.js";

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
