const mongoose = require("mongoose");

const stockMovementSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },

    type: {
      type: String,
      required: [true, "Movement type is required"],
      enum: [
        "opening",
        "purchase",
        "sale",
        "sales_return",
        "purchase_return",
        "adjustment_in",
        "adjustment_out",
      ],
    },

    direction: {
      type: String,
      required: [true, "Movement direction is required"],
      enum: ["in", "out"],
    },

    quantity: {
      type: Number,
      required: [true, "Movement quantity is required"],
      min: [0.000001, "Quantity must be greater than zero"],
    },

    unitCost: {
      type: Number,
      default: 0,
      min: [0, "Unit cost cannot be negative"],
    },

    referenceType: {
      type: String,
      enum: [
        "opening",
        "purchase",
        "sale",
        "sales_return",
        "purchase_return",
        "adjustment",
      ],
    },

    referenceId: {
      type: mongoose.Schema.Types.ObjectId,
    },

    note: {
      type: String,
      trim: true,
      maxlength: [500, "Note cannot exceed 500 characters"],
      default: "",
    },

    performedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  },
);

// Useful for retrieving a product's movement history.
stockMovementSchema.index({ product: 1, createdAt: -1 });

// Useful for filtering movements by type.
stockMovementSchema.index({ type: 1, createdAt: -1 });

// Useful for finding movements linked to a transaction.
stockMovementSchema.index({ referenceType: 1, referenceId: 1 });

// A product can have only one opening stock movement.
stockMovementSchema.index(
  { product: 1 },
  {
    unique: true,
    partialFilterExpression: {
      type: "opening",
    },
  },
);

const StockMovement = mongoose.model("StockMovement", stockMovementSchema);

module.exports = StockMovement;
