import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ENV } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import addressRoutes from "./routes/address.routes.js";
import directoryRoutes from "./routes/directory.routes.js";
import accountRoutes from "./routes/account.routes.js";
import networkRoutes from "./routes/network.routes.js";
import bandRoutes from "./routes/band.routes.js";
import bandInvitesRoutes from "./routes/band-invites.routes.js";
import bookingRoutes from "./routes/booking.routes.js";
import { googleCalendarRouter } from "./routes/integrations/googleCalendar.routes.js";
import paymentsRoutes from "./routes/payment.routes.js";
import bookingReceiptRouter from "./routes/integrations/bookings.receipt.routes.js"
import { errorHandler } from "./middlewares/errorHandler.js";
import eventsRouter from "./routes/events.routes.js";
import presenceRouter from "./routes/presence.routes.js";
import discoverRoutes from "./routes/discover.routes.js";
import feedbackRoutes from "./routes/feedback.routes.js";
import pushRoutes from "./routes/push.routes.js";
import notificationsRoutes from "./routes/notifications.routes.js";
import chatRoutes from "./routes/chat.routes.js";
import mpIntegrationRoutes from "./routes/mercadopago.routes.js";
import mapRoutes from "./routes/map.routes.js";
import kpisRoutes from "./routes/kpis.routes.js";
import faqsRoutes from "./routes/faq.routes.js";

const app = express();
app.use("/payments/webhook", express.raw({ type: "*/*" }));
app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: ENV.CLIENT_ORIGIN,
  credentials: true,
  methods: ["GET","POST","PUT","PATCH","DELETE","OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  exposedHeaders: ["Content-Length", "X-Total-Count"],               
}));
app.options("*", cors());
app.use((req, _res, next) => {
  console.log(`[IN] ${req.method} ${req.path} ct=${req.headers["content-type"]}`);
  next();
});

app.get("/health", (_req, res) => res.json({ ok: true, service: "bandlink-auth-backend" }));
app.use("/auth", authRoutes);
app.use("/push",pushRoutes);
app.use("/notifications", notificationsRoutes);
app.use("/address", addressRoutes);
app.use("/directory", directoryRoutes);
app.use("/account", accountRoutes);
app.use("/network", networkRoutes);
app.use("/band-invites", bandInvitesRoutes);
app.use("/bands", bandRoutes);
app.use("/integrations/google-calendar", googleCalendarRouter);
app.use("/booking", bookingRoutes);
app.use("/payments", paymentsRoutes);
app.use("/receipts", bookingReceiptRouter);
app.use("/events", eventsRouter);
app.use("/discover", discoverRoutes);
app.use("/feedback", feedbackRoutes);
app.use("/chat", chatRoutes);
app.use("/integrations/mercadopago", mpIntegrationRoutes);
app.use("/map", mapRoutes);
app.use("/kpis", kpisRoutes);
app.use(faqsRoutes);
app.use(presenceRouter);


app.use(errorHandler);

export default app;
