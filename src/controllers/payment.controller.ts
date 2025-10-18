import type { Request, Response } from "express";
import type { AuthRequest } from "../types/authRequest.js";
import { createPaymentForBooking, handleWebhook, refundPayment } from "../services/payment.service.js";
import { getProvider } from "../services/payments/provider.factory.js";
import fs from "fs";
import path from "path";


function ensureDir(p: string) {
  try { fs.mkdirSync(p, { recursive: true }); } catch {}
}

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

export async function webhookController(req: Request, res: Response) {
  
    // 1) obtener raw (lo garantiza app.use("/payments/webhook", express.raw(...)))
  // const raw = Buffer.isBuffer(req.body) ? req.body.toString() : (req as any).rawBody ?? "";

    // 3) ACK rápido para que MP no reintente
  res.sendStatus(200);
   setImmediate(async () => {
    try {
      // Si tenés express.json() global, req.body ya es un objeto
      const raw = Buffer.isBuffer(req.body) ? req.body.toString() : (req as any).rawBody ?? "";
      let payload: any = (req.body && typeof req.body === "object") ? req.body : {};
      if (!Object.keys(payload).length && raw) {
        try { payload = JSON.parse(raw); } catch {}
      }
      await handleWebhook(
        payload,
        Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)])),
        req.query as any
      );
    } catch (e) {
      console.error("[MP WEBHOOK] async error", e);
    }
  });
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

// POST /payments/:idPayment/refund
export async function refundController(req: AuthRequest, res: Response) {
  try {
    const idPayment = Number(req.params.idPayment);
    if (!Number.isFinite(idPayment)) {
      return res.status(400).json({ ok: false, error: "idPayment inválido" });
    }
    // Permisos: acá podés validar que el usuario sea admin de la sala del pago.
    // Por simplicidad, solo requireAuth en la ruta.
    const { amount } = req.body ?? {};
    const amt = amount == null ? undefined : Number(amount);
    if (amt != null && (!Number.isFinite(amt) || amt < 0)) {
      return res.status(400).json({ ok: false, error: "amount inválido" });
    }

    const r = await refundPayment(idPayment, amt);
    return res.status(r.ok ? 200 : 400).json(r);
  } catch (e: any) {
    console.error("[refundController]", e);
    return res.status(500).json({ ok: false, error: e?.message ?? "Error procesando refund" });
  }
}