const mongoose = require("mongoose");

// Individual product inside a purchase.
const purchaseItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },

    // Product details saved as snapshots.
    productName: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
    },

    sku: {
      type: String,
      required: [true, "Product SKU is required"],
      trim: true,
    },

    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: [true, "Product unit is required"],
    },

    unitName: {
      type: String,
      required: [true, "Unit name is required"],
      trim: true,
    },

    unitSymbol: {
      type: String,
      required: [true, "Unit symbol is required"],
      trim: true,
    },

    quantity: {
      type: Number,
      required: [true, "Quantity is required"],
      min: [0.000001, "Quantity must be greater than zero"],
    },

    unitPrice: {
      type: Number,
      required: [true, "Purchase price is required"],
      min: [0, "Purchase price cannot be negative"],
    },

    discountAmount: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },

    gstRate: {
      type: Number,
      default: 0,
      min: [0, "GST rate cannot be negative"],
      max: [100, "GST rate cannot exceed 100"],
    },

    taxableAmount: {
      type: Number,
      required: true,
      min: [0, "Taxable amount cannot be negative"],
    },

    taxAmount: {
      type: Number,
      required: true,
      min: [0, "Tax amount cannot be negative"],
    },

    totalAmount: {
      type: Number,
      required: true,
      min: [0, "Total amount cannot be negative"],
    },
  },
  {
    _id: true,
  },
);

// Main purchase document.
const purchaseSchema = new mongoose.Schema(
  {
    purchaseNumber: {
      type: String,
      required: [true, "Purchase number is required"],
      unique: true,
      trim: true,
      uppercase: true,
    },

    supplier: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Party",
      required: [true, "Supplier is required"],
    },

    // Supplier details saved as snapshots.
    supplierName: {
      type: String,
      required: [true, "Supplier name is required"],
      trim: true,
    },

    supplierGSTIN: {
      type: String,
      trim: true,
      default: "",
    },

    supplierInvoiceNumber: {
      type: String,
      trim: true,
      default: "",
    },

    purchaseDate: {
      type: Date,
      required: [true, "Purchase date is required"],
      default: Date.now,
    },

    items: {
      type: [purchaseItemSchema],
      required: true,
      validate: {
        validator: function (items) {
          return Array.isArray(items) && items.length > 0;
        },
        message: "A purchase must contain at least one product",
      },
    },

    subtotal: {
      type: Number,
      required: true,
      min: [0, "Subtotal cannot be negative"],
    },

    discountTotal: {
      type: Number,
      default: 0,
      min: [0, "Discount cannot be negative"],
    },

    taxableAmount: {
      type: Number,
      required: true,
      min: [0, "Taxable amount cannot be negative"],
    },

    taxTotal: {
      type: Number,
      default: 0,
      min: [0, "Tax cannot be negative"],
    },

    grandTotal: {
      type: Number,
      required: true,
      min: [0, "Grand total cannot be negative"],
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
        values: ["draft", "received", "cancelled"],
        message: "Invalid purchase status",
      },
      default: "draft",
    },

    receivedAt: {
      type: Date,
      default: null,
    },

    cancelledAt: {
      type: Date,
      default: null,
    },

    cancelledReason: {
      type: String,
      trim: true,
      default: "",
      maxlength: [500, "Cancellation reason cannot exceed 500 characters"],
    },

    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Creator is required"],
    },
  },
  {
    timestamps: true,
  },
);

// Indexes for common purchase queries.
purchaseSchema.index({ purchaseDate: -1 });
purchaseSchema.index({ supplier: 1, purchaseDate: -1 });
purchaseSchema.index({ status: 1, purchaseDate: -1 });
purchaseSchema.index({ supplierInvoiceNumber: 1 });

const Purchase = mongoose.model("Purchase", purchaseSchema);

module.exports = Purchase;
