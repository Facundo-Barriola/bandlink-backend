import { getAmenitiesController, getInstrumentsController, getMusicianProfileController,
    getGenresController, getMusicianByNameController, updateMusicianProfileController, 
    getStudioProfileByIdController, updateStudioByOwnerController,
    editStudioRoomByOwnerController, getStudiosByNameController } from "../controllers/directory.controller.js";
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";


const router = Router();

router.get("/instruments", getInstrumentsController);
router.get("/amenities", getAmenitiesController);
router.get("/:id/profile", getMusicianProfileController);
router.get("/genres", async (req, res, next) => {
  console.time("GET /directory/genres");
  try {
    // FAST PATH de diagnóstico:
    if (process.env.DIAG_FAST_GENRES === "1") {
      return res.json({ ok: true, data: [] });
    }

    getGenresController
  } catch (err) {
    next(err);
  } finally {
    console.timeEnd("GET /directory/genres");
  }
});
// router.get("/genres", getGenresController);
router.get("/musicians/search", getMusicianByNameController);
router.get("/studios/:id/profile", getStudioProfileByIdController);
router.put("/:id/profile", requireAuth, updateMusicianProfileController);
router.put("/studios/:id", requireAuth, updateStudioByOwnerController);
router.put("/rooms/:id", requireAuth, editStudioRoomByOwnerController);
router.get("/studios/search", getStudiosByNameController);
export default router;
