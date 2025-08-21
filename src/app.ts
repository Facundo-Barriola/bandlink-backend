import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ENV } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import { errorHandler } from "./middlewares/errorHandler.js";

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use(cors({
  origin: ENV.CLIENT_ORIGIN,
  credentials: true,               
}));

app.get("/health", (_req, res) => res.json({ ok: true, service: "bandlink-auth-backend" }));
app.use("/auth", authRoutes);

app.use(errorHandler);

export default app;
