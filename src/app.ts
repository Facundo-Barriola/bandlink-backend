import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { ENV } from "./config/env.js";
import authRoutes from "./routes/auth.routes.js";
import addressRoutes from "./routes/address.routes.js";
import directoryRoutes from "./routes/directory.routes.js";
import accountRoutes from "./routes/account.routes.js";
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
app.use("/address", addressRoutes);
app.use("/directory", directoryRoutes);
app.use("/account", accountRoutes);

app.use(errorHandler);

export default app;
