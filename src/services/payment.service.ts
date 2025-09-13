import { mercadopago, mpClient } from "../config/mercadopago.js";
import { Preference, Payment, MerchantOrder } from "mercadopago";
import {
    getBookingForPayment, upsertActivePayment, markPaymentStatus,
    addPaymentEvent, setBookingPaid, findPaymentByProviderPref, findActivePaymentByBookingId,
    linkProviderPaymentIdByPref,     // <-- NUEVO
  markPaymentStatusById
} from "../repositories/payment.repository.js";

function unwrapMP<T extends object>(r: any): T {
    if (r && typeof r === "object") {
        if ("body" in r && r.body) return r.body as T;
        if ("response" in r && r.response) return r.response as T;
    }
    return r as T;
}

async function fetchPaymentWithRetry(id: number, tries = 5, delay = 500) {
  for (let i = 0; i < tries; i++) {
    try {
      const resp = await new Payment(mpClient).get({ id });
      return (resp as any).body ?? resp;
    } catch (e: any) {
      if (e?.status !== 404 || i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error("Unreachable");
}


function round2(n: number) { return Math.round(n * 100) / 100; }

export async function createPaymentForBooking(idBooking: number, idUser: number, payerEmail?: string) {
    console.log("IdBooking Service:", idBooking, idUser, payerEmail);
    const b = await getBookingForPayment(idBooking);
    if (!b) return { ok: false, error: "Reserva inexistente" };
    if (b.status !== "confirmed" && b.status !== "paid") return { ok: false, error: `Estado inválido: ${b.status}` };
    if (b.status === "paid") return { ok: true, info: "Ya está paga", alreadyPaid: true };

    const hours = (new Date(b.endsAt).getTime() - new Date(b.startsAt).getTime()) / 3600000;
    const price = Number(b.totalAmount ?? (Number(b.pricePerHour ?? 0) * hours));
    const amount = round2(price);
    console.log("Amount a cobrar:", amount);
    // Crear preference en MP
    //const email = "TESTUSER5463626794354640670";
    console.log(process.env.MP_PUBLIC_URL )
    const preference = {
        items: [{
            title: `Reserva sala #${idBooking}`,
            quantity: 1,
            currency_id: "ARS",
            unit_price: amount
        }],
        statement_descriptor: "BandLink",
        back_urls: {
            success: process.env.CLIENT_ORIGIN + `/home/${idUser}`,
            failure: process.env.CLIENT_ORIGIN + `/home/${idUser}`,
            pending: process.env.CLIENT_ORIGIN + `/home/${idUser}`,
        },
        //auto_return: "approved",
        binary_mode: true,       
        payer: payerEmail ? { email: payerEmail } : undefined,
        external_reference: `booking:${idBooking}`,       
        metadata: { bookingId: idBooking, env: 'dev' },
        notification_url: (process.env.MP_PUBLIC_URL ?? "http://localhost:4000") + "/payments/webhook"
    };

    try {
        const prefRes = await new Preference(mpClient).create({ body: preference as any });
        const pref = unwrapMP<any>(prefRes);

        // Extrae con tolerancia de llaves (distintos nombres en minores)
        const prefId: string | undefined = pref.id ?? pref.preference_id;
        const collectorId: number | undefined =
            pref.collector_id ?? pref.collector?.id ?? pref.payer?.collector?.id;
        const sandboxInitPoint: string | undefined =
            pref.sandbox_init_point ?? pref.sandboxInitPoint;
        const initPoint: string | undefined =
            pref.init_point ?? pref.initPoint;

        if (!prefId) {
            throw new Error("Mercado Pago no devolvió un preferenceId en la respuesta");
        }
        const payment = await upsertActivePayment({
            idBooking,
            amount,
            currency: "ARS",
            provider: "mercadopago",
            providerPrefId: prefId,          // <- ahora es string
            payerIdUser: idUser ?? null,     // opcional: si querés permitir null
            payerEmail: payerEmail ?? null,
        });
        console.log("", prefId, payment.idPayment, initPoint)

        return { ok: true, preferenceId: prefId, idPayment: payment.idPayment, initPoint };

    } catch (e: any) {
        console.error("[MP] Preference.create error", {
            name: e?.name,
            message: e?.message,
            status: e?.status,
            error: e?.error,
            cause: e?.cause,
            requestAuth: e?.request?.headers?.Authorization, // debería ser 'Bearer TEST-...'
        });
        throw e;
    }

}

export async function handleWebhook(payload: any, headers: Record<string, string>) {
  const topic = payload?.type || payload?.topic;
  const paymentId = payload?.data?.id || payload?.resource?.split("/").pop();

  if (!paymentId) return { ok: false, info: "Sin payment id" };

  // 1) Leer el pago con retry (evita 404 por latencia)
  const p = await fetchPaymentWithRetry(Number(paymentId));

  console.log("[MP][webhook] topic:", topic, "paymentId:", paymentId);
  console.log("[MP][webhook] status:", p.status, "status_detail:", p.status_detail);
  console.log("[MP][webhook] order.id:", p.order?.id,
              "ext_ref:", p.external_reference,
              "meta:", p.metadata);

  // 2) Intentos de resolución
  let bookingIdFromMeta = p?.metadata?.bookingId ?? null;
  let externalRef: string | null = p?.external_reference ?? null;

  // 2.a) Conseguir preference_id real vía Merchant Order (order.id = merchant_order_id)
  let prefId: string | null = p?.metadata?.preference_id ?? null; // suele venir vacío
  if (!prefId && p?.order?.id) {
    const mo = unwrapMP<any>(await new MerchantOrder(mpClient).get({ merchantOrderId: String(p.order.id) }));
    prefId = mo?.preference_id ?? null;
    if (!externalRef) externalRef = mo?.external_reference ?? null;
  }

  // 2.b) Linkear el providerPaymentId en nuestra fila cuando tengamos prefId
  if (prefId) {
    await linkProviderPaymentIdByPref(prefId, String(paymentId));
  }

  // 3) Ubicar el pago interno
  let paymentRow = null;
  if (prefId) {
    paymentRow = await findPaymentByProviderPref(prefId);
  }
  if (!paymentRow && bookingIdFromMeta) {
    paymentRow = await findActivePaymentByBookingId(Number(bookingIdFromMeta));
  }
  if (!paymentRow && externalRef?.startsWith("booking:")) {
    const bId = Number(externalRef.split(":")[1]);
    if (Number.isFinite(bId)) {
      paymentRow = await findActivePaymentByBookingId(bId);
    }
  }

  if (!paymentRow) {
    await addPaymentEvent(null as any, "mercadopago", "unmatched", { paymentId, prefId, externalRef, meta: p?.metadata });
    return { ok: false, info: "Payment interno no encontrado" };
  }

  // 4) Registrar evento y actualizar estado por ID INTERNO (idempotente)
  const paidAt = p?.date_approved ? new Date(p.date_approved) : null;

  await addPaymentEvent(paymentRow.idPayment, "mercadopago", topic ?? "payment", p);
  await markPaymentStatusById(paymentRow.idPayment, p.status, paidAt);

  if (p.status === "approved") {
    await setBookingPaid(paymentRow.idBooking);
  }

  return { ok: true };
}

