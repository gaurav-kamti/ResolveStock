const mongoose = require("mongoose");

const Party = require("../parties/models/party.model");
const PartyLedger = require("../parties/models/partyLedger.model");
const Purchase = require("../purchases/models/purchase.model");

const Voucher = require("./models/voucher.model");
const VoucherCounter = require("./models/voucherCounter.model");

const ApiError = require("../../utils/ApiError");

// Round currency values to two decimal places.
const roundMoney = (amount) => {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
};

// Generate the next payment or receipt voucher number.
const generateVoucherNumber = async (voucherType, session) => {
  const counter = await VoucherCounter.findOneAndUpdate(
    { voucherType },
    { $inc: { sequence: 1 } },
    {
      returnDocument: "after",
      upsert: true,
      setDefaultsOnInsert: true,
      session,
    },
  );

  const prefix = voucherType === "payment" ? "PV" : "RV";

  return `${prefix}-${String(counter.sequence).padStart(6, "0")}`;
};

// Verify that the party exists, is active and has the correct type.
const getEligibleParty = async (partyId, voucherType, session) => {
  const requiredPartyType = voucherType === "payment" ? "supplier" : "customer";

  const party = await Party.findOne({
    _id: partyId,
    isActive: true,
    type: { $in: [requiredPartyType, "both"] },
  }).session(session);

  if (!party) {
    throw new ApiError(
      404,
      `${requiredPartyType === "supplier" ? "Supplier" : "Customer"} not found, inactive, or not registered as the correct party type.`,
    );
  }

  return party;
};

// Get the total amount already allocated to each purchase bill.
const getPurchaseAllocatedAmounts = async (supplierId, session) => {
  const allocations = await Voucher.aggregate([
    {
      $match: {
        voucherType: "payment",
        party: new mongoose.Types.ObjectId(supplierId),
        status: "posted",
      },
    },
    {
      $unwind: "$allocations",
    },
    {
      $match: {
        "allocations.documentType": "purchase",
      },
    },
    {
      $group: {
        _id: "$allocations.documentId",
        allocatedAmount: {
          $sum: "$allocations.allocatedAmount",
        },
      },
    },
  ]).session(session);

  const allocatedAmounts = new Map();

  for (const allocation of allocations) {
    allocatedAmounts.set(
      allocation._id.toString(),
      roundMoney(allocation.allocatedAmount),
    );
  }

  return allocatedAmounts;
};

// Get outstanding received purchase bills, oldest first.

const getOutstandingPurchaseBills = async (supplierId, session) => {
  const purchases = await Purchase.find({
    supplier: supplierId,
    status: "received",
  })
    .sort({
      purchaseDate: 1,
      createdAt: 1,
      _id: 1,
    })
    .session(session)
    .lean();

  const allocatedAmounts = await getPurchaseAllocatedAmounts(
    supplierId,
    session,
  );

  const outstandingBills = [];

  for (const purchase of purchases) {
    const alreadyAllocated = allocatedAmounts.get(purchase._id.toString()) ?? 0;

    const outstandingAmount = roundMoney(
      purchase.grandTotal - alreadyAllocated,
    );

    if (outstandingAmount < 0) {
      throw new ApiError(
        409,
        `Purchase ${purchase.purchaseNumber} has allocations exceeding its total amount.`,
      );
    }

    if (outstandingAmount > 0) {
      outstandingBills.push({
        documentType: "purchase",
        documentId: purchase._id,
        documentNumber: purchase.purchaseNumber,
        documentDate: purchase.purchaseDate,
        documentTotal: purchase.grandTotal,
        alreadyAllocated,
        outstandingAmount,
      });
    }
  }

  return outstandingBills;
};

