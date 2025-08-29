import { getAmenitiesController, getInstrumentsController, getMusicianProfileController,
    getGenresController, getMusicianByNameController, updateMusicianProfileController, getStudioProfileByIdController } from "../controllers/directory.controller.js";
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";


const router = Router();

router.get("/instruments", getInstrumentsController);
router.get("/amenities", getAmenitiesController);
router.get("/:id/profile", getMusicianProfileController);
router.get("/genres", getGenresController);
router.get("/musicians/search", getMusicianByNameController);
router.get("/studios/:id/profile", getStudioProfileByIdController);
router.put("/:id/profile", requireAuth, updateMusicianProfileController);

export default router;
