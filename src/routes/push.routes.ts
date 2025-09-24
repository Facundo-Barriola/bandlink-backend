import { Router } from "express";
import { saveSubscription, removeSubscription } from "../controllers/push.controller.js";
import {requireAuth} from "../middlewares/auth.js";
const r = Router();
r.post("/subscribe", requireAuth, saveSubscription);     
r.post("/unsubscribe", requireAuth, removeSubscription); 
export default r;