import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { createEventController, listEventsController, getEventController,
    updateEventController, deleteEventController, createEventInvitesController, listMyEventsController,
    searchEventByNameController, updateEventLocationController, getMyAttendingEventsController  
 } from "../controllers/events.controller.js"

import {
  attendEventController,
  unAttendEventController,
  bandJoinEventController,
  bandConfirmAttendanceController,
} from "../controllers/events-participation.controller.js";

const router = Router();
router.use(requireAuth);

router.get("/", listEventsController);
router.get("/myEvents", listMyEventsController);
router.get("/search", searchEventByNameController);
router.get("/attending", requireAuth, getMyAttendingEventsController);

router.get("/:idEvent", getEventController);   
router.post("/", createEventController);
router.put("/:idEvent", updateEventController);
router.delete("/:idEvent", deleteEventController);
router.post("/:idEvent/invites", createEventInvitesController);
router.put("/:idEvent/location", requireAuth, updateEventLocationController);


router.post("/:idEvent/attendees", attendEventController);         
router.delete("/:idEvent/attendees", unAttendEventController);     

router.post("/:idEvent/bands/join", bandJoinEventController);     
router.post("/:idEvent/bands/:idBand/confirm", bandConfirmAttendanceController);
export default router;