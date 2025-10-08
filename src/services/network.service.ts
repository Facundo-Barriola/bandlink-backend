import {
  sendConnectionRequest, acceptConnectionRequest, rejectConnectionRequest,
  archiveConnection, deleteConnection, listIncomingPending, listOutgoingPending,
  listAccepted, listArchived, getConnectionCore
} from '../repositories/network.repository.js';
import { getUsersByIds } from '../repositories/directory.repository.js';
import { notifyUser } from './notification.service.js';
import { linkToUser } from './notifications.templates.js';
import { pool } from '../config/database.js';

async function getUserDisplayName(idUser: number): Promise<string> {
  const sql = `
    SELECT COALESCE(up."displayName", u."email", 'Usuario') AS name
    FROM "Security"."User" u
    LEFT JOIN "Directory"."UserProfile" up ON up."idUser" = u."idUser"
    WHERE u."idUser" = $1
    LIMIT 1
  `;
  const { rows } = await pool.query<{ name: string }>(sql, [idUser]);
  return rows[0]?.name ?? 'Usuario';
}
type ConnectionRow = {
  idConnection: number;
  idUserA: number;
  idUserB: number;
  status: "accepted" | "pending" | "rejected";
  respondedAt: string | null;
  updatedAt: string;
};
export class NetworkService {

  static async sendConnectionRequest(requesterId: number, targetId: number) {
    const res = await sendConnectionRequest(requesterId, targetId);

    if (res?.ok && res.idConnection && res.status === 'pending') {
      const who = await getUserDisplayName(requesterId);
      // Notificar al destinatario
      notifyUser(targetId, {
        type: 'connection_request',
        title: '👋 Nueva solicitud de conexión',
        body: `${who} quiere conectarse contigo`,
        data: linkToUser(requesterId),
        channel: 'push',
      }).catch(console.error);
    }

    return res;
  }

  static async acceptConnectionRequest(actorUserId: number, idConnection: number) {
    const res = await acceptConnectionRequest(actorUserId, idConnection);

    if (res?.ok && res.status === 'accepted') {
      const core = await getConnectionCore(idConnection);
      if (core) {
        const requesterId = core.requestedBy;          // quien envió la solicitud
        if (requesterId && requesterId !== actorUserId) {
          const who = await getUserDisplayName(actorUserId);
          // Notificar al solicitante que fue aceptado
          notifyUser(requesterId, {
            type: 'connection_accepted',
            title: '🤝 Conexión aceptada',
            body: `${who} aceptó tu solicitud de conexión`,
            data: linkToUser(actorUserId),
            channel: 'push',
          }).catch(console.error);
        }
      }
    }

    return res;
  }

  static async rejectConnectionRequest(actorUserId: number, idConnection: number) {
    const res = await rejectConnectionRequest(actorUserId, idConnection);

    if (res?.ok && res.status === 'rejected') {
      const core = await getConnectionCore(idConnection);
      if (core) {
        const requesterId = core.requestedBy;
        if (requesterId && requesterId !== actorUserId) {
          const who = await getUserDisplayName(actorUserId);
          // Notificar al solicitante que fue rechazado
          notifyUser(requesterId, {
            type: 'connection_rejected',
            title: '❌ Solicitud rechazada',
            body: `${who} rechazó tu solicitud de conexión`,
            data: linkToUser(actorUserId),
            channel: 'push',
          }).catch(console.error);
        }
      }
    }

    return res;
  }

  static async archiveConnection(actorUserId: number, idConnection: number, archived: boolean) {
    return await archiveConnection(actorUserId, idConnection, archived);
  }

  static async deleteConnection(actorUserId: number, idConnection: number) {
    return await deleteConnection(actorUserId, idConnection);
  }

  static async listIncomingPending(idUser: number) {
    return await listIncomingPending(idUser);
  }

  static async listOutgoingPendings(idUser: number) {
    return await listOutgoingPending(idUser);
  }

  static async listAccepted(idUser: number) {
    const rows: ConnectionRow[] = await listAccepted(idUser);
    if (rows.length === 0) return [];

    const friendIds = Array.from(
      new Set(rows.map(r => (r.idUserA === idUser ? r.idUserB : r.idUserA)))
    );

      const friends = await getUsersByIds(friendIds);
  const map = new Map(friends.map(f => [f.idUser, f]));

  return rows.map(r => {
    const friendUserId = r.idUserA === idUser ? r.idUserB : r.idUserA;
    return {
      ...r,
      friendUserId,
      friend: map.get(friendUserId) ?? null,
    };
  });
  }

  static async listArchived(idUser: number) {
    return await listArchived(idUser);
  }
}
