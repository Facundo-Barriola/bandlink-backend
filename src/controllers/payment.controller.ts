import type { Response } from "express";
import type { AuthRequest } from "../types/authRequest.js";
import { createPaymentForBooking, handleWebhook } from "../services/payment.service.js";

export async function createPaymentForBookingController(req: AuthRequest, res: Response) {
  const idUser = req.user?.idUser as number;
  const idBooking = Number(req.params.idBooking);
  const { email } = req.body ?? {};
  if (!Number.isFinite(idBooking)) return res.status(400).json({ ok: false, error: "idBooking inválido" });

  try {
    const r = await createPaymentForBooking(idBooking, idUser, email);
    if (!r.ok) return res.status(400).json(r);
    return res.json(r);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ ok: false, error: "Error creando pago" });
  }
}

export async function webhookController(req: AuthRequest, res: Response) {
  try {
    const result = await handleWebhook(req.body, req.headers as any);
    if (!result.ok) return res.status(400).json(result);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("webhook error", e);
    return res.status(500).json({ ok: false });
  }
}
