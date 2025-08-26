import { getAmenitiesController, getInstrumentsController, getMusicianProfileController } from "../controllers/directory.controller.js";
import { Router } from "express";

const router = Router();

router.get("/instruments", getInstrumentsController);
router.get("/amenities", getAmenitiesController);
router.get("/:id/profile", getMusicianProfileController);

export default router;
