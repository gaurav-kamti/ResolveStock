const express = require("express");

const router = express.Router();

const {
  createUnit,
  getUnits,
  getUnit,
  updateUnit,
} = require("./unit.controller");

const {
  createUnitSchema,
  updateUnitSchema,
  getUnitSchema,
  listUnitsSchema,
} = require("./unit.validation");

const validate = require("../../middleware/validate.middleware");
const { protect } = require("../auth/auth.middleware");

// All unit routes require authentication
router.use(protect);

// Create unit
router.post("/", validate(createUnitSchema), createUnit);

// Get all units
router.get("/", validate(listUnitsSchema), getUnits);

// Get one unit
router.get("/:id", validate(getUnitSchema), getUnit);

// Update unit
router.patch("/:id", validate(updateUnitSchema), updateUnit);

module.exports = router;
