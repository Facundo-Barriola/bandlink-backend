import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { reserveRoomController, getBookingsController } from "../controllers/booking.controller.js";
import { get } from "http";

const router = Router();
router.use(requireAuth);

router.post("/rooms/:idRoom/reserve", reserveRoomController);
router.get("/", getBookingsController);

export default router;