// Create a Payment Voucher.
const createPaymentVoucher = async ({
  partyId,
  voucherDate,
  amount,
  paymentMethod,
  allocationMode,
  allocations = [],
  referenceNumber,
  bankName,
  chequeNumber,
  chequeDate,
  notes,
  createdBy,
}) => {
  const session = await mongoose.startSession();

  let createdVoucher;

  try {
    await session.withTransaction(async () => {
      // Basic input checks.
      const paymentAmount = roundMoney(Number(amount));

      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        throw new ApiError(400, "Payment amount must be greater than zero.");
      }

      if (!["against_bill", "on_account", "advance"].includes(allocationMode)) {
        throw new ApiError(400, "Invalid payment allocation mode.");
      }

      // Verify supplier.
      const supplier = await getEligibleParty(partyId, "payment", session);

      // Get all currently outstanding purchase bills.
      const outstandingBills = await getOutstandingPurchaseBills(
        supplier._id,
        session,
      );

      const outstandingMap = new Map(
        outstandingBills.map((bill) => [bill.documentId.toString(), bill]),
      );

      let voucherAllocations = [];
      let unallocatedAmount = 0;

      // MODE 1: Against Bill.
      if (allocationMode === "against_bill") {
        if (!Array.isArray(allocations) || allocations.length === 0) {
          throw new ApiError(
            400,
            "At least one purchase bill allocation is required.",
          );
        }

        const seenDocuments = new Set();
        let allocationTotal = 0;

        for (const item of allocations) {
          if (item.documentType !== "purchase") {
            throw new ApiError(
              400,
              "Payment Vouchers can only be allocated to purchase bills.",
            );
          }

          const documentId = item.documentId?.toString();

          if (!documentId || seenDocuments.has(documentId)) {
            throw new ApiError(
              400,
              "Invalid or duplicate purchase bill allocation.",
            );
          }

          seenDocuments.add(documentId);

          const bill = outstandingMap.get(documentId);

          if (!bill) {
            throw new ApiError(
              400,
              "One or more purchase bills do not belong to this supplier, are not received, or have no outstanding balance.",
            );
          }

          const allocatedAmount = roundMoney(Number(item.allocatedAmount));

          if (!Number.isFinite(allocatedAmount) || allocatedAmount <= 0) {
            throw new ApiError(
              400,
              "Each bill allocation must be greater than zero.",
            );
          }

          if (allocatedAmount > bill.outstandingAmount) {
            throw new ApiError(
              400,
              `Allocation exceeds the outstanding amount of ${bill.documentNumber}. Outstanding: ${bill.outstandingAmount}.`,
            );
          }

          allocationTotal = roundMoney(allocationTotal + allocatedAmount);

          voucherAllocations.push({
            documentType: "purchase",
            documentId: bill.documentId,
            documentNumber: bill.documentNumber,
            documentDate: bill.documentDate,
            documentTotal: bill.documentTotal,
            allocatedAmount,
          });
        }

        if (allocationTotal !== paymentAmount) {
          throw new ApiError(
            400,
            "Total bill allocations must equal the payment amount.",
          );
        }

        unallocatedAmount = 0;
      }

      // MODE 2: On Account.
      // Automatically allocate against oldest outstanding bills first.
      else if (allocationMode === "on_account") {
        let remainingAmount = paymentAmount;

        for (const bill of outstandingBills) {
          if (remainingAmount <= 0) {
            break;
          }

          const allocatedAmount = roundMoney(
            Math.min(remainingAmount, bill.outstandingAmount),
          );

          if (allocatedAmount <= 0) {
            continue;
          }

          voucherAllocations.push({
            documentType: "purchase",
            documentId: bill.documentId,
            documentNumber: bill.documentNumber,
            documentDate: bill.documentDate,
            documentTotal: bill.documentTotal,
            allocatedAmount,
          });

          remainingAmount = roundMoney(remainingAmount - allocatedAmount);
        }

        // Any excess payment becomes supplier advance.
        unallocatedAmount = remainingAmount;
      }

      // MODE 3: Advance.
      // Keep the entire payment unallocated.
      else if (allocationMode === "advance") {
        voucherAllocations = [];
        unallocatedAmount = paymentAmount;
      }

      const totalAllocated = roundMoney(
        voucherAllocations.reduce(
          (total, item) => total + item.allocatedAmount,
          0,
        ),
      );

      // Ensure the supplier's payable balance can cover the
      // amount being applied against purchase bills.
      if (totalAllocated > 0) {
        const updatedSupplier = await Party.findOneAndUpdate(
          {
            _id: supplier._id,
            payableBalance: { $gte: totalAllocated },
          },
          {
            $inc: {
              payableBalance: -totalAllocated,
              receivableBalance: unallocatedAmount,
            },
          },
          {
            session,
            returnDocument: "after",
          },
        );

        if (!updatedSupplier) {
          throw new ApiError(
            409,
            "Supplier payable balance is insufficient or has changed. Refresh the supplier balance and try again.",
          );
        }
      } else if (unallocatedAmount > 0) {
        await Party.updateOne(
          { _id: supplier._id },
          {
            $inc: {
              receivableBalance: unallocatedAmount,
            },
          },
          { session },
        );
      }

      // Generate voucher number.
      const voucherNumber = await generateVoucherNumber("payment", session);

      const transactionDate = voucherDate ? new Date(voucherDate) : new Date();

      // Create allocation history for initial bill allocations.
      const allocationHistory = voucherAllocations.map((item) => ({
        action: "allocated",
        documentType: item.documentType,
        documentId: item.documentId,
        documentNumber: item.documentNumber,
        amount: item.allocatedAmount,
        performedBy: createdBy,
        performedAt: new Date(),
        note: "Initial payment allocation",
      }));

      // Save the voucher.
      const [voucher] = await Voucher.create(
        [
          {
            voucherNumber,
            voucherType: "payment",

            party: supplier._id,
            partyName: supplier.name,
            partyPhone: supplier.phone || "",
            partyGSTIN: supplier.gstin || "",
            partyAddress: supplier.address || "",

            voucherDate: transactionDate,
            amount: paymentAmount,
            paymentMethod,
            allocationMode,

            allocations: voucherAllocations,
            unallocatedAmount,
            allocationHistory,

            referenceNumber,
            bankName,
            chequeNumber,
            chequeDate,
            notes,

            status: "posted",
            createdBy,
          },
        ],
        { session },
      );

      // Record the payable reduction in the Party Ledger.
      if (totalAllocated > 0) {
        await PartyLedger.create(
          [
            {
              party: supplier._id,
              transactionType: "payment",
              balanceType: "payable",
              direction: "decrease",
              amount: totalAllocated,
              referenceType: "payment_voucher",
              referenceId: voucher._id,
              note: `Payment Voucher ${voucherNumber} allocated against purchase bills.`,
              transactionDate,
              performedBy: createdBy,
            },
          ],
          { session },
        );
      }

      // Record excess payment as supplier advance.
      if (unallocatedAmount > 0) {
        await PartyLedger.create(
          [
            {
              party: supplier._id,
              transactionType: "payment",
              balanceType: "receivable",
              direction: "increase",
              amount: unallocatedAmount,
              referenceType: "payment_voucher",
              referenceId: voucher._id,
              note: `Supplier advance recorded through Payment Voucher ${voucherNumber}.`,
              transactionDate,
              performedBy: createdBy,
            },
          ],
          { session },
        );
      }

      createdVoucher = voucher;
    });

    return createdVoucher;
  } finally {
    await session.endSession();
  }
};

