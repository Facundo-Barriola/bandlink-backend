import { Router } from "express";
import {registerFullController, deleteAccountController} from "../controllers/account.controller.js";

const router = Router();

router.post("/registerFull", registerFullController);
router.delete("/delete/:userId", deleteAccountController);

export default router;