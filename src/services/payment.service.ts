import { mpClient, mercadopago } from "../config/mercadopago.js";
import { MercadoPagoConfig } from "mercadopago";
import { Preference, Payment, MerchantOrder } from "mercadopago";
import { getMpAccountByStudioId, getMpAccountById } from "../repositories/mpaccount.repository.js";
import {
  getBookingForPayment, upsertActivePayment, markPaymentStatus,
  addPaymentEvent, setBookingPaid, findPaymentByProviderPref, findActivePaymentByBookingId,
  linkProviderPaymentIdByPref,
  markPaymentStatusById, applyRefundById, getPaymentById
} from "../repositories/payment.repository.js";
import { notifyUser, bookingConfirmedHtml } from "./notification.service.js";
import { mpRefund } from "./payments/providers/mp.provider.js";

function unwrapMP<T extends object>(r: any): T {
  if (r && typeof r === "object") {
    if ("body" in r && r.body) return r.body as T;
    if ("response" in r && r.response) return r.response as T;
  }
  return r as T;
}

async function fetchPaymentWithRetry(mpCfg: MercadoPagoConfig, id: number | string, tries = 5, delay = 500) {
  for (let i = 0; i < tries; i++) {
    try {
      const resp = await new Payment(mpCfg).get({ id });
      return (resp as any).body ?? resp;
    } catch (e: any) {
      if (e?.status !== 404 || i === tries - 1) throw e;
      await new Promise(r => setTimeout(r, delay));
      delay *= 2;
    }
  }
  throw new Error("Unreachable");
}

async function getMerchantOrder(mpCfg: MercadoPagoConfig, merchantOrderId: string) {
  const mo = await new MerchantOrder(mpCfg).get({ merchantOrderId });
  return unwrapMP<any>(mo);
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

  const mpAcc = await getMpAccountByStudioId(b.idStudio);
  if (!mpAcc) return { ok: false, error: "La sala no tiene Mercado Pago conectado" };

  const mpCfg = new MercadoPagoConfig({ accessToken: mpAcc.access_token });

  console.log("Amount a cobrar:", amount);
  // Crear preference en MP
  //const email = "TESTUSER5463626794354640670";
  console.log(process.env.MP_PUBLIC_URL)
  const notification_url_base = process.env.MP_PUBLIC_URL ?? "http://localhost:4000";
  const notification_url =
    `${notification_url_base}/payments/webhook?acc=${mpAcc.idMpAccount}&booking=${idBooking}`;
  const platformFeePct = Number(process.env.PLATFORM_FEE_PCT ?? "0");
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
    //metadata: { bookingId: idBooking, env: 'dev' },
    //notification_url: (process.env.MP_PUBLIC_URL ?? "http://localhost:4000") + "/payments/webhook",
    metadata: { bookingId: idBooking, env: 'dev' },
    notification_url,
    ...(platformFeePct > 0 ? { marketplace_fee: round2(amount * platformFeePct / 100) } : {})
  };

  try {
    //const prefRes = await new Preference(mpClient).create({ body: preference as any });
    const prefRes = await new Preference(mpCfg).create({ body: preference as any });
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
      idMpAccount: mpAcc.idMpAccount,
      collectorId: collectorId ?? null,
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

export async function handleWebhook(payload: any, headers: Record<string, string>, query?: Record<string, any>) {
  const topic = payload?.type || payload?.topic;
  const paymentId = payload?.data?.id || payload?.resource?.split("/").pop();

  if (!paymentId) return { ok: false, info: "Sin payment id" };
  let idMpAccount: number|null = query?.acc ? Number(query.acc) : null;
  if (idMpAccount == undefined || idMpAccount == null || !idMpAccount){
    return {ok: false, info: "No existe idMpAccount"}
  }
  let mpAcc = idMpAccount ? await getMpAccountById(idMpAccount) : null;

  // fallback: por booking hint
  if (!mpAcc && query?.booking) {
    const bkId = Number(query.booking);
    if (Number.isFinite(bkId)) {
      const p0 = await findActivePaymentByBookingId(bkId);
      if (p0?.idMpAccount) {
        idMpAccount = p0.idMpAccount;
        mpAcc = await getMpAccountById(idMpAccount);
      }
    }
  }
  if (!mpAcc) {
    console.warn("[MP][webhook] No se pudo resolver MpAccount (falta acc/booking). Abort.");
    return { ok: false, info: "mpAccount not resolved" };
  }
  const mpCfg = new MercadoPagoConfig({ accessToken: mpAcc.access_token });

  // 1) Leer el pago con retry usando el token de la sala (evita 404 por latencia)
  const p = await fetchPaymentWithRetry(mpCfg, String(paymentId));


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
    const mo = await getMerchantOrder(mpCfg, String(p.order.id));
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
  if (p.status === "approved") {
    if (paymentRow) {
      await setBookingPaid(paymentRow.idBooking);
    }

    if (paymentRow) {
      const b = await getBookingForPayment(paymentRow.idBooking);
      if (b?.idUser) {
        // Push rápido
        await notifyUser(b.idUser, {
          type: "booking_confirmed",
          title: "✅ Reserva confirmada",
          body: "Tu pago fue aprobado y la reserva quedó confirmada.",
          data: { idBooking: paymentRow.idBooking },
          channel: "push",
        }).catch(console.error);
      }
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
}

export async function refundPayment(idPayment: number, amount?: number) {
  // 1) Buscar el pago interno
  const p = await getPaymentById(idPayment);
  if (!p) return { ok: false, error: "Pago inexistente" };
  if (p.provider !== "mercadopago") return { ok: false, error: "Proveedor no soportado para refund" };
  if (!p.providerPaymentId) {
    return { ok: false, error: "Aún no vinculado a paymentId de MP (esperá el webhook)" };
  }
  if (!p.idMpAccount) return { ok: false, error: "Pago sin cuenta de MP asociada" };

  // 2) Resolver cuenta vendedora (sala)
  const acc = await getMpAccountById(p.idMpAccount);
  if (!acc) return { ok: false, error: "Cuenta de MP de la sala no encontrada" };

  // 3) Calcular si es total o parcial según lo enviado vs lo ya reembolsado
  const total = Number(p.amount ?? 0);
  const already = Number(p.refundedAmount ?? 0);
  const req = amount == null ? (total - already) : Number(amount);
  if (req <= 0) return { ok: false, error: "Nada por reembolsar" };

  // 4) Ejecutar refund en MP
  const resp = await mpRefund(String(p.providerPaymentId), acc.access_token, amount);

  // 5) Actualizar BD
  const finalAfter = already + req;
  const isFinal = finalAfter >= (total - 0.01); // tolerancia centavos
  const newStatus = isFinal ? "refunded" : "partially_refunded";

  await applyRefundById(p.idPayment, req, newStatus);
  await addPaymentEvent(p.idPayment, "mercadopago", "refund", resp);

  // 6) Opcional: si preferís consolidar estado usando markPaymentStatusById
  // await markPaymentStatusById(p.idPayment, newStatus, p.paidAt ?? null);

  return {
    ok: true,
    data: {
      providerPaymentId: p.providerPaymentId,
      requestedAmount: req,
      newStatus,
      mpResponse: resp
    }
  };
}

