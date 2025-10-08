import { Server, Socket } from "socket.io";
import { verifyAuthToken } from "../utils/jwt.js";
import { ChatService } from "../services/chat.service.js";
import { isParticipant, listMessages, markRead } from "../repositories/chat.repository.js";

function parseCookie(str?: string) {
  const out: Record<string, string> = {};
  (str ?? "").split(/; */).forEach(p => {
    const i = p.indexOf("="); if (i === -1) return;
    out[decodeURIComponent(p.slice(0, i).trim())] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

export function mountChatNamespace(io: Server) {
  const nsp = io.of("/chat");

  nsp.use(async (socket, next) => {
    try {
      const cookies = parseCookie(socket.handshake.headers.cookie as string | undefined);
      const cookieToken = cookies["auth_token"];                 // <- usa el MISMO nombre que tu middleware REST
      const bearer = socket.handshake.headers.authorization?.replace(/^Bearer\s+/i, "");
      const authToken = socket.handshake.auth?.token as string | undefined;
      const raw = cookieToken || bearer || authToken;
      if (!raw) return next(new Error("no token"));

      const payload = verifyAuthToken<{ sub: number; role?: string }>(raw);
      (socket as any).user = { idUser: Number(payload.sub), role: payload.role };
      next();
    } catch (e) {
      next(new Error("auth error"));
    }
  });

  nsp.on("connection", (socket: Socket) => {
    const { idUser } = (socket as any).user || {};
    console.log("[ws] connected", socket.id, "user", idUser);

    async function doJoin(idConversation: number, ack?: (ok: boolean) => void) {
      try {
        if (!Number.isFinite(idConversation)) return ack?.(false);
        const ok = await isParticipant(idConversation, idUser);
        if (!ok) return ack?.(false);
        socket.join(roomOf(idConversation));
        ack?.(true);
      } catch (e) { ack?.(false); }
    }

    socket.on("conversation:join", doJoin);
    socket.on("join", (payload: any, ack?: (ok:boolean)=>void) => {
      const id = typeof payload === "number" ? payload : Number(payload?.idConversation);
      return doJoin(id, ack);
    });

    socket.on("message:list", async (p: { idConversation: number; before?: string; limit?: number }, ack?: (rows:any[])=>void) => {
      if (!(await isParticipant(p.idConversation, idUser))) return ack?.([]);
      const rows = await listMessages(p.idConversation, p.limit ?? 50, p.before);
      ack?.(rows);
    });

    socket.on("message:send", async (
      payload: { idConversation: number; body?: string; attachments?: any },
      ack?: (res: { ok: true; msg: any } | { ok: false; error?: string }) => void
    ) => {
      try {
        const { idConversation, body = null, attachments = null } = payload;
        const msg = await ChatService.createMessage(idConversation, idUser, body, attachments);
        // el Service ya emite "message:new" al room si hiciste bindChatIo(io)
        ack?.({ ok: true, msg });
      } catch (e: any) {
        ack?.({ ok: false, error: e?.message ?? "error" });
      }
    });

    socket.on("message:read", async (p: { idConversation: number; until?: string }) => {
      if (!(await isParticipant(p.idConversation, idUser))) return;
      await markRead(p.idConversation, idUser, p.until ? new Date(p.until) : new Date());
      socket.to(roomOf(p.idConversation)).emit("message:read", { idConversation: p.idConversation, idUser });
    });

    socket.on("typing", (p: { idConversation: number; isTyping: boolean }) => {
      if (!p?.idConversation) return;
      socket.to(roomOf(p.idConversation)).emit("typing", { idConversation: p.idConversation, idUser, isTyping: p.isTyping });
    });
  });
}

function roomOf(idConversation: number) { return `room:${idConversation}`; }
