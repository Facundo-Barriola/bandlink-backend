import {createBandController, getBandController, updateBandController, deleteBandController} from "../controllers/band.controller.js";
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.post("/", requireAuth, createBandController);
router.get("/:id", getBandController);
router.put("/:id", requireAuth, updateBandController);
router.delete("/:id", requireAuth, deleteBandController);

export default router;