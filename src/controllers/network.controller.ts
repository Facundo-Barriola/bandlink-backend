import { Request, Response } from "express";
import { NetworkService } from "../services/network.service.js";
import type { AuthRequest } from "../types/authRequest.js";


function getActorId(req: Request): number | null {
  const authReq = req as AuthRequest;
  const id = authReq?.user?.idUser ?? authReq?.user?.idUser;
  return Number.isFinite(Number(id)) ? Number(id) : null;
}

function parseIdParam(raw: any): number | null {
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function sendConnectionRequestController(req: Request, res: Response) {
      const actorId = getActorId(req);
  const targetId = parseIdParam(req.params.targetId);
  if (!actorId) return res.status(401).json({ ok: false, error: "No autenticado" });
  if (!targetId) return res.status(400).json({ ok: false, error: "targetId inválido" });

  try {
    const r = await NetworkService.sendConnectionRequest(actorId, targetId);
    const code = r.ok ? 200 : 400;
    return res.status(code).json({ ok: r.ok, data: r, error: r.ok ? null : r.info });
  } catch (err) {
    console.error("[sendConnectionRequestController]", err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

export async function acceptConnectionRequestController(req: Request, res: Response) {
  const actorId = getActorId(req);
  const idConnection = parseIdParam(req.params.id);
  if (!actorId) return res.status(401).json({ ok: false, error: "No autenticado" });
  if (!idConnection) return res.status(400).json({ ok: false, error: "id inválido" });

  try {
    const r = await NetworkService.acceptConnectionRequest(actorId, idConnection);
    const code = r.ok ? 200 : 400;
    return res.status(code).json({ ok: r.ok, data: r, error: r.ok ? null : r.info });
  } catch (err) {
    console.error("[acceptConnectionRequestController]", err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

export async function rejectConnectionRequestController(req: Request, res: Response) {
  const actorId = getActorId(req);
  const idConnection = parseIdParam(req.params.id);
  if (!actorId) return res.status(401).json({ ok: false, error: "No autenticado" });
  if (!idConnection) return res.status(400).json({ ok: false, error: "id inválido" });

  try {
    const r = await NetworkService.rejectConnectionRequest(actorId, idConnection);
    const code = r.ok ? 200 : 400;
    return res.status(code).json({ ok: r.ok, data: r, error: r.ok ? null : r.info });
  } catch (err) {
    console.error("[rejectConnectionRequestController]", err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

export async function archiveConnectionController(req: Request, res: Response) {
  const actorId = getActorId(req);
  const idConnection = parseIdParam(req.params.id);
  const archived = typeof req.body?.archived === "boolean" ? req.body.archived : true;

  if (!actorId) return res.status(401).json({ ok: false, error: "No autenticado" });
  if (!idConnection) return res.status(400).json({ ok: false, error: "id inválido" });

  try {
    const r = await NetworkService.archiveConnection(actorId, idConnection, archived);
    const code = r.ok ? 200 : 400;
    return res.status(code).json({ ok: r.ok, data: r, error: r.ok ? null : r.info });
  } catch (err) {
    console.error("[archiveConnectionController]", err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

export async function deleteConnectionController(req: Request, res: Response) {
  const actorId = getActorId(req);
  const idConnection = parseIdParam(req.params.id);
  if (!actorId) return res.status(401).json({ ok: false, error: "No autenticado" });
  if (!idConnection) return res.status(400).json({ ok: false, error: "id inválido" });

  try {
    const r = await NetworkService.deleteConnection(actorId, idConnection);
    const code = r.ok ? 200 : 400;
    return res.status(code).json({ ok: r.ok, data: r, error: r.ok ? null : r.info });
  } catch (err) {
    console.error("[deleteConnectionController]", err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

export async function listIncomingPendingController(req: Request, res: Response) {
  const actorId = getActorId(req);
  if (!actorId) return res.status(401).json({ ok: false, error: "No autenticado" });

  try {
    const rows = await NetworkService.listIncomingPending(actorId);
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[listIncomingPendingController]", err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

export async function listOutgoingPendingController(req: Request, res: Response) {
  const actorId = getActorId(req);
  if (!actorId) return res.status(401).json({ ok: false, error: "No autenticado" });

  try {
    const rows = await NetworkService.listOutgoingPendings(actorId);
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[listOutgoingPendingController]", err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

export async function listAcceptedController(req: Request, res: Response) {
  const actorId = getActorId(req);
  if (!actorId) return res.status(401).json({ ok: false, error: "No autenticado" });

  try {
    const rows = await NetworkService.listAccepted(actorId);
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[listAcceptedController]", err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

export async function listArchivedController(req: Request, res: Response) {
  const actorId = getActorId(req);
  if (!actorId) return res.status(401).json({ ok: false, error: "No autenticado" });

  try {
    const rows = await NetworkService.listArchived(actorId);
    return res.json({ ok: true, data: rows });
  } catch (err) {
    console.error("[listArchivedController]", err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}