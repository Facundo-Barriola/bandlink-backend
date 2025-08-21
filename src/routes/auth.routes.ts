import { Router } from "express";
import { changePasswordController, forgotPasswordController, loginController, logoutController, registerController, getMeController, refreshController } from "../controllers/auth.controller.js";
import { requireAuth } from "../middlewares/auth.js"; 

const router = Router();

router.post("/login", loginController);
router.post("/refresh", refreshController);
router.post("/logout", logoutController);
router.post("/register", registerController);  
                    
router.post("/change-password", changePasswordController); 
router.post("/forgot-password", forgotPasswordController); 
     
router.get("/me", requireAuth, getMeController);        

export default router;
