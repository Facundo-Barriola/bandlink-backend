import { Router } from "express";
import {
  sendConnectionRequestController,
  acceptConnectionRequestController,
  rejectConnectionRequestController,
  archiveConnectionController,
  deleteConnectionController,
  listIncomingPendingController,
  listOutgoingPendingController,
  listAcceptedController,
  listArchivedController,
} from "../controllers/network.controller.js";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.use(requireAuth);

router.post("/connections/:targetId", sendConnectionRequestController);
router.post("/connections/:id/accept", acceptConnectionRequestController);
router.post("/connections/:id/reject", rejectConnectionRequestController);
router.post("/connections/:id/archive", archiveConnectionController);
router.delete("/connections/:id", deleteConnectionController);

router.get("/connections/incoming/pending", listIncomingPendingController);
router.get("/connections/outgoing/pending", listOutgoingPendingController);
router.get("/connections/accepted", listAcceptedController);
router.get("/connections/archived", listArchivedController);

export default router;