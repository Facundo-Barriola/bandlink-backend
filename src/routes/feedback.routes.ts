import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  upsertReviewController,
  listReviewsController,
  getRatingSummaryController,
  createCommentController,
  listCommentsController,
  createReportController,
} from "../controllers/feedback.controller.js";

const router = Router();

/* Lecturas públicas */
router.get("/reviews", listReviewsController);
router.get("/comments", listCommentsController);
router.get("/summary/:idUser", getRatingSummaryController);

/* Escrituras autenticadas */
router.post("/reviews", requireAuth, upsertReviewController);
router.post("/comments", requireAuth, createCommentController);
router.post("/reports", requireAuth, createReportController);

export default router;
