import type { Request, Response } from "express";
import { pool } from "../config/database.js";

export async function saveSubscription(req: Request, res: Response) {
  const idUser = (req as any).user?.idUser;
  const { endpoint, keys, userAgent } = req.body ?? {};
  if (!idUser || !endpoint || !keys?.p256dh || !keys?.auth)
    return res.status(400).json({ ok: false, error: "Datos inválidos" });

  await pool.query(
    `INSERT INTO "Notification"."PushSubscription"("idUser", endpoint, p256dh, auth, "userAgent")
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (endpoint) DO UPDATE SET "idUser"=EXCLUDED."idUser", "userAgent"=EXCLUDED."userAgent"`,
    [idUser, endpoint, keys.p256dh, keys.auth, userAgent ?? null]
  );
  res.json({ ok: true });
}

export async function removeSubscription(req: Request, res: Response) {
  const { endpoint } = req.body ?? {};
  if (!endpoint) return res.status(400).json({ ok: false, error: "endpoint requerido" });
  await pool.query(
    `DELETE FROM "Notification"."PushSubscription" WHERE endpoint=$1`,
    [endpoint]
  );
  res.json({ ok: true });
}
