import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import {
  inviteMusicianController,
  acceptInviteController,
  rejectInviteController,
  kickMemberController,
  leaveBandController,
  listPendingInvitesForMusicianController
} from "../controllers/band-invites.controller.js";


const router = Router();
router.use(requireAuth);

router.post("/:id/invites", inviteMusicianController);
router.post("/:inviteId/accept", acceptInviteController);
router.post("/:inviteId/reject", rejectInviteController);
router.post("/:id/kick", kickMemberController);
router.post("/:id/leave", leaveBandController);
router.get("/:id/pending", listPendingInvitesForMusicianController );

export default router;