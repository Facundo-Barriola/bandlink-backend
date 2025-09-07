import { sendMail } from "../config/mailer.js";

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
