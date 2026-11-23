const mongoose = require("mongoose");

// Individual bill allocation inside a voucher.
const voucherAllocationSchema = new mongoose.Schema(
  {
    documentType: {
      type: String,
      required: true,
      enum: ["purchase", "sales"],
    },

    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    documentNumber: {
      type: String,
      required: true,
      trim: true,
    },

    documentDate: {
      type: Date,
      required: true,
    },

    documentTotal: {
      type: Number,
      required: true,
      min: 0,
    },

    allocatedAmount: {
      type: Number,
      required: true,
      min: [0.01, "Allocated amount must be greater than zero"],
    },
  },
  {
    _id: true,
  },
);

// Records changes made when applying advances or adjusting allocations.
const allocationHistorySchema = new mongoose.Schema(
  {
    action: {
      type: String,
      required: true,
      enum: ["allocated", "reversed"],
    },

    documentType: {
      type: String,
      required: true,
      enum: ["purchase", "sales"],
    },

    documentId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },

    documentNumber: {
      type: String,
      required: true,
      trim: true,
    },

    amount: {
      type: Number,
      required: true,
      min: [0.01, "Amount must be greater than zero"],
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    performedAt: {
      type: Date,
      default: Date.now,
    },

    note: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },
  },
  {
    _id: true,
  },
);

// Main voucher document.
const voucherSchema = new mongoose.Schema(
  {
    voucherNumber: {
      type: String,
      required: [true, "Voucher number is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },

    voucherType: {
      type: String,
      required: [true, "Voucher type is required"],
      enum: {
        values: ["payment", "receipt"],
        message: "Voucher type must be payment or receipt",
      },
    },

    party: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
      required: [true, "Party is required"],
      index: true,
    },

    // Party details saved as snapshots.
    partyName: {
      type: String,
      required: [true, "Party name is required"],
      trim: true,
    },

    partyPhone: {
      type: String,
      trim: true,
      default: "",
    },

    partyGSTIN: {
      type: String,
      trim: true,
      default: "",
    },

    partyAddress: {
      type: String,
      trim: true,
      default: "",
    },

    voucherDate: {
      type: Date,
      required: [true, "Voucher date is required"],
      default: Date.now,
    },

    amount: {
      type: Number,
      required: [true, "Voucher amount is required"],
      min: [0.01, "Voucher amount must be greater than zero"],
    },

    paymentMethod: {
      type: String,
      required: [true, "Payment method is required"],
      enum: {
        values: ["cash", "bank_transfer", "upi", "cheque", "other"],
        message: "Invalid payment method",
      },
    },

    // How the voucher amount is allocated.
    allocationMode: {
      type: String,
      required: [true, "Allocation mode is required"],
      enum: {
        values: ["against_bill", "on_account", "advance"],
        message: "Invalid allocation mode",
      },
    },

    // Supports allocation against multiple purchase or sales documents.
    allocations: {
      type: [voucherAllocationSchema],
      default: [],
    },

    // Amount not currently allocated to any bill.
    // This amount can remain as advance credit.
    unallocatedAmount: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Unallocated amount cannot be negative"],
    },

    // History of subsequent advance applications and allocation reversals.
    allocationHistory: {
      type: [allocationHistorySchema],
      default: [],
    },

    // Payment instrument and transaction information.
    referenceNumber: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    bankName: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    chequeNumber: {
      type: String,
      trim: true,
      default: "",
      maxlength: 100,
    },

    chequeDate: {
      type: Date,
      default: null,
    },

    notes: {
      type: String,
      trim: true,
      default: "",
      maxlength: [1000, "Notes cannot exceed 1000 characters"],
    },

    status: {
      type: String,
      enum: {
        values: ["posted", "cancelled"],
        message: "Invalid voucher status",
      },
      default: "posted",
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancellationReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: 500,
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
    },

    cancelledBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

// Validate allocation totals and prevent duplicate bill allocations.
voucherSchema.pre("validate", function () {
  const allocatedAmount = this.allocations.reduce(
    (total, allocation) => total + allocation.allocatedAmount,
    0,
  );

  const total = Math.round((allocatedAmount + this.unallocatedAmount) * 100);

  const voucherTotal = Math.round(this.amount * 100);

  if (total !== voucherTotal) {
    this.invalidate(
      "unallocatedAmount",
      "Allocated amount plus unallocated amount must equal voucher amount",
    );
  }

  if (this.allocationMode === "against_bill" && this.allocations.length === 0) {
    this.invalidate(
      "allocations",
      "Against Bill vouchers must contain at least one bill allocation",
    );
  }

  if (this.allocationMode === "against_bill" && this.unallocatedAmount > 0) {
    this.invalidate(
      "unallocatedAmount",
      "Against Bill vouchers cannot have an unallocated amount",
    );
  }

  const documentIds = this.allocations.map(
    (allocation) => `${allocation.documentType}:${allocation.documentId}`,
  );

  if (new Set(documentIds).size !== documentIds.length) {
    this.invalidate(
      "allocations",
      "A bill cannot be allocated more than once in the same voucher",
    );
  }
});

// Indexes for common voucher queries.
voucherSchema.index({
  voucherType: 1,
  voucherDate: -1,
});

voucherSchema.index({
  party: 1,
  voucherDate: -1,
});

voucherSchema.index({
  status: 1,
  voucherDate: -1,
});

const Voucher = mongoose.model("Voucher", voucherSchema);

module.exports = Voucher;
