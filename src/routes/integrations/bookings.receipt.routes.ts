import { Router } from "express";
import PDFDocument from "pdfkit";
import { getBookingWithPayment } from "../../repositories/booking.repository.js";
// ^ crea este repo si no lo tenés: que devuelva booking + user + sala + pago

const r = Router();

r.get("/bookings/:id/receipt.pdf", async (req, res) => {
  const idBooking = Number(req.params.id);
  if (!Number.isFinite(idBooking)) {
    return res.status(400).json({ ok: false, error: "idBooking inválido" });
  }

  const data = await getBookingWithPayment(idBooking);
  if (!data) return res.status(404).json({ ok: false, error: "Reserva no encontrada" });

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="comprobante-${idBooking}.pdf"`);

  doc.pipe(res);

  doc.fontSize(18).text("Comprobante de Reserva", { underline: true });
  doc.moveDown();

  doc.fontSize(12)
    .text(`Reserva #${data.idBooking}`)
    .text(`Inicio: ${data.startsAt}`)
    .text(`Fin: ${data.endsAt}`)
    .text(`Estado reserva: ${data.status}`)
    .moveDown();

  if (data.user) {
    doc.text(`Usuario: ${data.user.name ?? "-"} (${data.user.email ?? "-"})`);
  }
  if (data.room) {
    doc.text(`Sala: ${data.room.name ?? "-"}`);
  }
  if (data.payment) {
    doc.moveDown()
      .text("Pago:")
      .text(`  Proveedor: ${data.payment.provider}`)
      .text(`  Id Pago: ${data.payment.idPayment}`)
      .text(`  Estado: ${data.payment.status}`)
      .text(`  Monto: ${data.payment.amount ?? "-"} ${data.payment.currency ?? ""}`)
      .text(`  Pagado: ${data.payment.paidAt ?? "-"}`);
  }

  doc.end();
});

export default r;
