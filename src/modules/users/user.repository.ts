import { pool } from "../../config/database.js";

const USER_TABLE = `"Security"."User"`;
const SESSION_TABLE = `"Security"."Session"`;

export async function findUserByEmail(email: string) {
  const q = `SELECT "idUser", "email", "passwordHash", "idUserGroup"
             FROM ${USER_TABLE} WHERE "email" = $1`;
  const { rows } = await pool.query(q, [email]);
  return rows[0] as { idUser: number; email: string; passwordHash: string; idUserGroup: number } | undefined;
}

export async function updateUserPassword(idUser: number, newHash: string) {
  const q = `UPDATE ${USER_TABLE}
             SET "passwordHash" = $1, "lastUpdatedDate" = NOW()
             WHERE "idUser" = $2`;
  await pool.query(q, [newHash, idUser]);
}

export async function updateLastLogin(idUser: number) {
  await pool.query(`UPDATE ${USER_TABLE} SET "lastLogin" = NOW() WHERE "idUser" = $1`, [idUser]);
}

export async function createSession(idUser: number, token: string, ip?: string, browser?: string) {
  const q = `INSERT INTO ${SESSION_TABLE} ("idUser", "token", "ip", "browser")
             VALUES ($1, $2, $3, $4) RETURNING "idSession"`;
  const { rows } = await pool.query(q, [idUser, token, ip || null, browser || null]);
  return rows[0].idSession as number;
}

export async function deleteSessionByToken(token: string) {
  await pool.query(`DELETE FROM ${SESSION_TABLE} WHERE "token" = $1`, [token]);
}

export async function insertNewUser(email: string, passwordHash: string) {
  const q = `INSERT INTO ${USER_TABLE} ("email", "passwordHash", "idUserGroup")
             VALUES ($1, $2, 1) RETURNING "idUser"`;
  const { rows } = await pool.query(q, [email, passwordHash]);
  return rows[0].idUser as number;
}
