import type { Response } from "express";
import type { AuthRequest } from "../types/authRequest.js";
import { createPaymentForBooking, handleWebhook } from "../services/payment.service.js";
import { getProvider } from "../services/payments/provider.factory.js";

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
    console.log("[MP][webhook] headers:", JSON.stringify(req.headers));
    console.log("[MP][webhook] body:", JSON.stringify(req.body));
    const result = await handleWebhook(req.body, req.headers as any);
    if (!result.ok) return res.status(400).json(result);
    return res.status(200).json({ ok: true });
  } catch (e) {
    console.error("webhook error", e);
    return res.status(500).json({ ok: false });
  }
}

export async function createPaymentForBookingUnifiedController(req: AuthRequest, res: Response) {
  const idUser = req.user?.idUser as number;
  const idBooking = Number(req.params.idBooking);
  const { email, provider } = req.body ?? {};
  if (!Number.isFinite(idBooking)) return res.status(400).json({ ok: false, error: "idBooking inválido" });

  try {
    const prov = getProvider(provider);

    const r = await prov.createPaymentForBooking({ idBooking, idUser, email });
    return res.status(r.ok ? 200 : 400).json(r);
  } catch (e: any) {
    console.error("[createPaymentForBookingUnifiedController]", e);
    return res.status(500).json({ ok: false, error: e?.message ?? "Error" });
  }
}