// Get vouchers with pagination, filters and search.
const getVouchers = async ({
  page = 1,
  limit = 20,
  voucherType,
  party,
  status,
  search,
  startDate,
  endDate,
} = {}) => {
  const currentPage = Number(page);
  const pageLimit = Number(limit);

  const filter = {};

  // Filter by voucher type.
  if (voucherType) {
    filter.voucherType = voucherType;
  }

  // Filter by party.
  if (party) {
    filter.party = party;
  }

  // Filter by voucher status.
  if (status) {
    filter.status = status;
  }

  // Filter by voucher date range.
  if (startDate || endDate) {
    filter.voucherDate = {};

    if (startDate) {
      filter.voucherDate.$gte = new Date(startDate);
    }

    if (endDate) {
      const end = new Date(endDate);

      // Include the entire day when an ISO date is provided.
      if (typeof endDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(endDate)) {
        end.setUTCHours(23, 59, 59, 999);
      }

      filter.voucherDate.$lte = end;
    }
  }

  // Search by voucher number, party name or reference number.
  if (search) {
    const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const searchRegex = new RegExp(escapedSearch, "i");

    filter.$or = [
      { voucherNumber: searchRegex },
      { partyName: searchRegex },
      { referenceNumber: searchRegex },
    ];
  }

  const skip = (currentPage - 1) * pageLimit;

  const [vouchers, total] = await Promise.all([
    Voucher.find(filter)
      .sort({
        voucherDate: -1,
        createdAt: -1,
        _id: -1,
      })
      .skip(skip)
      .limit(pageLimit)
      .lean(),

    Voucher.countDocuments(filter),
  ]);

  const totalPages = Math.ceil(total / pageLimit);

  return {
    vouchers,
    pagination: {
      total,
      page: currentPage,
      limit: pageLimit,
      totalPages,
      hasNextPage: currentPage < totalPages,
      hasPrevPage: currentPage > 1,
    },
  };
};

