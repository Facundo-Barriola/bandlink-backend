import { Request, Response } from "express";
import useragent from "useragent";
import bcrypt from "bcrypt";
import { changePasswordByEmail, forgotPassword, login, registerNewUser, getUserById } from "../services/auth.service.js";
import { AuthRequest } from "../types/authRequest.js";
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  decodeTokenUnsafe,
} from "../utils/jwt.js";
import jwt from "jsonwebtoken";
import { addRefreshToken, revokeRefreshTokenByJti, replaceRefreshToken, isRefreshTokenValid, } from "../repositories/user.repository.js";
import { newJti, hashToken } from "../utils/crypto.js";
import { ENV } from "../config/env.js";

const COOKIE_NAME = ENV.REFRESH_COOKIE_NAME;
const baseCookie = {
  httpOnly: true,
  sameSite: (ENV.COOKIE_SAMESITE as "lax" | "strict" | "none") ?? "lax",
  secure: !!ENV.COOKIE_SECURE,
  path: ENV.COOKIE_PATH || "/",
} as const;

export async function loginController(req: Request, res: Response) {
  const { email, password, rememberMe } = req.body as {
    email: string; password: string; rememberMe?: boolean;
  };
  const ua = useragent.parse(req.headers["user-agent"] || "");
  const browser = `${ua.family} ${ua.major || ""}`.trim();
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || undefined;

  const user = await login(email, password, ip, browser);
  const accessToken = signAccessToken({ sub: user.idUser, role: String(user.idUserGroup) });
  const jti = newJti();

  const refreshToken = signRefreshToken({
    sub: user.idUser,
    jti,
    rememberMe: !!rememberMe,
  });

  const days = rememberMe ? ENV.REFRESH_REMEMBER_DAYS : ENV.REFRESH_DEFAULT_DAYS;
  const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  const sessionData /* : InsertSession */ = {
    jti,
    userId: String(user.idUser),
    tokenHash: hashToken(refreshToken),
    expiresAt,
    ...(req.headers["user-agent"] ? { userAgent: String(req.headers["user-agent"]) } : {}),
    ...(ip ? { ip } : {}),
  };
  await addRefreshToken(sessionData);

  const cookieOptions = rememberMe
    ? { ...baseCookie, maxAge: days * 24 * 60 * 60 * 1000 }
    : baseCookie;
  res
    .cookie(COOKIE_NAME, refreshToken, cookieOptions)
    .json({
      ok: true, user: {
        idUser: user.idUser,
        email: user.email,
        idUserGroup: user.idUserGroup
      }, accessToken
    }
    );
}


export async function changePasswordController(req: Request, res: Response) {
  const { id } = req.params;
  const { currentPassword, newPassword } = req.body;
  await changePasswordByEmail(Number(id), currentPassword, newPassword);
  res.json({ ok: true, message: "Contraseña actualizada" });
}

export async function forgotPasswordController(req: Request, res: Response) {
  const { email } = req.body;
  await forgotPassword(email);
  res.json({ ok: true, message: "Si el email existe, se envió un enlace" });
}

export async function logoutController(req: Request, res: Response) {
  const rt = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (rt) {
    try {
      const payload = verifyRefreshToken<{ jti: string }>(rt);
      await revokeRefreshTokenByJti(payload.jti);
    } catch {
      // token inválido/expirado: igual limpiamos la cookie
    }
  }
  res.clearCookie(COOKIE_NAME, baseCookie);
  res.json({ ok: true });
}

export async function registerController(req: Request, res: Response) {
  try {
    const { email, password, confirmPassword, idUserGroup } = req.body;
    console.log(req.body);
    if (!email || !password || !confirmPassword) {
      return res.status(400).json({ message: "Todos los campos son obligatorios." });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ message: "El email no es válido." });
    }

    // Validar contraseñas
    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Las contraseñas no coinciden." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const newUser = await registerNewUser(email, passwordHash, idUserGroup);

    return res.status(201).json({
      message: "Usuario registrado con éxito.",
      user: {
        idUser: newUser.idUser,
        email: newUser.email,
        idUserGroup: newUser.idUserGroup
      }
    });
  } catch (error) {
    console.error("Error en registerController:", error);
    return res.status(500).json({ message: "Error al registrar el usuario." });
  }
}

export async function getMeController(req: AuthRequest, res: Response) {
  try {
    const userId = req.userId; // viene del middleware
    console.log("User ID from request:", userId);
    if (!userId) return res.status(401).json({ error: "No auth token" });
    const user = await getUserById(userId);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });

    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: "Error al obtener usuario" });
  }
}

export async function refreshController(req: Request, res: Response) {
  const rt = req.cookies?.[COOKIE_NAME] as string | undefined;
  if (!rt) return res.status(401).json({ ok: false, message: "No refresh cookie" });

  try {
    const payload = verifyRefreshToken<{ sub: number; type: "refresh"; jti: string; exp: number }>(rt);

    const ok = await isRefreshTokenValid(payload.jti, hashToken(rt));
    if (!ok) return res.status(401).json({ ok: false, message: "Invalid refresh" });

    const accessToken = signAccessToken({ sub: payload.sub });

    const now = Date.now();
    const remainingMs = payload.exp * 1000 - now;
    if (remainingMs <= 0) return res.status(401).json({ ok: false, message: "Expired refresh" });

    const newId = newJti();
    // Firmamos refresh nuevo con el tiempo restante
    const newRefresh = ((): string => {

      const p = { sub: payload.sub, type: "refresh", jti: newId };
      const newRefresh = jwt.sign(p, ENV.JWT_REFRESH_SECRET, {
      expiresIn: Math.ceil(remainingMs / 1000),
});
      return newRefresh;
    })() as unknown as string; // TS helper; arriba hacemos import dinámico

    await replaceRefreshToken({
      oldJti: payload.jti,
      newJti: newId,
      oldTokenHash: hashToken(rt),
      newTokenHash: hashToken(newRefresh),
      expiresAt: new Date(now + remainingMs),
    });

    // Reescribir cookie (mantenemos cookie de sesión aquí; si querés preservar maxAge exacto,
    // guardalo junto al refresh al momento del login y úsalo acá).
    res.cookie(COOKIE_NAME, newRefresh, baseCookie);

    return res.json({ ok: true, accessToken });
  } catch (e) {
    return res.status(401).json({ ok: false, message: "Invalid/expired refresh" });
  }
}

