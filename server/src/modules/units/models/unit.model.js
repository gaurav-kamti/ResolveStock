const mongoose = require("mongoose");

const unitSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Unit name is required"],
      trim: true,
      minlength: [2, "Unit name must contain at least 2 characters"],
      maxlength: [50, "Unit name cannot exceed 50 characters"],
    },

    symbol: {
      type: String,
      required: [true, "Unit symbol is required"],
      trim: true,
      minlength: [1, "Unit symbol is required"],
      maxlength: [10, "Unit symbol cannot exceed 10 characters"],
    },

    normalizedName: {
      type: String,
      required: true,
    },

    normalizedSymbol: {
      type: String,
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  },
);

// Normalize name and symbol before validation
unitSchema.pre("validate", function () {
  if (this.name) {
    this.normalizedName = this.name.trim().toLowerCase();
  }

  if (this.symbol) {
    this.normalizedSymbol = this.symbol.trim().toLowerCase();
  }
});

// Prevent duplicate unit names
unitSchema.index(
  { normalizedName: 1 },
  {
    unique: true,
    name: "unique_unit_name",
  },
);

// Prevent duplicate unit symbols
unitSchema.index(
  { normalizedSymbol: 1 },
  {
    unique: true,
    name: "unique_unit_symbol",
  },
);

const Unit = mongoose.model("Unit", unitSchema);

module.exports = Unit;
