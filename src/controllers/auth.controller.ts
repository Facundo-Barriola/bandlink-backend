import { Request, Response } from "express";
import useragent from "useragent";
import bcrypt from "bcrypt";
import { changePasswordByEmail, forgotPassword, login, logout, registerNewUser, getUserById } from "../services/auth.service.js";
import {AuthRequest}  from "../types/authRequest.js";
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
      secure: false,
      maxAge: 1000 * 60 * 60 * 24,
      path: "/",
    })
    .json({ ok: true, user:{
        idUser: user.idUser,
        email: user.email,
        idUserGroup: user.idUserGroup
    } });
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

export async function registerController(req: Request, res: Response){
  try{
    const{email, password, confirmPassword} = req.body;
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
    
    const newUser = await registerNewUser(email,passwordHash);

    return res.status(201).json({
      message: "Usuario registrado con éxito.",
      user: {
        idUser: newUser.idUser,
        email: newUser.email,
        idUserGroup: 1
      }
    });
  }catch (error) {
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
