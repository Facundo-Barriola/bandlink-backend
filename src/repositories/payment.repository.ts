import { pool } from "../config/database.js";
import { PoolClient } from "pg";

export async function getBookingForPayment(idBooking: number) {
  console.log(idBooking);
  const sql = `
    SELECT b."idBooking", b."idUser", b."startsAt", b."endsAt",
           b."pricePerHour", b."totalAmount", b.status
    FROM "Directory"."RoomBooking" b
    WHERE b."idBooking" = $1
  `;
  const { rows } = await pool.query(sql, [idBooking]);
  return rows[0] ?? null;
}

export async function upsertActivePayment(params: {
  idBooking: number;
  amount: number;
  currency: string;
  provider: string;
  providerPrefId: string;
  payerIdUser?: number | null;
  payerEmail?: string | null;
}) {
  const { idBooking, amount, currency, provider, providerPrefId, payerIdUser, payerEmail } = params;
  // Intenta reutilizar si ya existe uno activo
  console.log("upsertActivePayment");
  const sel = `
    SELECT * FROM "Billing"."Payment"
    WHERE "idBooking"=$1 AND status IN ('created','pending','in_process')
    LIMIT 1
  `;
  const { rows } = await pool.query(sel, [idBooking]);
  console.log(rows[0]);
  if (rows[0]) return rows[0];

  const ins = `
    INSERT INTO "Billing"."Payment"
      ("idBooking", amount, currency, provider, "providerPrefId", status, "payerIdUser", "payerEmail")
    VALUES ($1,$2,$3,$4,$5,'pending',$6,$7)
    RETURNING *
  `;
  console.log("Llego aca");
  const r2 = await pool.query(ins, [idBooking, amount, currency, provider, providerPrefId, payerIdUser ?? null, payerEmail ?? null]);
  return r2.rows[0];
}

export async function markPaymentStatus(providerPaymentId: string, status: string, paidAt: Date | null) {
  const upd = `
    UPDATE "Billing"."Payment"
    SET status=$2, "paidAt"=COALESCE($3, "paidAt"), "providerPaymentId"=$1
    WHERE "providerPaymentId" IS NULL OR "providerPaymentId"=$1
    RETURNING *
  `;
  const { rows } = await pool.query(upd, [providerPaymentId, status, paidAt]);
  return rows[0] ?? null;
}

export async function addPaymentEvent(idPayment: number, provider: string, eventType: string, payload: any) {
  const ins = `
    INSERT INTO "Billing"."PaymentEvent"("idPayment", provider, "eventType", payload)
    VALUES ($1,$2,$3,$4)
  `;
  await pool.query(ins, [idPayment, provider, eventType, payload]);
}

export async function setBookingPaid(idBooking: number) {
  const upd = `
    UPDATE "Directory"."RoomBooking"
    SET status='paid', "updatedAt"=now()
    WHERE "idBooking"=$1
  `;
  await pool.query(upd, [idBooking]);
}

export async function findPaymentByProviderPref(prefId: string) {
  const sql = `SELECT * FROM "Billing"."Payment" WHERE "providerPrefId"=$1 LIMIT 1`;
  const { rows } = await pool.query(sql, [prefId]);
  return rows[0] ?? null;
}

export async function getPaidStatusForBooking(client: PoolClient, idBooking: number) {
    const { rows } = await client.query(
      `
      SELECT p."idPayment", p.status
      FROM "Billing"."Payment" p
      WHERE p."idBooking" = $1
      LIMIT 1
      `,
      [idBooking]
    );
    const p = rows[0];
    if (!p) return { hasPayment: false, isPaid: false };
    // Considerá pagado si está en alguno de estos estados
    const isPaid = ["approved", "paid", "completed"].includes(p.status);
    return { hasPayment: true, isPaid };
  }