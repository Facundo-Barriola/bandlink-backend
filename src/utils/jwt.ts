import jwt, {Secret, SignOptions } from "jsonwebtoken";
import { ENV } from "../config/env.js";

const options: SignOptions = { expiresIn: Number(ENV.JWT_EXPIRES)};

export function signAuthToken(payload: object) {
  console.log("JWT_EXPIRES VALUE:", ENV.JWT_EXPIRES, typeof ENV.JWT_EXPIRES);
  return jwt.sign(payload, ENV.JWT_SECRET as Secret, options);
}
export function verifyAuthToken<T = any>(token: string): T {
  return jwt.verify(token, ENV.JWT_SECRET) as T;
}
