import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { createPaymentForBookingController, webhookController } from "../controllers/payment.controller.js";

const router = Router();
router.post("/booking/:idBooking", requireAuth, createPaymentForBookingController);
router.post("/webhook", webhookController); 

export default router;
