import { Request } from "express";

export interface AuthRequest extends Request {
  userId?: number;
  user?: { idUser: number; email?: string; role?: number; passwordHash?: string };
}