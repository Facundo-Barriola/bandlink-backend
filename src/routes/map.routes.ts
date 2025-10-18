import { Router } from "express";
import { studiosNearController, eventsNearController } from "../controllers/map.controller.js";

const router = Router();

// Mantengo el prefijo /directory para que coincida con tu frontend actual
router.get("/studios/near", studiosNearController);
router.get("/events/near", eventsNearController);

export default router;