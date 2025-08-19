import { createSession, deleteSessionByToken, findUserByEmail, updateLastLogin, updateUserPassword, insertNewUser } from "../users/user.repository.js";
import { hashPassword, verifyPassword } from "../../utils/crypto.js";
import { signAuthToken } from "../../utils/jwt.js";

export async function login(email: string, password: string, ip?: string, browser?: string) {
  const user = await findUserByEmail(email);
  if (!user) throw { status: 401, message: "Credenciales inválidas" };

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) throw { status: 401, message: "Credenciales inválidas" };

  const token = signAuthToken({ sub: user.idUser });
  await createSession(user.idUser, token, ip, browser);
  await updateLastLogin(user.idUser);

  return { token, user: { idUser: user.idUser, email: user.email, idUserGroup: user.idUserGroup } };
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

export async function logout(token?: string) {
  if (!token) return;
  await deleteSessionByToken(token);
}

export async function registerNewUser(email: string, passwordHash: string) {
  const existingUser = await findUserByEmail(email);
  if (existingUser) throw { status: 400, message: "El email ya está en uso" };

  const idUser = await insertNewUser(email, passwordHash);
  return { idUser, email };
}
