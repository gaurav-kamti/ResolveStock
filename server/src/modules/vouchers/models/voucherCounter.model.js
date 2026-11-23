const mongoose = require("mongoose");

const voucherCounterSchema = new mongoose.Schema(
  {
    voucherType: {
      type: String,
      required: true,
      enum: ["payment", "receipt"],
      unique: true,
    },

    sequence: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    timestamps: true,
  },
);

const VoucherCounter = mongoose.model("VoucherCounter", voucherCounterSchema);

module.exports = VoucherCounter;
