import type { Server } from "socket.io";
import {
  findDMConversation,
  createDMConversation,
  listInbox,
  isParticipant as repoIsParticipant,
  listMessages as repoListMessages,
  insertMessage,
  markRead as repoMarkRead,
  upsertReceipt as repoUpsertReceipt,
  getParticipants,
  removeParticipant as repoRemoveParticipant,
  countParticipants as repoCountParticipants,
  deleteConversationCascade as repoDeleteConversationCascade
} from "../repositories/chat.repository.js";
import { markReadReceipts } from "../repositories/chat.repository.js";
import { getUsersByIds } from "../repositories/directory.repository.js";
import { pool } from "../config/database.js";
import { notifyUser } from "./notification.service.js";

const CHAT_RESPECT_BLOCKS = process.env.CHAT_RESPECT_BLOCKS !== "false";
const CHAT_REQUIRE_CONNECTION = process.env.CHAT_REQUIRE_CONNECTION === "true";
const CHAT_MAX_BODY = Number(process.env.CHAT_MAX_BODY ?? 4000);

let chatIo: Server | null = null;
export function bindChatIo(io: Server) {
  chatIo = io;
}
function roomOf(idConversation: number) {
  return `room:${idConversation}`;
}

export type MessageInput = {
  idConversation: number;
  authorIdUser: number;
  body?: string | null;
  attachments?: any | null;
};

type UserLite = { idUser: number; displayName: string; avatarUrl: string | null };

async function hydrateOthers(rows: any[]) {
  const allOtherIds = new Set<number>();
  for (const r of rows) {
    for (const id of (r.otherUserIds ?? [])) allOtherIds.add(Number(id));
  }
  if (allOtherIds.size === 0) return { rows, byId: new Map<number, UserLite>() };

  const ids = Array.from(allOtherIds);
  const users = await getUsersByIds(ids); // <-- tu función existente
  const byId = new Map(users.map(u => [u.idUser, u]));
  return { rows, byId };
}

async function isBlockedBetween(a: number, b: number): Promise<boolean> {
  if (!CHAT_RESPECT_BLOCKS) return false;
  const q = `
    select 1
    from "Network"."Block"
    where ("blockerId" = $1 and "blockedId" = $2)
       or ("blockerId" = $2 and "blockedId" = $1)
    limit 1`;
  const { rows } = await pool.query(q, [a, b]);
  return !!rows[0];
}

async function hasAcceptedConnection(a: number, b: number): Promise<boolean> {
  if (!CHAT_REQUIRE_CONNECTION) return true;
  const q = `
    select 1
    from "Network"."Connection"
    where status = 'accepted'
      and ( ("idUserA" = $1 and "idUserB" = $2)
         or ("idUserA" = $2 and "idUserB" = $1) )
    limit 1`;
  const { rows } = await pool.query(q, [a, b]);
  return !!rows[0];
}

async function getConversationParticipants(idConversation: number): Promise<number[]> {
  const q = `
    select "idUser"
    from "Chat"."ConversationParticipant"
    where "idConversation" = $1`;
  const { rows } = await pool.query(q, [idConversation]);
  return rows.map(r => Number(r.idUser));
}

function cleanBody(input: string | null | undefined): string | null {
  if (input == null) return null;
  const trimmed = String(input).trim();
  if (!trimmed) return null;
  if (trimmed.length > CHAT_MAX_BODY) {
    return trimmed.slice(0, CHAT_MAX_BODY);
  }
  return trimmed;
}

