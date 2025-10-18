// src/routes/integrations/mercadopago.routes.ts
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { startOAuth, oauthCallback } from "../controllers/mercadopago.oauth.controller.js";

const router = Router();
router.get("/start", requireAuth, startOAuth);     // /integrations/mercadopago/start
router.get("/callback", oauthCallback);            // /integrations/mercadopago/callback
export default router;


