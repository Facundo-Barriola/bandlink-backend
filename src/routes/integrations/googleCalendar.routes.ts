import { Router } from "express";
import { getAuthUrlForUser, exchangeCodeForTokens, saveTokensForUser } from "../../lib/google/calendar.js";
import { requireAuth } from "../../middlewares/auth.js";
export const googleCalendarRouter = Router();
googleCalendarRouter.use(requireAuth);

googleCalendarRouter.get("/auth", (req: any, res) => {
  if (!req.userId) return res.status(401).send("No autenticado");
  const url = getAuthUrlForUser(req.userId);
  res.redirect(url);
});

googleCalendarRouter.get("/callback", async (req: any, res) => {
  try {
    const { code, state } = req.query;
    if (!code) return res.status(400).send("Falta code");
    let idUserFromState: number | null = null;
    if (state) {
      try {
        const json = Buffer.from(String(state), "base64url").toString("utf8");
        const parsed = JSON.parse(json);
        idUserFromState = Number(parsed?.idUser);
      } catch {}
    }
    const idUser = req.userId ?? idUserFromState;
    if (!idUser) return res.status(401).send("No autenticado");

    const tokens = await exchangeCodeForTokens(String(code));
    await saveTokensForUser(idUser, tokens);
    res.redirect("/settings?gcal=connected");
  } catch (e: any) {
    console.error(e);
    res.status(500).send("Error integrando Google Calendar");
  }
});
