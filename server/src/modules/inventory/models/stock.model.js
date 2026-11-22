const mongoose = require("mongoose");

const stockSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: [true, "Product is required"],
    },

    quantity: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Stock quantity cannot be negative"],
    },

    averageCost: {
      type: Number,
      required: true,
      default: 0,
      min: [0, "Average cost cannot be negative"],
    },
  },
  {
    timestamps: true,
  },
);

// Each product must have only one stock balance.
stockSchema.index({ product: 1 }, { unique: true });

const Stock = mongoose.model("Stock", stockSchema);

module.exports = Stock;
