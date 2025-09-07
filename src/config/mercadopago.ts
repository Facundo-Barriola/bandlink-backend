import mercadopago from "mercadopago";
import { ENV } from "./env.js";

import { MercadoPagoConfig } from "mercadopago";
const token = process.env.MP_ACCESS_TOKEN?.trim();

if (!token) {
  throw new Error("MP_ACCESS_TOKEN no está seteado.");
}
if (!/^TEST-|^APP_USR-/.test(token)) {
  throw new Error("MP_ACCESS_TOKEN no parece válido (debe comenzar con TEST- o APP_USR-).");
}
export const mpClient = new MercadoPagoConfig({
  accessToken: token,     // pon tu token TEST/PROD
  options: { timeout: 5000 },                    // opcional
});

async function sanityCheckMpToken() {
  const r = await fetch("https://api.mercadopago.com/users/me", {
    headers: { Authorization: `Bearer ${process.env.MP_ACCESS_TOKEN}` },
  });
  const j = await r.json();
  console.log("[MP sanity]", r.status, j.id, j.nickname ?? j.message);
}
sanityCheckMpToken().catch(console.error);



export { mercadopago };