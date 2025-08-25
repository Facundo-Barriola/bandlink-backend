import { getAmenitiesController, getInstrumentsController } from "../controllers/directory.controller.js";
import { Router } from "express";

const router = Router();

router.get("/instruments", getInstrumentsController);
router.get("/amenities", getAmenitiesController);

export default router;
