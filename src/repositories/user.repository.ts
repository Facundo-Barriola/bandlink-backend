import { pool } from "../config/database.js";
import { User } from "../models/user.model.js";

const USER_TABLE = `"Security"."User"`;
const SESSION_TABLE = `"Security"."Session"`;
const AUTH_SESSION_TABLE = `"Security"."authSessions"`;

export type InsertSession = {
  jti: string;
  userId: number | string;
  tokenHash: string;
  expiresAt: Date;
  userAgent?: string;
  ip?: string | string[];
};

export async function addRefreshToken(s: InsertSession): Promise<void> {
  await pool.query(
    `INSERT INTO ${AUTH_SESSION_TABLE}
      ("jti","userId","tokenHash","expiresAt","userAgent","ip")
     VALUES ($1,$2,$3,$4,$5,$6)`,
    [
      s.jti,
      Number(s.userId),
      s.tokenHash,
      s.expiresAt.toISOString(),
      s.userAgent ?? null,
      Array.isArray(s.ip) ? s.ip[0] : s.ip ?? null,
    ]
  );
}

export async function isRefreshTokenValid(jti: string, tokenHash: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1
       FROM ${AUTH_SESSION_TABLE}
      WHERE "jti" = $1
        AND "tokenHash" = $2
        AND "revokedAt" IS NULL
        AND "expiresAt" > now()
      LIMIT 1`,
    [jti, tokenHash]
  );
  return rows.length > 0;
}

export async function revokeRefreshTokenByJti(jti: string): Promise<void> {
  await pool.query(
    `UPDATE ${AUTH_SESSION_TABLE} SET "revokedAt" = now() WHERE "jti" = $1`,
    [jti]
  );
}

export async function replaceRefreshToken(args: {
  oldJti: string;
  newJti: string;
  oldTokenHash: string;
  newTokenHash: string;
  expiresAt: Date;
}): Promise<void> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const prev = await client.query(
      `SELECT "userId" FROM ${AUTH_SESSION_TABLE}
        WHERE "jti" = $1 AND "tokenHash" = $2 AND "revokedAt" IS NULL
        LIMIT 1`,
      [args.oldJti, args.oldTokenHash]
    );
    if (prev.rows.length === 0) {
      await client.query("ROLLBACK");
      throw new Error("Prev refresh not found or already rotated");
    }
    const userId = prev.rows[0].userId as number;

    await client.query(
      `UPDATE ${AUTH_SESSION_TABLE} SET "revokedAt" = now() WHERE "jti" = $1`,
      [args.oldJti]
    );

    await client.query(
      `INSERT INTO ${AUTH_SESSION_TABLE} ("jti","userId","tokenHash","expiresAt")
       VALUES ($1,$2,$3,$4)`,
      [args.newJti, userId, args.newTokenHash, args.expiresAt.toISOString()]
    );

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

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

export async function findUserById(idUser: number): Promise<User | null> {
  const query = `SELECT "idUser", "email" FROM ${USER_TABLE} WHERE "idUser" = $1`;
  const values = [idUser];
  try {
    const result = await pool.query(query, values);
    if (result.rows.length === 0) return null;
    const row = result.rows[0];
    return { idUser: row.idUser, email: row.email };
  } catch (err) {
    console.error("Error en findUserById:", err);
    throw err;
  }
}
