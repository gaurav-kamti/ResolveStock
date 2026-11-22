const mongoose = require("mongoose");

const Party = require("../parties/models/party.model");
const PartyLedger = require("../parties/models/partyLedger.model");
const Product = require("../products/models/product.model");

const Purchase = require("./models/purchase.model");
const PurchaseCounter = require("./models/purchaseCounter.model");

const { createStockMovement } = require("../inventory/inventory.service");

const ApiError = require("../../utils/ApiError");

// Round currency values to two decimal places.
const roundMoney = (amount) => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

// Generate the next purchase number.
const generatePurchaseNumber = async (session) => {
  const counter = await PurchaseCounter.findOneAndUpdate(
    { _id: "purchase" },
    { $inc: { sequence: 1 } },
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
      session,
    },
  );

  return `PUR-${String(counter.sequence).padStart(6, "0")}`;
};

// Create a draft purchase.
const createPurchase = async ({
  supplierId,
  supplierInvoiceNumber = "",
  purchaseDate,
  items,
  notes = "",
  createdBy,
}) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // 1. Verify supplier.
      const supplier = await Party.findOne({
        _id: supplierId,
        isActive: true,
        type: { $in: ["supplier", "both"] },
      }).session(session);

      if (!supplier) {
        throw new ApiError(
          404,
          "Supplier not found, inactive, or not registered as a supplier.",
        );
      }

      // 2. Prepare purchase items and calculate totals.
      const purchaseItems = [];

      let subtotal = 0;
      let discountTotal = 0;
      let taxableAmount = 0;
      let taxTotal = 0;
      let grandTotal = 0;

      for (const item of items) {
        // Find an active product and its active unit.
        const product = await Product.findOne({
          _id: item.product,
          isActive: true,
        })
          .populate({
            path: "unit",
            match: { isActive: true },
            select: "name symbol",
          })
          .session(session);

        if (!product) {
          throw new ApiError(
            404,
            `Product not found or inactive: ${item.product}`,
          );
        }

        if (!product.unit) {
          throw new ApiError(
            400,
            `The unit for product "${product.name}" is missing or inactive.`,
          );
        }

        // Calculate this item's amounts.
        const itemSubtotal = roundMoney(item.quantity * item.unitPrice);

        const itemDiscount = roundMoney(item.discountAmount ?? 0);

        if (itemDiscount > itemSubtotal) {
          throw new ApiError(
            400,
            `Discount cannot exceed the item amount for "${product.name}".`,
          );
        }

        const itemTaxableAmount = roundMoney(itemSubtotal - itemDiscount);

        const gstRate = item.gstRate ?? product.gstRate;

        const itemTaxAmount = roundMoney((itemTaxableAmount * gstRate) / 100);

        const itemTotal = roundMoney(itemTaxableAmount + itemTaxAmount);

        // Save product and unit snapshots.
        purchaseItems.push({
          product: product._id,
          productName: product.name,
          sku: product.sku,
          unit: product.unit._id,
          unitName: product.unit.name,
          unitSymbol: product.unit.symbol,

          quantity: item.quantity,
          unitPrice: item.unitPrice,
          discountAmount: itemDiscount,
          gstRate,

          taxableAmount: itemTaxableAmount,
          taxAmount: itemTaxAmount,
          totalAmount: itemTotal,
        });

        // Accumulate purchase totals.
        subtotal += itemSubtotal;
        discountTotal += itemDiscount;
        taxableAmount += itemTaxableAmount;
        taxTotal += itemTaxAmount;
        grandTotal += itemTotal;
      }

      // Round final totals.
      subtotal = roundMoney(subtotal);
      discountTotal = roundMoney(discountTotal);
      taxableAmount = roundMoney(taxableAmount);
      taxTotal = roundMoney(taxTotal);
      grandTotal = roundMoney(grandTotal);

      // 3. Generate purchase number.
      const purchaseNumber = await generatePurchaseNumber(session);

      // 4. Create the purchase document.
      const [purchase] = await Purchase.create(
        [
          {
            purchaseNumber,

            supplier: supplier._id,
            supplierName: supplier.name,
            supplierGSTIN: supplier.gstin,

            supplierInvoiceNumber,
            purchaseDate: purchaseDate ? new Date(purchaseDate) : new Date(),

            items: purchaseItems,

            subtotal,
            discountTotal,
            taxableAmount,
            taxTotal,
            grandTotal,

            notes,
            status: "draft",
            createdBy,
          },
        ],
        { session },
      );

      result = purchase;
    });

    return result;
  } catch (error) {
    // Handle duplicate purchase numbers.
    if (error.code === 11000 && error.keyPattern?.purchaseNumber) {
      throw new ApiError(409, "Purchase number already exists. Please retry.");
    }

    throw error;
  } finally {
    await session.endSession();
  }
};

