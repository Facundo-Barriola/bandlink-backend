import type { PaymentProvider } from "./providers/types.js";
import { MercadoPagoProvider } from "./providers/mp.provider.js";
import { StripeProvider } from "./providers/stripe.provider.js";

export function getProvider(code?: string): PaymentProvider {
  const p = (code ?? process.env.DEFAULT_PAYMENT_PROVIDER ?? "mp").toLowerCase();
  if (p === "stripe") return StripeProvider;
  return MercadoPagoProvider;
}
