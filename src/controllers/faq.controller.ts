// src/controllers/faq.controller.ts
import { Request, Response } from "express";
import { FaqService } from "../services/faq.service.js";


function getQueryString(q: unknown): string | undefined {
  if (Array.isArray(q)) q = q[0];                // si viene repetida ?q=a&q=b
  if (typeof q !== "string") return undefined;
  const trimmed = q.trim();
  if (!trimmed) return undefined;                // "", "   "
  if (trimmed.toLowerCase() === "null") return undefined;
  if (trimmed.toLowerCase() === "undefined") return undefined;
  return trimmed;
}
export async function listFaqsController(req: Request, res: Response) {
  try {
    const groupRaw = Number(req.query.group);
    const group = Number.isFinite(groupRaw) ? groupRaw : 0; // 0 => sin grupo
    const q = getQueryString(req.query.q); 
    const opts: { q?: string } | undefined = q !== undefined ? { q } : undefined;

    const items = await FaqService.listFaqs(group, opts);
    return res.json({ ok: true, data: items });
  } catch (e) {
    console.error("listFaqsController()", e);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}
