// src/controllers/kpis.controller.ts
import type { Request, Response } from "express";
import { getKpisForMusician, getKpisForStudio, getBookingHistoryForStudio } from "../services/kpis.service.js";

export async function kpisOverviewController(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    if (!user?.idUser) return res.status(401).json({ ok: false, error: "unauthorized" });

    // 2 = músico, 3 = sala (según tu app)
    console.log(user);
    const group = Number(user.role);
    console.log(group);
    if (group === 3) {
      const overview = await getKpisForStudio(user.idUser);
      // opcional: historial para la tabla (últimos 90 días)
      const history = await getBookingHistoryForStudio(user.idUser, 90, 100);
      return res.json({ ok: true, role: "studio", data: { overview, history } });
    } else {
      const overview = await getKpisForMusician(user.idUser);
      return res.json({ ok: true, role: "musician", data: { overview } });
    }
  } catch (e: any) {
    console.error(e);
    return res.status(500).json({ ok: false, error: e?.message ?? "server_error" });
  }
}
