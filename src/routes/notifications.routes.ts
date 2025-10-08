import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  listMyNotifications, markAsRead, markAllRead,
  getPreferences, updatePreferences, sendTest
} from "../controllers/notifications.controller.js";

const r = Router();
r.get("/", requireAuth, listMyNotifications);
r.post("/:id/read", requireAuth, markAsRead);
r.post("/read-all", requireAuth, markAllRead);
r.get("/preferences", requireAuth, getPreferences);
r.put("/preferences", requireAuth, updatePreferences);
r.post("/test", requireAuth, sendTest);

export default r;
