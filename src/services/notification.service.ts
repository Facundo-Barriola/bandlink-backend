import { sendMail } from "../config/mailer.js";
import {pool} from "../config/database.js";
import { pushToUser } from "./push.service.js";

export function bookingConfirmedHtml(args: {
  userName: string;
  studioName: string;
  roomName: string;
  startsAt: Date;
  endsAt: Date;
  amount: number;
  streetAddress: string;
  streetNumber: number;
  bookingId: number;
}) {
  const f = (d: Date) => new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium", timeStyle: "short"
  }).format(d);
  const amount = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(args.amount);
  const link = `${process.env.APP_URL ?? "http://localhost:3000"}/reservas/${args.bookingId}`;

  return `
  <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto">
    <h2>¡Reserva confirmada!</h2>
    <p>Hola ${args.userName},</p>
    <p>Confirmamos tu reserva en <b>${args.studioName}</b> 
    la sala: <b>${args.roomName}</b>.</p>
    <ul>
      <li><b>Desde:</b> ${f(args.startsAt)}</li>
      <li><b>Hasta:</b> ${f(args.endsAt)}</li>
      <li><b>Importe:</b> ${amount}</li>
      <li><b>Nº de reserva:</b> ${args.bookingId}</li>
    </ul>
    <p>Dirección: ${args.streetAddress} ${args.streetNumber}</p>
    <p>Podés ver los detalles y gestionar la reserva acá:</p>
    <p><a href="${link}">${link}</a></p>
    <p>— Equipo BandLink</p>
  </div>`;
}

export async function notifyBookingConfirmed(params: {
  userEmail: string;
  userName: string;
  studioName: string;
  roomName: string;
  startsAt: Date;
  endsAt: Date;
  amount: number;
  streetAddress: string;
  streetNumber: number;
  bookingId: number;
}) {
  const html = bookingConfirmedHtml(params);
  await sendMail(params.userEmail, "Reserva confirmada", html);
}

export async function notifyUser(
  idUser: number,
  n: { type: string; title?: string; body?: string; data?: any; channel?: "push" | "email" | "inapp" | "sse" }
) {
  const channel = n.channel ?? "push";

  const pref = await pool.query(
    `SELECT allowpush, allowemail, allowinapp
       FROM "Notification"."Preference"
      WHERE "idUser"=$1`,
    [idUser]
  );
  const P = pref.rows[0] ?? { allowpush: true, allowemail: true, allowinapp: true };

  const { rows } = await pool.query(
    `INSERT INTO "Notification"."Notification"("idUser", type, title, body, data, channel)
     VALUES ($1,$2,$3,$4,$5,$6)
     RETURNING "idNotification", createdat`,
    [idUser, n.type, n.title ?? null, n.body ?? null, n.data ?? null, channel]
  );

  if (channel === "push" && P.allowpush) {
    await pushToUser(idUser, {
      type: n.type,
      title: n.title ?? "BandLink",
      body: n.body ?? "",
      data: n.data ?? {},
      idNotification: rows[0].idnotification,
    }).catch(console.error);
  }

  if (channel === "email" && P.allowemail && n.title) {
    await sendMail(
      (await pool.query(`SELECT email FROM "Security"."User" WHERE "idUser"=$1`, [idUser])).rows[0]?.email ?? "",
      n.title,
      `<p>${n.body ?? ""}</p>`
    ).catch(console.error);
  }

  return rows[0];
}