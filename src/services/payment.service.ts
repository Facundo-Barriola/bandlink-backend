import { mercadopago, mpClient } from "../config/mercadopago.js";
import { Preference, Payment } from "mercadopago";
import {
    getBookingForPayment, upsertActivePayment, markPaymentStatus,
    addPaymentEvent, setBookingPaid, findPaymentByProviderPref
} from "../repositories/payment.repository.js";
import { create } from "domain";

function unwrapMP<T extends object>(r: any): T {
  if (r && typeof r === "object") {
    if ("body" in r && r.body) return r.body as T;
    if ("response" in r && r.response) return r.response as T;
  }
  return r as T;
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
    const preference = {
        items: [{
            title: `Reserva sala #${idBooking}`,
            quantity: 1,
            currency_id: "ARS",
            unit_price: amount
        }],
        statement_descriptor: "BandLink",
        back_urls: {
            success: process.env.CLIENT_ORIGIN + "/payments/success",
            failure: process.env.CLIENT_ORIGIN + "/payments/failure",
            pending: process.env.CLIENT_ORIGIN + "/payments/pending",
        },
        //auto_return: "approved",
        metadata: { idBooking },
        notification_url: (process.env.MP_PUBLIC_URL ?? "http://localhost:4000") + "/payments/webhook"
    };
    console.log("Preference a crear:", preference);
    console.log(mpClient.accessToken);
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

        console.log("pref keys:", Object.keys(pref));
        console.log("collector_id:", collectorId);
        console.log("sandbox_init_point:", sandboxInitPoint);
        console.log("init_point:", initPoint);
        console.log("preferenceId:", prefId);

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

// Procesa webhook genérico (vienen variantes según versión)
export async function handleWebhook(payload: any, headers: Record<string, string>) {
    const topic = payload?.type || payload?.topic;
    const paymentId = payload?.data?.id || payload?.resource?.split("/").pop();

    if (!paymentId) return { ok: false, info: "Sin payment id" };

    const resp = await new Payment(mpClient).get({ id: Number(paymentId) });
    const body = (resp as any).body ?? resp;
    const mpStatus: string = body.status;
    const mpPrefId: string | null =
        body.order?.id ?? body.metadata?.preference_id ?? null;
    const paidAt: Date | null =
        body.date_approved ? new Date(body.date_approved) : null;
    const payment = mpPrefId ? await findPaymentByProviderPref(mpPrefId) : null;
    if (!payment) return { ok: false, info: "Payment interno no encontrado" };

    await addPaymentEvent(payment.idPayment, "mercadopago", topic ?? "payment", body);
    await markPaymentStatus(String(paymentId), mpStatus, paidAt);

    if (mpStatus === "approved") {
        await setBookingPaid(payment.idBooking);
    }

    return { ok: true };
}
