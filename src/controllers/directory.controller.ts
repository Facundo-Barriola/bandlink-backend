import { Request, Response } from "express";
import { DirectoryService } from "../services/directory.service.js";
import { LegacyReturn } from "../types/LegacyReturn.js";

export async function getInstrumentsController(req: Request, res: Response) {
  const data = await DirectoryService.listInstruments();
  res.json({ ok: true, data });
}

export async function getAmenitiesController(req: Request, res: Response) {
  const data = await DirectoryService.listAmenities();
  res.json({ ok: true, data });
}

export async function getMusicianProfileController(req: Request, res: Response) {
  const idUser = Number(req.params.id);
  if (!Number.isFinite(idUser)) {
    return res.status(400).json({ ok: false, error: "idUser inválido" });
  }

  try {
    const result = await DirectoryService.getMusicianProfileByUser(idUser);
    if (!result || !result.legacy?.user) {
      return res.status(404).json({ ok: false, error: "Perfil no encontrado" });
    }

    const { legacy, musicianProfile } = result;
    return res.json({ ok: true, data: { ...legacy, musicianProfile} });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}

export async function getMusicianByNameController(req: Request, res: Response) {
  const userName = req.params.userName;
  if (!userName)
    return res.status(400).json({ ok: false, error: "nombre de usario inválido" });
  try {
    const list = await DirectoryService.getMusicianByName(userName);
    if (!list.length || !list[0]?.idUserProfile) {
      return res.status(404).json({ ok: false, error: "Perfil no encontrado" });
    }
    // si querés devolver el primero:
    return res.json({ ok: true, data: list[0] });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}