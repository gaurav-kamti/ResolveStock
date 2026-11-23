const express = require("express");

const validate = require("../../middleware/validate.middleware");
const { protect } = require("../auth/auth.middleware");

const {
  createPurchaseSchema,
  getPurchasesSchema,
  getPurchaseByIdSchema,
  receivePurchaseSchema,
  cancelPurchaseSchema,
} = require("./purchase.validation");

const {
  createPurchaseController,
  receivePurchaseController,
  cancelPurchaseController,
  getPurchasesController,
  getPurchaseByIdController,
} = require("./purchase.controller");

const router = express.Router();

// All purchase routes require authentication.
router.use(protect);

// Get purchases with filters and pagination.
router.get("/", validate(getPurchasesSchema), getPurchasesController);

// Receive a draft purchase.
router.post(
  "/:purchaseId/receive",
  validate(receivePurchaseSchema),
  receivePurchaseController,
);

// Cancel a draft or received purchase.
router.patch(
  "/:purchaseId/cancel",
  validate(cancelPurchaseSchema),
  cancelPurchaseController,
);

// Get a single purchase by ID.
router.get(
  "/:purchaseId",
  validate(getPurchaseByIdSchema),
  getPurchaseByIdController,
);

// Create a purchase.
router.post("/", validate(createPurchaseSchema), createPurchaseController);

module.exports = router;
