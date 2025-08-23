import { Router } from "express";
import { getCitiesController, getCountriesController, getProvincesController } from "../controllers/address.controller.js";

const router = Router();

router.get("/countries", getCountriesController);
router.get("/:countryId/provinces", getProvincesController);
router.get("/:provinceId/cities", getCitiesController);

export default router;