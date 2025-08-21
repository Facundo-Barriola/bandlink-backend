import { Request, Response, NextFunction } from "express";
import { verifyAuthToken } from "../utils/jwt.js";
import { AuthRequest } from "../types/authRequest.js";
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const bearer = req.headers.authorization;
  const cookieToken = req.cookies?.auth_token as string | undefined;
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : cookieToken;

  if (!token) return res.status(401).json({ ok: false, message: "No access token" });

  try {
    console.log("TOKEN RECEIVED:", token);
    const payload = verifyAuthToken<{ sub: number; role?: string }>(token);
    req.userId = payload.sub;
    req.user = { idUser: payload.sub, role: payload.role as any };
    (req as any).userId = payload.sub;
    return next();
  } catch {
    return res.status(401).json({ ok: false, message: "Invalid/expired token" });
  }
}
