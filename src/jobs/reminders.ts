import cron from "node-cron";
import { pool } from "../config/database.js";
import { notifyUser } from "../services/notification.service.js";

cron.schedule("*/25 * * * *", async () => {
  const { rows: events } = await pool.query(`
    SELECT e."idEvent", e.name, e."startsAt", ea."idUser"
    FROM "Directory"."Event" e
    JOIN "Directory"."EventAttendee" ea USING ("idEvent")
    WHERE e."startsAt" BETWEEN now() AND now() + interval '60 minutes'
  `);
  for (const r of events) {
    await notifyUser(r.idUser, {
      type: "event.reminder",
      title: "Recordatorio de evento",
      body: `"${r.name}" empieza pronto`,
      data: { idEvent: r.idEvent }
    });
  }

  const { rows: bookings } = await pool.query(`
    SELECT rb."idBooking", rb."idUser", rb."startsAt"
    FROM "Directory"."RoomBooking" rb
    WHERE rb."startsAt" BETWEEN now() AND now() + interval '60 minutes'
  `);
  for (const b of bookings) {
    await notifyUser(b.idUser, {
      type: "booking.reminder",
      title: "Recordatorio de ensayo",
      body: "Tu reserva comienza en menos de una hora",
      data: { idBooking: b.idBooking }
    });
  }
});
