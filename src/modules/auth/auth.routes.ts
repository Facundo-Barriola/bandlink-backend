import { Router } from "express";
import { changePasswordController, forgotPasswordController, loginController, logoutController } from "./auth.controller.js";

const router = Router();

router.post("/login", loginController);                 
router.post("/change-password", changePasswordController); 
router.post("/forgot-password", forgotPasswordController); 
router.post("/logout", logoutController);               

export default router;
