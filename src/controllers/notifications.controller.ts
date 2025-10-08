import type { Response } from "express";
import type { AuthRequest } from "../types/authRequest.js";
import { pool } from "../config/database.js";
import { notifyUser } from "../services/notification.service.js";

function rowToCamel(r: any) {
  return {
    idNotification: r.idnotification,
    type: r.type,
    title: r.title,
    body: r.body,
    data: r.data,
    channel: r.channel,
    createdAt: r.createdat,
    deliveredAt: r.deliveredat,
    readAt: r.readat,
  };
}

export async function listMyNotifications(req: AuthRequest, res: Response) {
  const idUser = req.user?.idUser!;
  const limit = Math.min(Number(req.query.limit ?? 20), 100);
  const before = req.query.before ? new Date(String(req.query.before)) : null;
  const unreadOnly = String(req.query.unreadOnly ?? "false") === "true";

  const params: any[] = [idUser];
  let where = `"idUser" = $1`;
  if (before) { params.push(before); where += ` AND createdat < $${params.length}`; }
  if (unreadOnly) where += ` AND readat IS NULL`;

  const { rows } = await pool.query(
    `SELECT "idNotification", type, title, body, data, channel, createdat, deliveredat, readat
     FROM "Notification"."Notification"
     WHERE ${where}
     ORDER BY createdat DESC
     LIMIT ${limit}`,
    params
  );
  res.json({ ok: true, data: rows.map(rowToCamel) });
}

export async function markAsRead(req: AuthRequest, res: Response) {
  const idUser = req.user?.idUser!;
  const id = Number(req.params.id);
  await pool.query(
    `UPDATE "Notification"."Notification"
       SET readat = COALESCE(readat, now())
     WHERE "idNotification"=$1 AND "idUser"=$2`,
    [id, idUser]
  );
  res.json({ ok: true });
}

export async function markAllRead(req: AuthRequest, res: Response) {
  const idUser = req.user?.idUser!;
  const before = req.body?.before ? new Date(String(req.body.before)) : null;
  const params: any[] = [idUser];
  let where = `"idUser"=$1 AND readat IS NULL`;
  if (before) { params.push(before); where += ` AND createdat <= $${params.length}`; }
  await pool.query(
    `UPDATE "Notification"."Notification"
       SET readat = now()
     WHERE ${where}`, params
  );
  res.json({ ok: true });
}

export async function getPreferences(req: AuthRequest, res: Response) {
  const idUser = req.user?.idUser!;
  const { rows } = await pool.query(
    `SELECT allowpush, allowemail, allowinapp
       FROM "Notification"."Preference"
      WHERE "idUser"=$1`,
    [idUser]
  );
  res.json({
    ok: true,
    data: rows[0] ?? { allowpush: true, allowemail: true, allowinapp: true }
  });
}

export async function updatePreferences(req: AuthRequest, res: Response) {
  const idUser = req.user?.idUser!;
  const { allowpush, allowemail, allowinapp } = req.body ?? {};
  await pool.query(
    `INSERT INTO "Notification"."Preference"("idUser", allowpush, allowemail, allowinapp)
     VALUES ($1, COALESCE($2,true), COALESCE($3,true), COALESCE($4,true))
     ON CONFLICT ("idUser") DO UPDATE SET
       allowpush = EXCLUDED.allowpush,
       allowemail = EXCLUDED.allowemail,
       allowinapp = EXCLUDED.allowinapp`,
    [idUser, allowpush, allowemail, allowinapp]
  );
  res.json({ ok: true });
}

export async function sendTest(req: AuthRequest, res: Response) {
  const idUser = req.user?.idUser!;
  const r = await notifyUser(idUser, {
    type: "test",
    title: "🔔 Notificaciones activas",
    body: "Esta es una notificación de prueba",
    data: { url: "/" },
    channel: "push",
  });
  res.json({ ok: true, data: r });
}

export async function notifyFollowersOfBand(idBand: number, type: string, title: string, body: string, data: any) {
  const { rows } = await pool.query(`
    select bf."idUser"
    from "Directory"."BandFollow" bf
    where bf."idBand" = $1
  `, [idBand]);

  if (!rows.length) return;
  const values = rows.map((r, i) =>
    `($${i*5+1}, $${i*5+2}, $${i*5+3}, $${i*5+4}::jsonb, now())`
  ).join(",");

  const params:any[] = [];
  rows.forEach((r:any) => {
    params.push(r.idUser, type, title, body, JSON.stringify(data ?? {}));
  });

  await pool.query(`
    insert into "Notification"."Notification"("idUser", type, title, body, data, createdat)
    values ${values}
  `, params);
}