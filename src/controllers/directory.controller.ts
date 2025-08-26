import { Request, Response } from "express";
import { DirectoryService } from "../services/directory.service.js";

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
    const data = await DirectoryService.getMusicianProfileByUser(idUser);
    if (!data || !data.user) {
      return res.status(404).json({ ok: false, error: "Perfil no encontrado" });
    }
    return res.json({ ok: true, data });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ ok: false, error: "Error del servidor" });
  }
}