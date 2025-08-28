import { getAmenitiesController, getInstrumentsController, getMusicianProfileController,
    getGenresController, getMusicianByNameController, updateMusicianProfileController } from "../controllers/directory.controller.js";
import { Router } from "express";

const router = Router();

router.get("/instruments", getInstrumentsController);
router.get("/amenities", getAmenitiesController);
router.get("/:id/profile", getMusicianProfileController);
router.get("/genres", getGenresController);
router.get("/musicians/search", getMusicianByNameController);
router.put("/:id/profile", updateMusicianProfileController);

export default router;