// Receive a draft purchase and update stock and supplier balance.
const receivePurchase = async ({ purchaseId, performedBy }) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // 1. Find the purchase.
      const purchase = await Purchase.findById(purchaseId).session(session);

      if (!purchase) {
        throw new ApiError(404, "Purchase not found.");
      }

      // 2. Only draft purchases can be received.
      if (purchase.status !== "draft") {
        throw new ApiError(
          400,
          `Only draft purchases can be received. Current status: ${purchase.status}.`,
        );
      }

      // 3. Verify the supplier.
      const supplier = await Party.findOne({
        _id: purchase.supplier,
        isActive: true,
        type: { $in: ["supplier", "both"] },
      }).session(session);

      if (!supplier) {
        throw new ApiError(
          404,
          "Supplier not found, inactive, or not registered as a supplier.",
        );
      }

      // 4. Create stock movements for every purchase item.
      for (const item of purchase.items) {
        await createStockMovement({
          productId: item.product,
          type: "purchase",
          quantity: item.quantity,
          unitCost: item.unitPrice,
          note: `Purchase received: ${purchase.purchaseNumber}`,
          performedBy,
          referenceId: purchase._id,
          session,
        });
      }

      // 5. Record the actual purchase receiving time.
      const receivedAt = new Date();

      // 6. Increase the supplier's payable balance.
      const purchaseAmount = roundMoney(purchase.grandTotal);

      if (purchaseAmount > 0) {
        supplier.payableBalance = roundMoney(
          supplier.payableBalance + purchaseAmount,
        );

        await supplier.save({ session });

        // 7. Create the supplier ledger entry.
        await PartyLedger.create(
          [
            {
              party: supplier._id,
              transactionType: "purchase",
              balanceType: "payable",
              direction: "increase",
              amount: purchaseAmount,
              referenceType: "purchase",
              referenceId: purchase._id,
              note: `Purchase ${purchase.purchaseNumber} received.`,
              transactionDate: receivedAt,
              performedBy,
            },
          ],
          { session },
        );
      }

      // 8. Change purchase status only if it is still a draft.
      const receivedPurchase = await Purchase.findOneAndUpdate(
        {
          _id: purchase._id,
          status: "draft",
        },
        {
          $set: {
            status: "received",
            receivedAt,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!receivedPurchase) {
        throw new ApiError(
          409,
          "Purchase could not be received. Its status may have changed.",
        );
      }

      result = receivedPurchase;
    });

    return result;
  } finally {
    await session.endSession();
  }
};

