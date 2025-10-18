// src/controllers/mercadopago.oauth.controller.ts
import type { Request, Response } from "express";
import { buildMpAuthUrl, exchangeCodeForTokens, saveOAuthTokensForStudio } from "../services/mpaccount.service.js";

// Si tu proyecto tiene un tipo AuthRequest con user en req, usalo aquí.
type AuthRequest = Request & { user?: { idUser: number } };

const FRONT_DASHBOARD_URL = process.env.FRONT_DASHBOARD_URL ?? "http://localhost:3000";

/**
 * GET /integrations/mercadopago/start?studioId=123
 * Requiere auth. Verifica que el usuario sea admin/owner de la sala y redirige a MP.
 */
export async function startOAuth(req: AuthRequest, res: Response) {
  try {
    const idUser = req.user?.idUser;
    const idStudio = Number(req.query.studioId);
    if (!idUser) return res.status(401).json({ ok: false, error: "unauthorized" });
    if (!idStudio) return res.status(400).json({ ok: false, error: "missing_studioId" });

    // Podés meter info extra en state (ej. user) por trazabilidad
    const url = buildMpAuthUrl(idStudio, { u: idUser });
    return res.redirect(302, url);
  } catch (err) {
    console.error("[startOAuth] error:", err);
    return res.status(500).json({ ok: false, error: "server_error" });
  }
}

/**
 * GET /integrations/mercadopago/callback?code=...&state=studio=123&...
 * Público. Intercambia code → tokens y persiste en Billing.MpAccount.
 */
export async function oauthCallback(req: Request, res: Response) {
  try {
    const code = String(req.query.code ?? "");
    const stateStr = String(req.query.state ?? "");

    if (!code) return res.status(400).send("Missing code");
    const state = new URLSearchParams(stateStr);
    const studioStr = state.get("studio");
    const idStudio = studioStr ? Number(studioStr) : NaN;
    if (!idStudio) return res.status(400).send("Missing studio in state");

    const tokens = await exchangeCodeForTokens(code);

    await saveOAuthTokensForStudio(idStudio, {
      user_id: tokens.user_id,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      scope: tokens.scope ?? null,
      live_mode: tokens.live_mode,
      token_expires_at: tokens.token_expires_at,
    });

    // Redirigimos a la pantalla de ajustes de la sala.
    const back = new URL(FRONT_DASHBOARD_URL);
    // ejemplo: /studios/:id/settings?mp=connected
    back.pathname = `/studios/${idStudio}/settings`;
    back.searchParams.set("mp", "connected");
    return res.redirect(302, back.toString());
  } catch (err: any) {
    console.error("[oauthCallback] error:", err);
    const back = new URL(FRONT_DASHBOARD_URL);
    back.pathname = "/integrations/mercadopago/error";
    back.searchParams.set("reason", "callback_failed");
    return res.redirect(302, back.toString());
  }
}
