import { AccountService } from "../services/account.service.js";
import { Request, Response } from 'express';

export async function registerFullController(req: Request, res: Response) {
    try {
        console.log(req.body);
        const out = await AccountService.registerFull(req.body);
        res.status(201).json({ ok: true, data: out });
    } catch (e: any) {
        if (e?.code === "23505") {
            return res.status(409).json({ ok: false, message: "Email ya registrado" });
        }
        res.status(400).json({ ok: false, message: e?.message ?? "Error en registro" });
    }
};