import { createSession, deleteSessionByToken, findUserByEmail, updateLastLogin, updateUserPassword, insertNewUser, findUserById } from "../repositories/user.repository.js";
import { hashPassword, verifyPassword } from "../utils/crypto.js";
import { signAuthToken } from "../utils/jwt.js";
import { User } from "../models/user.model.js";

export async function login(email: string, password: string, ip?: string, browser?: string) {
  const user = await findUserByEmail(email);
  if (!user) throw { status: 401, message: "Credenciales inválidas" };

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw { status: 401, message: "Credenciales inválidas" };

  await updateLastLogin(user.idUser);

  return user;
}

export async function changePasswordByEmail(email: string, oldPass: string, newPass: string) {
  const user = await findUserByEmail(email);
  if (!user) throw { status: 404, message: "Usuario no encontrado" };

  const ok = await verifyPassword(oldPass, user.passwordHash);
  if (!ok) throw { status: 400, message: "Contraseña actual incorrecta" };

  const newHash = await hashPassword(newPass);
  await updateUserPassword(user.idUser, newHash);
}

export async function forgotPassword(email: string) {
  // CU42: “Recordar contraseña” → mandar mail con link de reset.
  const user = await findUserByEmail(email);
  if (!user) return;
  const token = signAuthToken({ sub: user.idUser, act: "reset" }); 
  const fakeLink = `https://bandlink.app/reset-password?token=${encodeURIComponent(token)}`;
  console.log("🔗 Enviar este link por email:", fakeLink);
  //  implementar nodemailer para enviar realmente.
}


export async function registerNewUser(email: string, passwordHash: string) {
  const existingUser = await findUserByEmail(email);
  if (existingUser) throw { status: 400, message: "El email ya está en uso" };

  const idUser = await insertNewUser(email, passwordHash);
  return { idUser, email };
}

export async function getUserById(id: number): Promise<User | null> {

  const user = await findUserById(id);
  return user;
}
