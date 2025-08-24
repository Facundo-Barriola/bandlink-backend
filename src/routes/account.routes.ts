import { Router } from "express";
import {registerFullController} from "../controllers/account.controller.js";

const router = Router();

router.post("/registerFull", registerFullController);

export default router;