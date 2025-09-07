import { Router } from "express";
import PDFDocument from "pdfkit";
import { getBookingWithPayment } from "../../repositories/booking.repository.js";
// ^ crea este repo si no lo tenés: que devuelva booking + user + sala + pago

const r = Router();

r.get("/bookings/:id/receipt.pdf", async (req, res) => {
  const id = Number(req.params.id);

  const b = await getBookingWithPayment(id);
  if (!b) return res.status(404).send("Reserva no encontrada");

  const doc = new PDFDocument({ size: "A4", margin: 40 });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="comprobante-reserva-${id}.pdf"`);
  doc.pipe(res);

  // Encabezado
  doc.fontSize(18).text("BandLink - Comprobante de Reserva", { align: "center" });
  doc.moveDown();
  doc.fontSize(12).text(`Nº de reserva: ${b.idBooking}`);
  if (b.paymentId) doc.text(`Nº de pago: ${b.paymentId}`);
  doc.text(`Fecha emisión: ${new Date().toLocaleString("es-AR")}`);
  doc.moveDown();

  // Datos
  const fmtMoney = (n: number) =>
    new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" }).format(n);

  doc.text(`Cliente: ${b.user?.name ?? b.user?.email ?? "-"}`);
  doc.text(`Email: ${b.user?.email ?? "-"}`);
  doc.text(`Sala: ${b.room?.name ?? b.room.name ?? "-"}`);
  doc.text(`Desde: ${new Date(b.startsAt).toLocaleString("es-AR")}`);
  doc.text(`Hasta: ${new Date(b.endsAt).toLocaleString("es-AR")}`);
  doc.text(`Estado: ${b.status}`);
  doc.moveDown();

  // Totales
  const amount = Number(b.totalAmount ?? 0);
  doc.fontSize(14).text(`Total: ${fmtMoney(amount)}`, { align: "right" });
  doc.moveDown();

  doc.fontSize(10).text("Este comprobante no reemplaza la factura fiscal. Para consultas, responda este email.");
  doc.end();
});

export default r;
