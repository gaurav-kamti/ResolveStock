const mongoose = require("mongoose");

const purchaseCounterSchema = new mongoose.Schema(
  {
    _id: {
      type: String,
      required: true,
    },

    sequence: {
      type: Number,
      required: true,
      default: 0,
      min: 0,
    },
  },
  {
    versionKey: false,
  },
);

const PurchaseCounter = mongoose.model(
  "PurchaseCounter",
  purchaseCounterSchema,
);

module.exports = PurchaseCounter;
