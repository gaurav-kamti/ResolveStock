const {
  createPurchase,
  receivePurchase,
  cancelPurchase,
  getPurchases,
  getPurchaseById,
} = require("./purchase.service");

// Create a draft purchase.
const createPurchaseController = async (req, res, next) => {
  try {
    const { supplier, supplierInvoiceNumber, purchaseDate, items, notes } =
      req.validated.body;

    const purchase = await createPurchase({
      supplierId: supplier,
      supplierInvoiceNumber,
      purchaseDate,
      items,
      notes,
      createdBy: req.user.id,
    });

    return res.status(201).json({
      success: true,
      message: "Purchase created successfully.",
      data: {
        purchase,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Receive a draft purchase.
const receivePurchaseController = async (req, res, next) => {
  try {
    const purchase = await receivePurchase({
      purchaseId: req.validated.params.purchaseId,
      performedBy: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Purchase received successfully.",
      data: {
        purchase,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Cancel a draft or received purchase.
const cancelPurchaseController = async (req, res, next) => {
  try {
    const purchase = await cancelPurchase({
      purchaseId: req.validated.params.purchaseId,
      reason: req.validated.body.reason,
      performedBy: req.user.id,
    });

    return res.status(200).json({
      success: true,
      message: "Purchase cancelled successfully.",
      data: {
        purchase,
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get purchases with filters and pagination.
const getPurchasesController = async (req, res, next) => {
  try {
    const result = await getPurchases(req.validated.query);

    return res.status(200).json({
      success: true,
      message: "Purchases fetched successfully.",
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

// Get a single purchase by ID.
const getPurchaseByIdController = async (req, res, next) => {
  try {
    const purchase = await getPurchaseById(req.validated.params.purchaseId);

    return res.status(200).json({
      success: true,
      message: "Purchase fetched successfully.",
      data: {
        purchase,
      },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createPurchaseController,
  receivePurchaseController,
  cancelPurchaseController,
  getPurchasesController,
  getPurchaseByIdController,
};
