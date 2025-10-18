// src/repositories/payment.repository.ts
import { pool } from "../config/database.js";
import { PoolClient } from "pg";

export async function getBookingForPayment(idBooking: number) {
  const sql = `
    SELECT b."idBooking", b."idUser", b."startsAt", b."endsAt",
           b."pricePerHour", b."totalAmount", b.status,
           s."idStudio"
      FROM "Directory"."RoomBooking" b
      JOIN "Directory"."StudioRoom" r ON r."idRoom" = b."idRoom"
      JOIN "Directory"."Studio"     s ON s."idStudio" = r."idStudio"
     WHERE b."idBooking" = $1
  `;
  const { rows } = await pool.query(sql, [idBooking]);
  return rows[0] ?? null;
}

/**
 * Crea una fila de Payment "created" para una reserva,
 * cancelando cualquier intento previo activo (created/pending/in_process).
 */
export async function upsertActivePayment(params: {
  idBooking: number;
  amount: number;
  currency: string;
  provider: string;
  providerPrefId: string; // preference_id de MP
  payerIdUser?: number | null;
  payerEmail?: string | null;
  idMpAccount: number;
  collectorId?: number | null;
}) {
  const { idBooking, amount, currency, provider, providerPrefId, payerIdUser, payerEmail, idMpAccount, collectorId } = params;

  // Cancelá un intento activo anterior (si lo hubiera)
  const sel = `
    SELECT * FROM "Billing"."Payment"
    WHERE "idBooking"=$1 AND status IN ('created','pending','in_process')
    ORDER BY "idPayment" DESC
    LIMIT 1
  `;
  const prev = await pool.query(sel, [idBooking]);
  if (prev.rows[0]) {
    await pool.query(
      `UPDATE "Billing"."Payment"
         SET status='canceled', "updatedAt"=now()
       WHERE "idPayment"=$1`,
      [prev.rows[0].idPayment]
    );
  }

  // Insert nuevo intento
  const ins = `
    INSERT INTO "Billing"."Payment"
    ("idBooking", amount, currency, provider, "providerPrefId",
    status, "payerIdUser", "payerEmail", "idMpAccount", "collectorId")
    VALUES ($1,$2,$3,$4,$5,'created',$6,$7,$8,$9)
    RETURNING *
  `;
  const r2 = await pool.query(ins, [
    idBooking, amount, currency, provider, providerPrefId,
    payerIdUser ?? null, payerEmail ?? null,
    idMpAccount,
    collectorId ?? null
  ]);
  return r2.rows[0];
}

/**
 * Marca estado por providerPaymentId (legado).
 * Úsalo si estás 100% seguro de que ya seteaste el providerPaymentId.
 */
export async function markPaymentStatus(providerPaymentId: string, status: string, paidAt: Date | null) {
  const upd = `
    UPDATE "Billing"."Payment"
       SET status=$2,
           "paidAt"=COALESCE($3, "paidAt"),
           "providerPaymentId"=$1,
           "updatedAt"=now()
     WHERE "providerPaymentId" IS NULL OR "providerPaymentId"=$1
     RETURNING *
  `;
  const { rows } = await pool.query(upd, [providerPaymentId, status, paidAt]);
  return rows[0] ?? null;
}

/**
 * Marca estado por id interno (RECOMENDADO desde el webhook).
 * Es idempotente respecto a "paidAt" (solo pisa si viene no-nulo).
 */
export async function markPaymentStatusById(idPayment: number, status: string, paidAt: Date | null) {
  const upd = `
    UPDATE "Billing"."Payment"
       SET status=$2,
           "paidAt"=COALESCE($3, "paidAt"),
           "updatedAt"=now()
     WHERE "idPayment"=$1
     RETURNING *
  `;
  const { rows } = await pool.query(upd, [idPayment, status, paidAt]);
  return rows[0] ?? null;
}

/**
 * Enlaza el providerPaymentId (id de MP) a la fila interna ubicada por preference_id.
 * No pisa si ya estaba seteado.
 */
