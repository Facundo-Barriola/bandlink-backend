import {createBandController, getBandController, updateBandController, deleteBandController, createSearchController, listSearchByBandController, deactivateSearchController} from "../controllers/band.controller.js";
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.post("/", requireAuth, createBandController);
router.get("/:id", getBandController);
router.put("/:id", requireAuth, updateBandController);
router.delete("/:id", requireAuth, deleteBandController);
router.post("/:id/searches", requireAuth, createSearchController);
router.get("/:id/searches", requireAuth, listSearchByBandController);
router.post("/:id/searches/:idSearch/deactivate", requireAuth, deactivateSearchController);

export default router;