const express = require("express");

const { getPartyLedgerHistory } = require("./partyLedger.controller");

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
  getPartyLedgerSchema,
} = require("./party.validation");

const validate = require("../../middleware/validate.middleware");
const { protect } = require("../auth/auth.middleware");

// All party routes require authentication
router.use(protect);

// Create party
router.post("/", validate(createPartySchema), createParty);

// Get all parties
router.get("/", validate(listPartiesSchema), getParties);

// Get party ledger history.
router.get(
  "/:id/ledger",
  validate(getPartyLedgerSchema),
  getPartyLedgerHistory,
);

// Get one party
router.get("/:id", validate(getPartySchema), getParty);

// Update party
router.patch("/:id", validate(updatePartySchema), updateParty);

module.exports = router;
