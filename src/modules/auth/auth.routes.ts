import { Router } from "express";
import { changePasswordController, forgotPasswordController, loginController, logoutController, registerController, getMeController } from "./auth.controller.js";
import { requireAuth } from "../../middlewares/auth.js"; 

const router = Router();

router.post("/login", loginController);                 
router.post("/change-password", changePasswordController); 
router.post("/forgot-password", forgotPasswordController); 
router.post("/logout", logoutController);
router.post("/register", registerController);       
router.get("/me", requireAuth, getMeController);        

export default router;
