// src/services/mercadopago.oauth.service.ts
import { upsertMpAccount, getMpAccountByStudioId, updateTokensByStudioId } from "../repositories/mpaccount.repository.js";

const MP_CLIENT_ID = process.env.MP_CLIENT_ID!;
const MP_CLIENT_SECRET = process.env.MP_CLIENT_SECRET!;
const MP_PUBLIC_URL = process.env.MP_PUBLIC_URL ?? "http://localhost:4000";

/** Construye la URL de inicio de OAuth (para redirigir al usuario admin de la sala). */
export function buildMpAuthUrl(idStudio: number, stateExtra?: Record<string, string | number>) {
  const redirectUri = `${MP_PUBLIC_URL}/integrations/mercadopago/callback`;
  const state = new URLSearchParams({ studio: String(idStudio), ...(stateExtra ?? {}) }).toString();

  const url = new URL("https://auth.mercadopago.com/authorization");
  url.searchParams.set("client_id", MP_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("state", state);
  return url.toString();
}

/** Intercambia code → tokens en Mercado Pago. */
export async function exchangeCodeForTokens(code: string) {
  const redirectUri = `${MP_PUBLIC_URL}/integrations/mercadopago/callback`;

  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: MP_CLIENT_ID,
    client_secret: MP_CLIENT_SECRET,
    code,
    redirect_uri: redirectUri,
  });

  const r = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`MP oauth/token failed: ${r.status} ${txt}`);
  }

  const json = await r.json() as {
    access_token: string;
    token_type: "bearer";
    expires_in: number;
    scope?: string;
    user_id: number;
    refresh_token: string;
    live_mode: boolean;
  };

  const expiresAt = new Date(Date.now() + (json.expires_in - 60) * 1000); // -60s margen
  return {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    scope: json.scope ?? null,
    user_id: json.user_id,
    live_mode: json.live_mode,
    token_expires_at: expiresAt,
  };
}

/** (Opcional) Obtiene public_key del vendedor. Dejalo en null si no lo necesitás. */
export async function tryFetchPublicKey(accessToken: string): Promise<string | null> {
  // En muchas integraciones se omite; si querés, podés intentar /users/me o credenciales de aplicación.
  try {
    const me = await fetch("https://api.mercadopago.com/users/me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!me.ok) return null;
    const data = await me.json();
    // data no siempre incluye public_key; devolver null si no está
    return data?.public_key ?? null;
  } catch {
    return null;
  }
}

/** Guarda/actualiza la cuenta MP de una sala a partir del intercambio OAuth. */
export async function saveOAuthTokensForStudio(idStudio: number, payload: {
  user_id: number;
  access_token: string;
  refresh_token: string;
  scope?: string | null;
  live_mode: boolean;
  token_expires_at: Date;
}) {
  const public_key = await tryFetchPublicKey(payload.access_token);
  return upsertMpAccount({
    idStudio,
    mp_user_id: payload.user_id,
    public_key,
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    scope: payload.scope ?? null,
    live_mode: payload.live_mode,
    token_expires_at: payload.token_expires_at,
  });
}

/** Refresh de tokens si faltan N minutos para expirar. */
export async function refreshTokensIfNeeded(idStudio: number, minutesThreshold = 30) {
  const acc = await getMpAccountByStudioId(idStudio);
  if (!acc || !acc.refresh_token) return acc;

  const expiresAt = acc.token_expires_at ? new Date(acc.token_expires_at) : null;
  const shouldRefresh =
    !expiresAt || expiresAt.getTime() - Date.now() <= minutesThreshold * 60 * 1000;

  if (!shouldRefresh) return acc;

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: MP_CLIENT_ID,
    client_secret: MP_CLIENT_SECRET,
    refresh_token: acc.refresh_token,
  });

  const r = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });

  if (!r.ok) {
    const txt = await r.text();
    throw new Error(`MP refresh failed: ${r.status} ${txt}`);
  }

  const json = await r.json() as {
    access_token: string;
    token_type: "bearer";
    expires_in: number;
    scope?: string;
    user_id: number;
    refresh_token: string;
    live_mode: boolean;
  };

  const expiresAt2 = new Date(Date.now() + (json.expires_in - 60) * 1000);
  const updated = await updateTokensByStudioId(idStudio, {
    access_token: json.access_token,
    refresh_token: json.refresh_token,
    scope: json.scope ?? null,
    live_mode: json.live_mode,
    token_expires_at: expiresAt2,
  });

  return updated;
}
