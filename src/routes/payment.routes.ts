import { Router } from "express";
import express from "express";
import { requireAuth } from "../middlewares/auth.js";
import { createPaymentForBookingController, webhookController,createPaymentForBookingUnifiedController } from "../controllers/payment.controller.js";

const router = Router();
router.post("/booking/:idBooking", requireAuth, createPaymentForBookingController);

router.get("/webhook", (req, res) => {
  console.log("[MP WEBHOOK][GET] ping", req.query);
  res.sendStatus(200);
});

router.post("/webhook", webhookController); 

router.post("/:provider/booking/:idBooking",   (req, _res, next) => {
    console.log("[ROUTE] provider:", req.params.provider, "id:", req.params.idBooking);
    console.log("[ROUTE] body keys:", req.body && typeof req.body === "object" ? Object.keys(req.body) : typeof req.body);
    next();
  },requireAuth, createPaymentForBookingUnifiedController);
  
import Stripe from "stripe";
router.post("/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
  try {
    const sig = req.headers["stripe-signature"] as string | undefined;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2025-08-27.basil" });
    const event = stripe.webhooks.constructEvent(req.body, sig!, process.env.STRIPE_WEBHOOK_SECRET!);

    res.sendStatus(200);
  } catch (err) {
    console.error("[stripe.webhook]", err);
    res.sendStatus(400);
  }
});

export default router;
