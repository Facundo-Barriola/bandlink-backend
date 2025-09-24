import webpush from "web-push";
import { pool } from "../config/database.js";

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, WEB_PUSH_CONTACT } = process.env;
webpush.setVapidDetails(WEB_PUSH_CONTACT ?? "mailto:no-reply@bandlink", VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);

export async function pushToUser(idUser: number, payload: any) {
  const { rows } = await pool.query(
    `SELECT endpoint, p256dh, auth FROM "Notification"."PushSubscription" WHERE "idUser"=$1`,
    [idUser]
  );
  const json = JSON.stringify(payload);
  for (const s of rows) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        json
      );
      await pool.query(
        `UPDATE "Notification"."PushSubscription" SET "lastUsedAt"=now() WHERE endpoint=$1`,
        [s.endpoint]
      );
    } catch (err: any) {
      // dar de baja endpoints muertos
      if (err?.statusCode === 404 || err?.statusCode === 410) {
        await pool.query(`DELETE FROM "Notification"."PushSubscription" WHERE endpoint=$1`, [s.endpoint]);
      } else {
        console.error("[pushToUser]", err);
      }
    }
  }
}
