import bcrypt from "bcrypt";
import crypto from "crypto";

const ROUNDS = 10;

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, ROUNDS);
}

export async function verifyPassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

export const newJti = () => crypto.randomUUID();

export const hashToken = (t: string) =>
  crypto.createHash("sha256").update(t).digest("hex");