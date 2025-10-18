import type { PaymentProvider, CreatePaymentForBookingParams, CreatePaymentResult } from "./types.js";
import { createPaymentForBooking as mpCreate } from "../../payment.service.js"; 

export const MercadoPagoProvider: PaymentProvider = {
  async createPaymentForBooking(p: CreatePaymentForBookingParams): Promise<CreatePaymentResult> {
    const r = await mpCreate(p.idBooking, p.idUser, p.email ?? undefined);
    if (!r?.ok) return { ok: false, error: r?.error ?? "MP error" };
    if( !r.preferenceId || !r.initPoint ) return { ok: false, error: "MP response missing data" };
    return { ok: true, provider: "mp", preferenceId: r.preferenceId, initPoint: r.initPoint };
  },
};

import fetch from "node-fetch";

export async function mpRefund(paymentId: string, accessToken: string, amount?: number) {
  // Si no pasás amount, MP hace reembolso total
  const url = `https://api.mercadopago.com/v1/payments/${paymentId}/refunds`;
  const body = amount ? { amount } : {};
  const r = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`MP refund failed: ${r.status} ${txt}`);
  }
  return await r.json();
}

