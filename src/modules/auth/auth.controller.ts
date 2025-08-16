import { Request, Response } from "express";
import useragent from "useragent";
import { changePasswordByEmail, forgotPassword, login, logout } from "./auth.service.js";

const COOKIE_NAME = "auth_token";

export async function loginController(req: Request, res: Response) {
  const { email, password } = req.body;
  const ua = useragent.parse(req.headers["user-agent"] || "");
  const browser = `${ua.family} ${ua.major || ""}`.trim();
  const ip = (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req.socket.remoteAddress || undefined;

  const { token, user } = await login(email, password, ip, browser);

  res
    .cookie(COOKIE_NAME, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    })
    .json({ ok: true, user });
}

export async function changePasswordController(req: Request, res: Response) {
  const { email, oldPassword, newPassword } = req.body;
  await changePasswordByEmail(email, oldPassword, newPassword);
  res.json({ ok: true, message: "Contraseña actualizada" });
}

export async function forgotPasswordController(req: Request, res: Response) {
  const { email } = req.body;
  await forgotPassword(email);
  res.json({ ok: true, message: "Si el email existe, se envió un enlace" });
}

export async function logoutController(req: Request, res: Response) {
  const bearer = req.headers.authorization;
  const cookieToken = req.cookies?.auth_token as string | undefined;
  const token = bearer?.startsWith("Bearer ") ? bearer.slice(7) : cookieToken;

  await logout(token);
  res.clearCookie(COOKIE_NAME, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  res.json({ ok: true });
}
