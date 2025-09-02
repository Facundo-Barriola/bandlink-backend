import type { Request, Response } from "express";
import * as Svc from "../services/band-invites.service.js";

export async function inviteMusicianController(req: Request, res: Response) {
  try {
    console.log("=== INVITE MUSICIAN CONTROLLER INICIADO ===");
    
    // Log de headers para debugging
    console.log("Headers recibidos:", {
      'content-type': req.headers['content-type'],
      'authorization': req.headers['authorization'] ? 'Bearer [TOKEN]' : 'No token',
      'user-agent': req.headers['user-agent']
    });
    
    // Log de parámetros de la URL
    console.log("Parámetros de URL:", req.params);
    console.log("Query parameters:", req.query);
    
    // Log del body completo
    console.log("Body completo recibido:", JSON.stringify(req.body, null, 2));
    
    const user = (req as any).user;
    const idBand = Number(req.params.id);
    
    console.log("=== DATOS EXTRAÍDOS ===");
    console.log("ID de la banda (idBand):", idBand, typeof idBand);
    console.log("Usuario autenticado:", {
      idUser: user?.idUser,
      email: user?.email,
      name: user?.name
    });
    
    const { targetMusicianId, roleSuggested, message } = req.body ?? {};
    
    console.log("=== DATOS DEL BODY ===");
    console.log("targetMusicianId:", targetMusicianId, typeof targetMusicianId);
    console.log("roleSuggested:", roleSuggested, typeof roleSuggested);
    console.log("message:", message, typeof message);
    
    // Validación de parámetros
    if (!Number.isFinite(idBand) || !Number.isFinite(Number(targetMusicianId))) {
      console.log("❌ ERROR: Parámetros inválidos");
      console.log("idBand es finito:", Number.isFinite(idBand));
      console.log("targetMusicianId es finito:", Number.isFinite(Number(targetMusicianId)));
      return res.status(400).json({ ok: false, error: "Parámetros inválidos" });
    }
    
    console.log("✅ Parámetros válidos, llamando al servicio...");
    console.log("Parámetros para el servicio:", {
      userId: user.idUser,
      bandId: idBand,
      targetMusicianId: Number(targetMusicianId),
      roleSuggested: roleSuggested ?? null,
      message: message ?? null
    });
    
    const r = await Svc.invite(user.idUser, idBand, Number(targetMusicianId), roleSuggested ?? null, message ?? null);
    
    console.log("=== RESPUESTA DEL SERVICIO ===");
    console.log("Service response:", JSON.stringify(r, null, 2));
    
    const responseStatus = r.ok ? 201 : 400;
    const responseData = { ok: r.ok, data: r, error: r.ok ? null : r.info };
    
    console.log("=== RESPUESTA FINAL ===");
    console.log("Status:", responseStatus);
    console.log("Response data:", JSON.stringify(responseData, null, 2));
    console.log("=== INVITE MUSICIAN CONTROLLER FINALIZADO ===\n");
    
    return res.status(responseStatus).json(responseData);
  } catch (e: any) {
    console.log("❌ ERROR EN INVITE MUSICIAN CONTROLLER:");
    console.log("Error message:", e.message);
    console.log("Error stack:", e.stack);
    console.log("HTTP Status:", e.httpStatus);
    
    const status = e.httpStatus ?? 500;
    const errorResponse = { ok: false, error: e.message ?? "Error del servidor" };
    
    console.log("Respuesta de error:", JSON.stringify(errorResponse, null, 2));
    console.log("=== INVITE MUSICIAN CONTROLLER FINALIZADO CON ERROR ===\n");
    
    return res.status(status).json(errorResponse);
  }
}

export async function listPendingInvitesForMusicianController(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    console.log("Listando invitaciones pendientes para el usuario con ID:", user.idUser);
    const r = await Svc.listPendingInvitesForMusician(user.idUser);
    console.log("Invitaciones pendientes encontradas:", r.length);
    return res.status(200).json({ ok: true, data: r });
  } catch (e: any) {
    return res.status(e.httpStatus ?? 500).json({ ok: false, error: e.message ?? "Error del servidor" });
  }
}

export async function acceptInviteController(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const idInvite = Number(req.params.inviteId);
    if (!Number.isFinite(idInvite)) return res.status(400).json({ ok: false, error: "ID inválido" });
    const r = await Svc.acceptInvite(user.idUser, idInvite);
    return res.status(r.ok ? 200 : 400).json({ ok: r.ok, data: r, error: r.ok ? null : r.info });
  } catch (e: any) {
    return res.status(e.httpStatus ?? 500).json({ ok: false, error: e.message ?? "Error del servidor" });
  }
}

export async function rejectInviteController(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const idInvite = Number(req.params.inviteId);
    if (!Number.isFinite(idInvite)) return res.status(400).json({ ok: false, error: "ID inválido" });
    const r = await Svc.rejectInvite(user.idUser, idInvite);
    return res.status(r.ok ? 200 : 400).json({ ok: r.ok, data: r, error: r.ok ? null : r.info });
  } catch (e: any) {
    return res.status(e.httpStatus ?? 500).json({ ok: false, error: e.message ?? "Error del servidor" });
  }
}

export async function kickMemberController(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const idBand = Number(req.params.id);
    const { targetMusicianId } = req.body ?? {};
    if (!Number.isFinite(idBand) || !Number.isFinite(Number(targetMusicianId))) {
      return res.status(400).json({ ok: false, error: "Parámetros inválidos" });
    }
    const r = await Svc.kick(user.idUser, idBand, Number(targetMusicianId));
    return res.status(r.ok ? 200 : 400).json({ ok: r.ok, data: r, error: r.ok ? null : r.info });
  } catch (e: any) {
    return res.status(e.httpStatus ?? 500).json({ ok: false, error: e.message ?? "Error del servidor" });
  }
}

export async function leaveBandController(req: Request, res: Response) {
  try {
    const user = (req as any).user;
    const idBand = Number(req.params.id);
    if (!Number.isFinite(idBand)) return res.status(400).json({ ok: false, error: "ID inválido" });
    const r = await Svc.leave(user.idUser, idBand);
    return res.status(r.ok ? 200 : 400).json({ ok: r.ok, data: r, error: r.ok ? null : r.info });
  } catch (e: any) {
    return res.status(e.httpStatus ?? 500).json({ ok: false, error: e.message ?? "Error del servidor" });
  }
}
