import { Request, Response } from "express";
import {DirectoryService} from "../services/directory.service.js";

export async function getInstrumentsController(req: Request, res: Response){
    const data = await DirectoryService.listInstruments();
    res.json({ ok: true, data });
}