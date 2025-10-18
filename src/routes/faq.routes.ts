import { Router } from "express";
import { listFaqsController } from "../controllers/faq.controller.js";

const router = Router();

// Público: filtra por grupo vía ?group=2 y permite buscar con ?q=texto
router.get("/faqs", listFaqsController);

export default router;