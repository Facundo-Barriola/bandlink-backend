import { getInstrumentsController } from "../controllers/directory.controller.js";
import { Router } from "express";

const router = Router();

router.get("/instruments", getInstrumentsController);

export default router;
