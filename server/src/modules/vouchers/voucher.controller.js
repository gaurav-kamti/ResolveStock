
const {
  createPaymentVoucher,
  getVouchers,
  getVoucherById,
  cancelPaymentVoucher,
} = require("./voucher.service");

// Create a supplier payment voucher.
const createPaymentVoucherController = async (req, res, next) => {
  try {
    const {
      party,
      voucherDate,
      amount,
      paymentMethod,
      allocationMode,
      allocations,
      referenceNumber,
      bankName,
      chequeNumber,
      chequeDate,
      notes,
    } = req.validated.body;

    const voucher = await createPaymentVoucher({
      partyId: party,
      voucherDate,
      amount,
      paymentMethod,
      allocationMode,
      allocations,
      referenceNumber,
      bankName,
      chequeNumber,
      chequeDate,
      notes,
      createdBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Payment voucher created successfully.",
      data: { voucher },
    });
  } catch (error) {
    return next(error);
  }
};

// Get all vouchers with filters and pagination.
const getVouchersController = async (req, res, next) => {
  try {
    const result = await getVouchers(req.validated.query);

    return res.status(200).json({
      success: true,
      message: "Vouchers fetched successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

// Get a single voucher by ID.
const getVoucherByIdController = async (req, res, next) => {
  try {
    const { voucherId } = req.validated.params;
    const voucher = await getVoucherById(voucherId);

    return res.status(200).json({
      success: true,
      message: "Voucher fetched successfully.",
      data: { voucher },
    });
  } catch (error) {
    return next(error);
  }
};

// Cancel a posted Payment Voucher.
const cancelPaymentVoucherController = async (req, res, next) => {
  try {
    const { voucherId } = req.validated.params;
    const { reason } = req.validated.body;

    const voucher = await cancelPaymentVoucher({
      voucherId,
      reason,
      cancelledBy: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Payment voucher cancelled successfully.",
      data: { voucher },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createPaymentVoucherController,
  getVouchersController,
  getVoucherByIdController,
  cancelPaymentVoucherController,
};