// Cancel a draft or received purchase.
const cancelPurchase = async ({ purchaseId, reason = "", performedBy }) => {
  const session = await mongoose.startSession();

  try {
    let result;

    await session.withTransaction(async () => {
      // 1. Find the purchase.
      const purchase = await Purchase.findById(purchaseId).session(session);

      if (!purchase) {
        throw new ApiError(404, "Purchase not found.");
      }

      // 2. Prevent duplicate cancellation.
      if (purchase.status === "cancelled") {
        throw new ApiError(400, "Purchase is already cancelled.");
      }

      if (!["draft", "received"].includes(purchase.status)) {
        throw new ApiError(400, "This purchase cannot be cancelled.");
      }

      // 3. Record the actual cancellation time.
      const cancelledAt = new Date();

      // 4. Reverse stock and supplier balance only for received purchases.
      if (purchase.status === "received") {
        const supplier = await Party.findById(purchase.supplier).session(
          session,
        );

        if (!supplier) {
          throw new ApiError(404, "Purchase supplier not found.");
        }

        const purchaseAmount = roundMoney(purchase.grandTotal);

        // Check for payable-decreasing supplier transactions after receipt.
        const subsequentPayment = await PartyLedger.findOne({
          party: supplier._id,
          transactionType: { $in: ["payment", "adjustment"] },
          balanceType: "payable",
          direction: "decrease",
          createdAt: { $gte: purchase.receivedAt },
        }).session(session);

        if (subsequentPayment) {
          throw new ApiError(
            409,
            "Purchase cannot be cancelled because the supplier has subsequent payment or adjustment transactions. Review the supplier ledger first.",
          );
        }

        // Prevent the supplier payable balance from becoming negative.
        if (supplier.payableBalance < purchaseAmount) {
          throw new ApiError(
            409,
            "Purchase cannot be cancelled because the supplier payable balance is insufficient. Review supplier payments or adjustments first.",
          );
        }

        // Reverse each item's stock movement.
        for (const item of purchase.items) {
          await createStockMovement({
            productId: item.product,
            type: "purchase_cancel",
            quantity: item.quantity,
            note: `Purchase cancelled: ${purchase.purchaseNumber}`,
            performedBy,
            referenceId: purchase._id,
            session,
          });
        }

        // Reduce the supplier's payable balance.
        if (purchaseAmount > 0) {
          supplier.payableBalance = roundMoney(
            supplier.payableBalance - purchaseAmount,
          );

          await supplier.save({ session });

          // Record the reversing ledger entry.
          await PartyLedger.create(
            [
              {
                party: supplier._id,
                transactionType: "purchase_cancel",
                balanceType: "payable",
                direction: "decrease",
                amount: purchaseAmount,
                referenceType: "purchase_cancel",
                referenceId: purchase._id,
                note: `Purchase ${purchase.purchaseNumber} cancelled.`,
                transactionDate: cancelledAt,
                performedBy,
              },
            ],
            { session },
          );
        }
      }

      // 5. Update purchase status with a conditional update.
      const cancelledPurchase = await Purchase.findOneAndUpdate(
        {
          _id: purchase._id,
          status: purchase.status,
        },
        {
          $set: {
            status: "cancelled",
            cancelledAt,
            cancelledReason: reason,
          },
        },
        {
          returnDocument: "after",
          runValidators: true,
          session,
        },
      );

      if (!cancelledPurchase) {
        throw new ApiError(
          409,
          "Purchase could not be cancelled. Its status may have changed.",
        );
      }

      result = cancelledPurchase;
    });

    return result;
  } finally {
    await session.endSession();
  }
};

// Get purchases with filters and pagination.
const getPurchases = async ({
  page = 1,
  limit = 20,
  supplier,
  status,
  search,
  startDate,
  endDate,
}) => {
  // Build the MongoDB filter.
  const filter = {};

  if (supplier) {
    filter.supplier = supplier;
  }

  if (status) {
    filter.status = status;
  }

  // Search by purchase number or supplier invoice number.
  if (search) {
    const searchRegex = new RegExp(
      search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
      "i",
    );

    filter.$or = [
      { purchaseNumber: searchRegex },
      { supplierInvoiceNumber: searchRegex },
      { supplierName: searchRegex },
    ];
  }

  // Filter by purchase date.
  if (startDate || endDate) {
    filter.purchaseDate = {};

    if (startDate) {
      filter.purchaseDate.$gte = new Date(`${startDate}T00:00:00.000Z`);
    }

    if (endDate) {
      filter.purchaseDate.$lte = new Date(`${endDate}T23:59:59.999Z`);
    }
  }

  // Calculate how many documents to skip.
  const skip = (page - 1) * limit;

  // Fetch purchases and total count.
  const [purchases, total] = await Promise.all([
    Purchase.find(filter)
      .populate("supplier", "name phone email gstin")
      .sort({ purchaseDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),

    Purchase.countDocuments(filter),
  ]);

  return {
    purchases,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1,
    },
  };
};

// Get a single purchase by ID.
const getPurchaseById = async (purchaseId) => {
  const purchase = await Purchase.findById(purchaseId)
    .populate("supplier", "name phone email gstin address city state pincode")
    .populate("createdBy", "name email")
    .populate("items.product", "name sku")
    .populate("items.unit", "name symbol")
    .lean();

  if (!purchase) {
    throw new ApiError(404, "Purchase not found.");
  }

  return purchase;
};

module.exports = {
  createPurchase,
  receivePurchase,
  cancelPurchase,
  getPurchases,
  getPurchaseById,
};
