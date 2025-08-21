import jwt, { Secret, SignOptions, JwtPayload } from "jsonwebtoken";
import { ENV } from "../config/env.js";


// ENV.JWT_EXPIRES puede ser string ("7d", "1h") o number (segundos)
const signOptions: SignOptions = { expiresIn: ENV.JWT_EXPIRES as any };


export function signAuthToken(payload: object) {
// Útil para verificar en logs qué llega desde .env
console.log("JWT_EXPIRES:", ENV.JWT_EXPIRES, typeof ENV.JWT_EXPIRES);
return jwt.sign(payload, ENV.JWT_SECRET as Secret, signOptions);
}

export function verifyAuthToken<T extends JwtPayload | { sub: number }>(token: string): T {
  const decoded = jwt.verify(token, ENV.JWT_SECRET as Secret);
  return decoded as T;
}