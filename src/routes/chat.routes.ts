import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  createDmController,
  getInboxController,
  getConversationMessagesController,
  postMessageController,
  markConversationReadController
} from "../controllers/chat.controller.js";

const router = Router();

// DM
router.post("/dm", requireAuth, createDmController);

// Inbox y mensajes
router.get("/conversations", requireAuth, getInboxController);
router.get("/conversations/:id/messages", requireAuth, getConversationMessagesController);

// Envío y lectura (útil para testear sin WS)
router.post("/conversations/:id/messages", requireAuth, postMessageController);
router.post("/conversations/:id/read", requireAuth, markConversationReadController);

export default router;
