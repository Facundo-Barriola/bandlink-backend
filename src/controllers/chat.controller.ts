import { Request, Response } from "express";
import type { AuthRequest } from "../types/authRequest.js";
import { ChatService } from "../services/chat.service.js";

/**
 * POST /chat/dm
 * body: { targetUserId: number }
 * Crea (o recupera) una conversación DM entre el usuario autenticado y targetUserId.
 */
export async function createDmController(req: AuthRequest, res: Response) {
  try {
    if (req.userId == null) {
      return res.status(401).json({ ok: false, error: "No autenticado" });
    }
    const targetUserId = Number((req.body ?? {}).targetUserId);
    if (!Number.isFinite(targetUserId) || targetUserId <= 0) {
      return res.status(400).json({ ok: false, error: "targetUserId inválido" });
    }
    if (targetUserId === req.userId) {
      return res.status(400).json({ ok: false, error: "No podés crear un DM con vos mismo" });
    }
    const { idConversation, created } = await ChatService.findOrCreateDm(req.userId, targetUserId);
    return res.json({ ok: true, data: { idConversation, created } });
  } catch (e) {
    console.error("createDmController()", e);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

/**
 * GET /chat/conversations?limit=&offset=
 * Lista inbox del usuario autenticado con último mensaje, contadores, etc.
 */
export async function getInboxController(req: AuthRequest, res: Response) {
  try {
    if (req.userId == null) {
      return res.status(401).json({ ok: false, error: "No autenticado" });
    }
    const limitRaw = Number(req.query.limit);
    const offsetRaw = Number(req.query.offset);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 30;
    const offset = Number.isFinite(offsetRaw) ? Math.max(offsetRaw, 0) : 0;

    const rows = await ChatService.listInboxForUser(req.userId, limit, offset);
    return res.json({ ok: true, data: rows });
  } catch (e) {
    console.error("getInboxController()", e);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

/**
 * GET /chat/conversations/:id/messages?limit=&before=
 * Lista mensajes de una conversación (paginado hacia atrás con `before`).
 */
export async function getConversationMessagesController(req: AuthRequest, res: Response) {
  try {
    if (req.userId == null) {
      return res.status(401).json({ ok: false, error: "No autenticado" });
    }
    const idConversation = Number(req.params.id);
    if (!Number.isFinite(idConversation) || idConversation <= 0) {
      return res.status(400).json({ ok: false, error: "idConversation inválido" });
    }
    console.log("User ID:", req.userId, "is requesting messages for conversation:", idConversation);
    const isPart = await ChatService.isParticipant(idConversation, req.userId);
    console.log("Is participant:", isPart);
    if (!isPart) {
      return res.status(403).json({ ok: false, error: "Forbidden: no sos participante" });
    }

    const limitRaw = Number(req.query.limit);
    const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(limitRaw, 1), 100) : 50;
    const before = typeof req.query.before === "string" ? req.query.before : undefined;

    const items = await ChatService.listMessages(idConversation, limit, before);
    return res.json({ ok: true, data: items });
  } catch (e) {
    console.error("getConversationMessagesController()", e);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

/**
 * POST /api/chat/conversations/:id/messages
 * body: { body?: string; attachments?: any }
 * Crea un mensaje en la conversación. Útil para testear sin Socket.IO.
 */
export async function postMessageController(req: AuthRequest, res: Response) {
  try {
    if (req.userId == null) {
      return res.status(401).json({ ok: false, error: "No autenticado" });
    }
    const idConversation = Number(req.params.id);
    if (!Number.isFinite(idConversation) || idConversation <= 0) {
      return res.status(400).json({ ok: false, error: "idConversation inválido" });
    }
    console.log("User ID:", req.userId, "is participant of conv:", idConversation);
    const isPart = await ChatService.isParticipant(idConversation, req.userId);
    if (!isPart) {
      return res.status(403).json({ ok: false, error: "Forbidden: no sos participante" });
    }

    const b = (req.body ?? {}) as any;
    const text = b.body == null ? null : String(b.body);
    const attachments = b.attachments ?? null;

    if ((text == null || text.trim() === "") && attachments == null) {
      return res.status(400).json({ ok: false, error: "El mensaje está vacío" });
    }
    if (text && text.length > 4000) {
      return res.status(400).json({ ok: false, error: "El mensaje excede 4000 caracteres" });
    }

    const msg = await ChatService.createMessage(idConversation, req.userId, text, attachments);
    return res.json({ ok: true, data: msg });
  } catch (e) {
    console.error("postMessageController()", e);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

/**
 * POST /api/chat/conversations/:id/read
 * body: { until?: string }  // ISO opcional; si no, usa now()
 * Marca como leído para el usuario autenticado.
 */
export async function markConversationReadController(req: AuthRequest, res: Response) {
  try {
    if (req.userId == null) {
      return res.status(401).json({ ok: false, error: "No autenticado" });
    }
    const idConversation = Number(req.params.id);
    if (!Number.isFinite(idConversation) || idConversation <= 0) {
      return res.status(400).json({ ok: false, error: "idConversation inválido" });
    }
    const isPart = await ChatService.isParticipant(idConversation, req.userId);
    if (!isPart) {
      return res.status(403).json({ ok: false, error: "Forbidden: no sos participante" });
    }

    const untilStr = (req.body ?? {}).until as string | undefined;
    const until = untilStr ? new Date(untilStr) : new Date();
    if (untilStr && Number.isNaN(until.getTime())) {
      return res.status(400).json({ ok: false, error: "until no es una fecha válida" });
    }

    await ChatService.markConversationRead(idConversation, req.userId, until);
    return res.json({ ok: true, data: { idConversation, readAt: until.toISOString() } });
  } catch (e) {
    console.error("markConversationReadController()", e);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}
