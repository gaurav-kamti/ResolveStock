const mongoose = require("mongoose");

const partyLedgerSchema = new mongoose.Schema(
  {
    party: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
      required: [true, "Party is required"],
      index: true,
    },

    transactionType: {
      type: String,
      enum: [
        "opening_balance",
        "purchase",
        "purchase_return",
        "sale",
        "sales_return",
        "payment",
        "receipt",
        "adjustment",
      ],
      required: [true, "Transaction type is required"],
    },

    balanceType: {
      type: String,
      enum: ["receivable", "payable"],
      required: [true, "Balance type is required"],
    },

    direction: {
      type: String,
      enum: ["increase", "decrease"],
      required: [true, "Transaction direction is required"],
    },

    amount: {
      type: Number,
      required: [true, "Amount is required"],
      min: [0.01, "Amount must be greater than zero"],
    },

    referenceType: {
      type: String,
      enum: [
        "opening_balance",
        "purchase",
        "purchase_return",
        "sale",
        "sales_return",
        "payment_voucher",
        "receipt_voucher",
        "adjustment",
      ],
      default: null,
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
      default: null,
    },

    note: {
      type: String,
      trim: true,
      maxlength: [500, "Note cannot exceed 500 characters"],
      default: "",
    },

    transactionDate: {
      type: Date,
      required: [true, "Transaction date is required"],
      default: Date.now,
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "User is required"],
    },
  },
  {
    timestamps: true,
  },
);

// Efficient party ledger history queries.
partyLedgerSchema.index({
  party: 1,
  transactionDate: -1,
  createdAt: -1,
});

// Efficient reference lookups.
partyLedgerSchema.index({
  referenceType: 1,
  referenceId: 1,
});

const PartyLedger = mongoose.model("PartyLedger", partyLedgerSchema);

module.exports = PartyLedger;