// Get a single voucher by ID.
const getVoucherById = async (voucherId) => {
  const voucher = await Voucher.findById(voucherId).lean();

  if (!voucher) {
    throw new ApiError(404, "Voucher not found.");
  }

  return voucher;
};

/**
 * Cancel a posted Payment Voucher.
 * Reverses supplier balances and records ledger entries.
 */
const cancelPaymentVoucher = async ({ voucherId, reason, cancelledBy }) => {
  const session = await mongoose.startSession();

  let cancelledVoucher;

  try {
    await session.withTransaction(async () => {
      // Find the voucher.
      const voucher = await Voucher.findById(voucherId).session(session);

      if (!voucher) {
        throw new ApiError(404, "Voucher not found.");
      }

      // This service currently supports payment cancellation only.
      if (voucher.voucherType !== "payment") {
        throw new ApiError(
          400,
          "Only Payment Vouchers can be cancelled through this operation.",
        );
      }

      // Prevent duplicate cancellation.
      if (voucher.status === "cancelled") {
        throw new ApiError(409, "Voucher is already cancelled.");
      }

      if (voucher.status !== "posted") {
        throw new ApiError(409, "Only posted vouchers can be cancelled.");
      }

      // Calculate the total amount allocated against purchase bills.
      const totalAllocated = roundMoney(
        voucher.allocations.reduce(
          (total, item) => total + item.allocatedAmount,
          0,
        ),
      );

      const advanceAmount = roundMoney(voucher.unallocatedAmount);

      // Restore payable balance and reverse supplier advance.
      const updatedSupplier = await Party.findOneAndUpdate(
        {
          _id: voucher.party,
          receivableBalance: { $gte: advanceAmount },
        },
        {
          $inc: {
            payableBalance: totalAllocated,
            receivableBalance: -advanceAmount,
          },
        },
        {
          session,
          returnDocument: "after",
        },
      );

      if (!updatedSupplier) {
        throw new ApiError(
          409,
          "Supplier advance balance is insufficient or the supplier no longer exists. Cancellation could not be completed.",
        );
      }

      const cancellationDate = new Date();

      // Reverse the payable reduction from the original payment.
      if (totalAllocated > 0) {
        await PartyLedger.create(
          [
            {
              party: voucher.party,
              transactionType: "payment",
              balanceType: "payable",
              direction: "increase",
              amount: totalAllocated,
              referenceType: "payment_voucher",
              referenceId: voucher._id,
              note: `Reversal of Payment Voucher ${voucher.voucherNumber}. Reason: ${reason}`,
              transactionDate: cancellationDate,
              performedBy: cancelledBy,
            },
          ],
          { session },
        );
      }

      // Reverse the supplier advance.
      if (advanceAmount > 0) {
        await PartyLedger.create(
          [
            {
              party: voucher.party,
              transactionType: "payment",
              balanceType: "receivable",
              direction: "decrease",
              amount: advanceAmount,
              referenceType: "payment_voucher",
              referenceId: voucher._id,
              note: `Reversal of supplier advance from Payment Voucher ${voucher.voucherNumber}. Reason: ${reason}`,
              transactionDate: cancellationDate,
              performedBy: cancelledBy,
            },
          ],
          { session },
        );
      }

      // Mark the original voucher as cancelled.
      voucher.status = "cancelled";
      voucher.cancelledAt = cancellationDate;
      voucher.cancellationReason = reason;
      voucher.cancelledBy = cancelledBy;

      await voucher.save({ session });

      cancelledVoucher = voucher;
    });

    return cancelledVoucher;
  } finally {
    await session.endSession();
  }
};

module.exports = {
  generateVoucherNumber,
  getEligibleParty,
  getPurchaseAllocatedAmounts,
  getOutstandingPurchaseBills,
  createPaymentVoucher,
  getVouchers,
  getVoucherById,
  cancelPaymentVoucher,
};
