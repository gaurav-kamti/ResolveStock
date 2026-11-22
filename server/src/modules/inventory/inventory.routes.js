const express = require("express");

const router = express.Router();

const {
  createMovement,
  getInventory,
  getProductStock,
  getStockMovements,
} = require("./inventory.controller");

const {
  createMovementSchema,
  getInventorySchema,
  getProductStockSchema,
  getStockMovementsSchema,
} = require("./inventory.validation");

const validate = require("../../middleware/validate.middleware");
const { protect } = require("../auth/auth.middleware");

// All inventory routes require authentication.
router.use(protect);

// Get inventory overview.
router.get("/", validate(getInventorySchema), getInventory);

// Create stock movement.
router.post("/movements", validate(createMovementSchema), createMovement);

// Get stock movement history.
router.get("/movements", validate(getStockMovementsSchema), getStockMovements);

// Get stock for a specific product.
router.get("/:productId", validate(getProductStockSchema), getProductStock);

module.exports = router;
