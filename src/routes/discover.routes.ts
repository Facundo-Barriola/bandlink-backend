import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { discoverEventsController } from "../controllers/discover.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/events", discoverEventsController);

export default router;
