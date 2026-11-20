const express = require("express");

const router = express.Router();

const {
  createParty,
  getParties,
  getParty,
  updateParty,
} = require("./party.controller");

const {
  createPartySchema,
  updatePartySchema,
  getPartySchema,
  listPartiesSchema,
} = require("./party.validation");

const validate = require("../../middleware/validate.middleware");
const { protect } = require("../auth/auth.middleware");

// All party routes require authentication
router.use(protect);

// Create party
router.post("/", validate(createPartySchema), createParty);

// Get all parties
router.get("/", validate(listPartiesSchema), getParties);

// Get one party
router.get("/:id", validate(getPartySchema), getParty);

// Update party
router.patch("/:id", validate(updatePartySchema), updateParty);

module.exports = router;
