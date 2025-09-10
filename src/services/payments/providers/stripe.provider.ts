import Stripe from "stripe";
import type { PaymentProvider, CreatePaymentForBookingParams, CreatePaymentResult } from "./types.js";
import { pool } from "../../../config/database.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-08-27.basil" });

export const StripeProvider: PaymentProvider = {
    async createPaymentForBooking({ idBooking, idUser, email }: CreatePaymentForBookingParams): Promise<CreatePaymentResult> {
        // 1) Traer booking y monto
        const client = await pool.connect();
        try {
            const { rows } = await client.query(
                `
        SELECT b."idBooking",
               p."idPayment",
               p.amount,
               TRIM(p.currency) AS currency
        FROM "Directory"."RoomBooking" b
        LEFT JOIN LATERAL (
          SELECT p2."idPayment", p2.amount, p2.currency
          FROM "Billing"."Payment" p2
          WHERE p2."idBooking" = b."idBooking"
          ORDER BY p2."createdAt" DESC
          LIMIT 1
        ) p ON TRUE
        WHERE b."idBooking" = $1
        `,
                [idBooking]
            );
            if (rows.length === 0) return { ok: false, error: "Reserva no encontrada" };
            const row = rows[0];
            let amount = Number(row.amount);
            const isTest = process.env.NODE_ENV !== "production";
            let currency = (row.currency || "usd").toString().trim().toLowerCase();
            if (isTest) currency = "usd"; // 🔴 fuerza USD en test

            const amountInCents = Math.round(Number(amount) * 100);
            if (!Number.isFinite(amountInCents) || amountInCents < 50) {
                return { ok: false, error: "Monto inválido (mínimo 0.50)" };
            }

            if (!Number.isFinite(amount) || amount <= 0) {
                // fallback a totalAmount de la reserva
                const r2 = await client.query(
                    `SELECT COALESCE("totalAmount", 0) AS total FROM "Directory"."RoomBooking" WHERE "idBooking" = $1`,
                    [idBooking]
                );
                amount = Number(r2.rows?.[0]?.total ?? 0);
            }
            if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Monto inválido para la reserva" };

            const intent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100),        // centavos
                currency,
                ...(email ? { receipt_email: email } : {}),
                automatic_payment_methods: { enabled: true },
                metadata: { idBooking: String(idBooking), idUser: String(idUser) },
            });

            // (Opcional) persistí intent.id en Billing.Payment.providerPaymentId
            if (row.idPayment) {
                await client.query(
                    `UPDATE "Billing"."Payment"
                    SET "provider"='stripe', "providerPaymentId"=$2, status='paid',"updatedAt"=now(), "paidAt" =now()
                    WHERE "idPayment"=$1 AND status='pending'`,
                    [row.idPayment, intent.id]
                );
            }

            return { ok: true, provider: "stripe", clientSecret: intent.client_secret! };
        } finally {
            client.release();
        }
    },
};

export async function stripeRefund(paymentIntentId: string, amountCents?: number) {
  const refund = await stripe.refunds.create({
    payment_intent: paymentIntentId,
    ...(amountCents ? { amount: amountCents } : {}),
  });
  return refund;
}