export const ChatService = {
  /**
   * Crea o devuelve un DM entre dos usuarios.
   * Aplica reglas opcionales de bloqueos/conexiones.
   */
  async findOrCreateDm(me: number, targetUserId: number): Promise<{ idConversation: number; created: boolean }> {
    if (await isBlockedBetween(me, targetUserId)) {
      throw Object.assign(new Error("blocked_between_users"), { httpStatus: 403 });
    }
    if (!(await hasAcceptedConnection(me, targetUserId))) {
      throw Object.assign(new Error("connection_required"), { httpStatus: 403 });
    }

    const existing = await findDMConversation(me, targetUserId);
    if (existing) return { idConversation: existing, created: false };

    const idConversation = await createDMConversation(me, targetUserId, me);
    return { idConversation, created: true };
  },

  /** Lista el inbox (último mensaje + no leídos) del usuario. */
  async listInboxForUser(userId: number, limit = 30, offset = 0) {
        const rows = await listInbox(userId, limit, offset);

    // Hidratar perfiles de “otros”
    const { byId } = await hydrateOthers(rows);

    // Mapear resultado enriquecido
    const enriched = rows.map((r: any) => {
      const others: UserLite[] = (r.otherUserIds ?? [])
        .map((id: number) => byId.get(Number(id)))
        .filter(Boolean);

      // Para DM, exponé además un "otherUser" directo (single)
      const otherUser = r.type === "dm" ? (others[0] ?? null) : null;

      return {
        ...r,
        otherUser,      // { idUser, displayName, avatarUrl } | null  (para DM)
        otherUsers: others, // array (para grupos si querés mostrar chips)
      };
    });

    return enriched;
  },

  /** Verifica si un usuario participa de una conversación. */
  async isParticipant(idConversation: number, idUser: number): Promise<boolean> {
    return repoIsParticipant(idConversation, idUser);
  },

  /** Lista mensajes (paginación hacia atrás por fecha). */
  async listMessages(idConversation: number, limit = 50, before?: string) {
    return repoListMessages(idConversation, limit, before);
  },

  async createMessage(idConversation: number, authorIdUser: number, rawBody?: string | null, attachments?: any | null) {
    if (!(await repoIsParticipant(idConversation, authorIdUser))) {
      throw Object.assign(new Error("not_a_participant"), { httpStatus: 403 });
    }

    const convRow = await pool.query(
      `select "type" from "Chat"."Conversation" where "idConversation" = $1`,
      [idConversation]
    );
    const convType: string | undefined = convRow.rows[0]?.type;

    if (convType === "dm") {
      const participants = await getConversationParticipants(idConversation);
      const other = participants.find((u) => u !== authorIdUser);
      if (other && await isBlockedBetween(authorIdUser, other)) {
        throw Object.assign(new Error("blocked_between_users"), { httpStatus: 403 });
      }
      if (other && !(await hasAcceptedConnection(authorIdUser, other))) {
        throw Object.assign(new Error("connection_required"), { httpStatus: 403 });
      }
    }

    const body = cleanBody(rawBody ?? null);
    if (!body && attachments == null) {
      throw Object.assign(new Error("empty_message"), { httpStatus: 400 });
    }

    const msg = await insertMessage(idConversation, authorIdUser, body ?? null, attachments ?? null);

    await repoUpsertReceipt(msg.idMessage, authorIdUser, "deliveredAt");

    if (chatIo) {
      chatIo.of("/chat").to(roomOf(idConversation)).emit("message:new", msg);
    }
    const participantIds = await getParticipants(idConversation);
    const targets = participantIds.filter(id => id !== authorIdUser);

    await Promise.all(
      targets.map(id =>
        notifyUser(id, {
          type: "chat.message",
          title: "Nuevo mensaje",
          body: rawBody ?? "Tienes un mensaje nuevo",
          data: { idConversation },
          channel: "push",
        }).catch(console.error)
      )
    );

    return msg;
  },

  async markConversationRead(idConversation: number, idUser: number, until: Date) {
    if (!(await repoIsParticipant(idConversation, idUser))) {
      throw Object.assign(new Error("not_a_participant"), { httpStatus: 403 });
    }
    await repoMarkRead(idConversation, idUser, until);
    await markReadReceipts(idConversation, idUser, until);
    if (chatIo) {
      chatIo.of("/chat").to(roomOf(idConversation)).emit("message:read", {
        idConversation,
        idUser,
        readAt: until.toISOString(),
      });
    }
  },
  async leaveConversation(idConversation: number, idUser: number) {
    // Garantizar que participa
    if (!(await repoIsParticipant(idConversation, idUser))) {
      const err = Object.assign(new Error("not_a_participant"), { httpStatus: 404 });
      throw err;
    }

    // 1) Salir: quitar su fila de participantes
    await repoRemoveParticipant(idConversation, idUser);

    // 2) Si no queda nadie, borrar conversación y todo su contenido
    const left = await repoCountParticipants(idConversation);
    if (left === 0) {
      await repoDeleteConversationCascade(idConversation);
    } else {
      // Notificar a sala que este user salió (opcional)
      if (chatIo) {
        chatIo.of("/chat").to(roomOf(idConversation)).emit("conversation:left", {
          idConversation,
          idUser,
        });
      }
    }
  },
};
