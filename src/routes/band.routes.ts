import {createBandController, getBandController, updateBandController, deleteBandController, createSearchController, 
    listSearchByBandController, deactivateSearchController, searchBandByNameController,
getAdminBandsController, getMembershipController, unfollowBandController, followBandController} from "../controllers/band.controller.js";
import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";

const router = Router();

router.post("/", requireAuth, createBandController);
router.get("/search", searchBandByNameController);
router.get("/:id", getBandController);
router.get("/:idUser/adminBands", requireAuth, getAdminBandsController);
router.put("/:id", requireAuth, updateBandController);
router.delete("/:id", requireAuth, deleteBandController);
router.post("/:id/searches", requireAuth, createSearchController);
router.get("/:id/searches", requireAuth, listSearchByBandController);
router.post("/:id/searches/:idSearch/deactivate", requireAuth, deactivateSearchController);

router.get("/:id/membership", requireAuth, getMembershipController);
router.post("/:id/follow", requireAuth, followBandController);
router.delete("/:id/follow", requireAuth, unfollowBandController);

export default router;