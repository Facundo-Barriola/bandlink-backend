import { Router } from "express";
import { requireAuth } from "../middlewares/auth.js";
import { createEventController, listEventsController, getEventController,
    updateEventController, deleteEventController, createEventInvitesController, listMyEventsController,
    searchEventByNameController  
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

router.get("/:idEvent", getEventController);   
router.post("/", createEventController);
router.put("/:idEvent", updateEventController);
router.delete("/:idEvent", deleteEventController);
router.post("/:idEvent/invites", createEventInvitesController);


router.post("/:idEvent/attendees", attendEventController);         // agendar / unirse (usuario)
router.delete("/:idEvent/attendees", unAttendEventController);     // cancelar agenda (usuario)

router.post("/:idEvent/bands/join", bandJoinEventController);      // unirse como banda (solo admin)
router.post("/:idEvent/bands/:idBand/confirm", bandConfirmAttendanceController);
export default router;