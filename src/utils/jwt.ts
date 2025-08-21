
import jwt, { Secret, SignOptions, JwtPayload } from "jsonwebtoken";
import { ENV } from "../config/env.js";

export type AccessPayload = { sub: number; role?: string };
export type RefreshPayload = { sub: number; type: "refresh"; jti: string };

const accessSignOptions: SignOptions = { expiresIn: ENV.JWT_ACCESS_EXPIRES as any };

function getRefreshWindowDays(rememberMe?: boolean) {
  const remember = Number(ENV.REFRESH_REMEMBER_DAYS ?? 30);
  const normal = Number(ENV.REFRESH_DEFAULT_DAYS ?? 1);
  return rememberMe ? remember : normal;
}
export function getRefreshExpiresInString(days: number) {
  return `${days}d`;
}
export function getMillisFromDays(days: number) {
  return days * 24 * 60 * 60 * 1000;
}

/** Sign and verify tokens */
export function signAccessToken(payload: AccessPayload): string {
  return jwt.sign(payload, ENV.JWT_ACCESS_SECRET as Secret, accessSignOptions);
}
export function verifyAccessToken<T extends JwtPayload | AccessPayload>(token: string): T {
  return jwt.verify(token, ENV.JWT_ACCESS_SECRET as Secret) as T;
}

export function signRefreshToken(args: {
  sub: number;
  jti: string;
  rememberMe?: boolean;
}): string {
  const days = getRefreshWindowDays(args.rememberMe);
  const expiresInSeconds = days * 24 * 60 * 60; // <-- número, evita el problema de tipos
  const payload: RefreshPayload = { sub: args.sub, type: "refresh", jti: args.jti };

  return jwt.sign(payload, ENV.JWT_REFRESH_SECRET as Secret, {
    expiresIn: expiresInSeconds,
  });
}

export function verifyRefreshToken<T extends JwtPayload | RefreshPayload>(token: string): T {
  return jwt.verify(token, ENV.JWT_REFRESH_SECRET as Secret) as T;
}

export function decodeTokenUnsafe<T = any>(token: string): (T & JwtPayload) | null {
  return jwt.decode(token) as any;
}

export function signAuthToken(payload: object) {
  return jwt.sign(payload, ENV.JWT_ACCESS_SECRET as Secret, accessSignOptions);
}
export function verifyAuthToken<T extends JwtPayload | { sub: number }>(token: string): T {
  return jwt.verify(token, ENV.JWT_ACCESS_SECRET as Secret) as T;
}
