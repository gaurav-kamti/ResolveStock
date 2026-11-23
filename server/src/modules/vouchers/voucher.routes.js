const express = require("express");

const validate = require("../../middleware/validate.middleware");
const { protect } = require("../auth/auth.middleware");

const {
  createVoucherSchema,
  getVouchersSchema,
  getVoucherByIdSchema,
  cancelVoucherSchema,
} = require("./voucher.validation");

const {
  createPaymentVoucherController,
  getVouchersController,
  getVoucherByIdController,
  cancelPaymentVoucherController,
} = require("./voucher.controller");

const router = express.Router();

// All voucher routes require authentication.
router.use(protect);

// Get all vouchers.
router.get("/", validate(getVouchersSchema), getVouchersController);

// Get a single voucher by ID.
router.get(
  "/:voucherId",
  validate(getVoucherByIdSchema),
  getVoucherByIdController,
);

// Create a payment voucher.
router.post("/", validate(createVoucherSchema), createPaymentVoucherController);

// Cancel a posted payment voucher.
router.patch(
  "/:voucherId/cancel",
  validate(cancelVoucherSchema),
  cancelPaymentVoucherController,
);

module.exports = router;
