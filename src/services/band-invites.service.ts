import { pool } from "../config/database.js";
import * as Repo from "../repositories/band-invites.repository.js";

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
  const adminMusicianId = await getMusicianIdByUser(userId);
  if (!adminMusicianId) throw Object.assign(new Error("El usuario no tiene perfil de músico"), { httpStatus: 400 });
  return Repo.inviteMusicianToBand(adminMusicianId, idBand, targetMusicianId, roleSuggested, message);
}

export async function acceptInvite(userId: number, idBandInvite: number) {
  const musicianId = await getMusicianIdByUser(userId);
  if (!musicianId) throw Object.assign(new Error("El usuario no tiene perfil de músico"), { httpStatus: 400 });
  return Repo.acceptBandInvite(musicianId, idBandInvite);
}

export async function rejectInvite(userId: number, idBandInvite: number) {
  const musicianId = await getMusicianIdByUser(userId);
  if (!musicianId) throw Object.assign(new Error("El usuario no tiene perfil de músico"), { httpStatus: 400 });
  return Repo.rejectBandInvite(musicianId, idBandInvite);
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