export async function linkProviderPaymentIdByPref(prefId: string, providerPaymentId: string) {
  const upd = `
    UPDATE "Billing"."Payment"
       SET "providerPaymentId" = COALESCE("providerPaymentId", $2),
           "updatedAt"=now()
     WHERE "providerPrefId" = $1
     RETURNING *
  `;
  const { rows } = await pool.query(upd, [prefId, providerPaymentId]);
  return rows[0] ?? null;
}

/** Guarda evento de auditoría para el pago. */
export async function addPaymentEvent(idPayment: number, provider: string, eventType: string, payload: any) {
  const ins = `
    INSERT INTO "Billing"."Payment" ("idPayment") VALUES ($1)
    ON CONFLICT DO NOTHING; -- por si llega evento antes que la fila (no debería, pero por las dudas)
  `;
  // Intenta crear esqueleto si no existe; ignorable si ya existe
  try { await pool.query(ins, [idPayment]); } catch { }

  const ev = `
    INSERT INTO "Billing"."PaymentEvent"("idPayment", provider, "eventType", payload)
    VALUES ($1,$2,$3,$4)
  `;
  await pool.query(ev, [idPayment, provider, eventType, payload]);
}

/** Marca la reserva como 'paid'. (Si querés, podés también setear 'paidAt' en booking si existe esa columna). */
export async function setBookingPaid(idBooking: number) {
  const upd = `
    UPDATE "Directory"."RoomBooking"
       SET status='paid', "updatedAt"=now()
     WHERE "idBooking"=$1
  `;
  await pool.query(upd, [idBooking]);
}

/** Busca por preference_id (mapeo 1:1 creado al armar la preferencia). */
export async function findPaymentByProviderPref(prefId: string) {
  const sql = `SELECT * FROM "Billing"."Payment" WHERE "providerPrefId"=$1 LIMIT 1`;
  const { rows } = await pool.query(sql, [prefId]);
  return rows[0] ?? null;
}

/** (Útil si querés ubicar por id de MP directamente.) */
export async function findPaymentByProviderPaymentId(providerPaymentId: string) {
  const sql = `SELECT * FROM "Billing"."Payment" WHERE "providerPaymentId"=$1 LIMIT 1`;
  const { rows } = await pool.query(sql, [providerPaymentId]);
  return rows[0] ?? null;
}

/** Fallback por booking: toma el último intento (sea created/pending/approved, no canceled/failed). */
export async function findActivePaymentByBookingId(idBooking: number) {
  const sql = `
    SELECT *
      FROM "Billing"."Payment"
     WHERE "idBooking"=$1
       AND status NOT IN ('canceled','rejected','refunded','charged_back','cancelled')
     ORDER BY "idPayment" DESC
     LIMIT 1
  `;
  const { rows } = await pool.query(sql, [idBooking]);
  return rows[0] ?? null;
}

/** Estado de pago “colapsado” por reserva (para UI o validación). */
export async function getPaidStatusForBooking(client: PoolClient, idBooking: number) {
  const { rows } = await client.query(
    `
      SELECT p."idPayment", p.status
        FROM "Billing"."Payment" p
       WHERE p."idBooking" = $1
       ORDER BY p."idPayment" DESC
       LIMIT 1
    `,
    [idBooking]
  );
  const p = rows[0];
  if (!p) return { hasPayment: false, isPaid: false };
  const isPaid = ['approved', 'paid', 'completed', 'accredited'].includes((p.status || '').toLowerCase());
  return { hasPayment: true, isPaid };
}

export async function applyRefundById(
  idPayment: number,
  refundAmount?: number | null,
  forceStatus?: "refunded" | "partially_refunded"
) {
  const upd = `
    UPDATE "Billing"."Payment"
       SET "refundedAmount" = COALESCE("refundedAmount", 0) + COALESCE($2, 0),
           status = COALESCE($3, status),
           "updatedAt" = now()
     WHERE "idPayment" = $1
     RETURNING *
  `;
  const { rows } = await pool.query(upd, [idPayment, refundAmount ?? null, forceStatus ?? null]);
  return rows[0] ?? null;
}

export async function getPaymentById(idPayment: number) {
  const { rows } = await pool.query(`SELECT * FROM "Billing"."Payment" WHERE "idPayment"=$1`, [idPayment]);
  return rows[0] ?? null;
}