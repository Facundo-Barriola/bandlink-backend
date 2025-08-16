import { Request, Response, NextFunction } from "express";
import { verifyAuthToken } from "../utils/jwt.js";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization;
  const cookieToken = req.cookies?.auth_token as string | undefined;
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : cookieToken;

  if (!token) return res.status(401).json({ ok: false, message: "No auth token" });

  try {
    const payload = verifyAuthToken<{ sub: number }>(token);
    (req as any).userId = payload.sub;
    next();
  } catch {
    return res.status(401).json({ ok: false, message: "Invalid/expired token" });
  }
}
