import { pool } from "../config/database.js";
import * as Repo from "../repositories/band-invites.repository.js";
import { notifyUser } from "./notification.service.js";
import { linkToBand } from "./notifications.templates.js";
import { BandRepository, getBandAdminUserIds } from "../repositories/band.repository.js";

// --- helper: displayName del usuario ---
async function getUserDisplayName(idUser: number): Promise<string> {
  const sql = `
    SELECT COALESCE(up."displayName", u."email", 'Usuario') AS name
    FROM "Security"."User" u
    LEFT JOIN "Directory"."UserProfile" up ON up."idUser" = u."idUser"
    WHERE u."idUser" = $1
    LIMIT 1
  `;
  const { rows } = await pool.query<{ name: string }>(sql, [idUser]);
  return rows[0]?.name ?? "Usuario";
}

async function getMusicianIdByUser(idUser: number): Promise<number | null> {
  const q = `
    SELECT m."idMusician"
    FROM "Directory"."Musician" m
    JOIN "Directory"."UserProfile" up ON up."idUserProfile" = m."idUserProfile"
    WHERE up."idUser" = $1
    LIMIT 1
  `;
  const { rows } = await pool.query<{ idMusician: number }>(q, [idUser]);
  return rows[0]?.idMusician ?? null;
}

export async function getInvitesForMusician(userId: number, status?: string | null) {
  console.log("Entrando a getInvitesForMusician con userId:", userId, "y status:", status);
  const musicianId = await getMusicianIdByUser(userId);
  if (!musicianId) throw Object.assign(new Error("El usuario no tiene perfil de músico"), { httpStatus: 400 });
  return Repo.getInvitesForMusician(musicianId, status ?? null);
}

export async function listPendingInvitesForMusician(userId: number) {
  console.log("Listando invitaciones pendientes para el usuario con ID:", userId);
  return getInvitesForMusician(userId, "pending");
}

export async function invite(userId: number, idBand: number, targetMusicianId: number, roleSuggested?: string | null, message?: string | null) {
  const adminMusicianId = await getMusicianIdByUser(userId); //Juan lopez
  const userInvitedId = await getMusicianIdByUser(targetMusicianId);
  const band = await BandRepository.getBand(idBand);
  if (!adminMusicianId) throw Object.assign(new Error("El usuario no tiene perfil de músico"), { httpStatus: 400 });
  if (!userInvitedId) throw Object.assign(new Error("No se encontró usuario al que quiere invitar"), { httpStatus: 400 });

  // Noti al invitado (ya la tenías)
  notifyUser(targetMusicianId, {
    type: "band_invite",
    title: "🎸 Invitación a banda",
    body: `Te invitaron a unirte a ${band.bandName}`,
    data: linkToBand(idBand),
    channel: "push",
  }).catch(console.error);
  return Repo.inviteMusicianToBand(adminMusicianId, idBand, userInvitedId, roleSuggested, message);
}

export async function acceptInvite(userId: number, idBandInvite: number) {
  const musicianId = await getMusicianIdByUser(userId);
  if (!musicianId) throw Object.assign(new Error("El usuario no tiene perfil de músico"), { httpStatus: 400 });

  const res = await Repo.acceptBandInvite(musicianId, idBandInvite);
  if (!res?.ok || !res.idBand) return res;

  const idBand = res.idBand;
  const band = await BandRepository.getBand(idBand);
  const who = await getUserDisplayName(userId);

  const adminIds = await getBandAdminUserIds(idBand);
  await Promise.all(
    adminIds
      .filter(id => id !== userId)
      .map(idAdmin =>
        notifyUser(idAdmin, {
          type: "band_invite_accepted",
          title: "✅ Invitación aceptada",
          body: `${who} se unió a ${band.bandName}`,
          data: linkToBand(idBand),
          channel: "push",
        }).catch(console.error)
      )
  );

  return res;
}

export async function rejectInvite(userId: number, idBandInvite: number) {
  const musicianId = await getMusicianIdByUser(userId);
  if (!musicianId) throw Object.assign(new Error("El usuario no tiene perfil de músico"), { httpStatus: 400 });

  const res = await Repo.rejectBandInvite(musicianId, idBandInvite);
  if (!res?.ok || !res.idBand) return res;

  const idBand = res.idBand;
  const band = await BandRepository.getBand(idBand);
  const who = await getUserDisplayName(userId);

  const adminIds = await getBandAdminUserIds(idBand);
  await Promise.all(
    adminIds
      .filter(id => id !== userId)
      .map(idAdmin =>
        notifyUser(idAdmin, {
          type: "band_invite_rejected",
          title: "❌ Invitación rechazada",
          body: `${who} rechazó la invitación a ${band.bandName}`,
          data: linkToBand(idBand),
          channel: "push",
        }).catch(console.error)
      )
  );

  return res;
}

export async function kick(userId: number, idBand: number, targetMusicianId: number) {
  const adminMusicianId = await getMusicianIdByUser(userId);
  if (!adminMusicianId) throw Object.assign(new Error("El usuario no tiene perfil de músico"), { httpStatus: 400 });
  return Repo.kickBandMember(adminMusicianId, idBand, targetMusicianId);
}

export async function leave(userId: number, idBand: number) {
  const musicianId = await getMusicianIdByUser(userId);
  if (!musicianId) throw Object.assign(new Error("El usuario no tiene perfil de músico"), { httpStatus: 400 });
  return Repo.leaveBand(musicianId, idBand);
}
