import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { kpisOverviewController } from "../controllers/kpis.controller.js";

const router = Router();
router.get("/overview", requireAuth, kpisOverviewController);

export default router;