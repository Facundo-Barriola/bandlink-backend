import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { discoverEventsController, discoverBandsController, discoverStudiosController, discoverMusiciansController } from "../controllers/discover.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/events", discoverEventsController);
router.get("/bands",    discoverBandsController);
router.get("/studios",  discoverStudiosController);
router.get("/musicians",discoverMusiciansController);

export default router;
