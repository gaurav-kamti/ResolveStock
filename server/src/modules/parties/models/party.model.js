const mongoose = require("mongoose");

const partySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Party name is required"],
      trim: true,
      minlength: [2, "Party name must contain at least 2 characters"],
      maxlength: [100, "Party name cannot exceed 100 characters"],
    },

    type: {
      type: String,
      required: [true, "Party type is required"],
      enum: {
        values: ["customer", "supplier", "both"],
        message: "Party type must be customer, supplier, or both",
      },
    },

    phone: {
      type: String,
      trim: true,
      default: "",
      maxlength: [20, "Phone number cannot exceed 20 characters"],
    },

    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: "",
      maxlength: [100, "Email cannot exceed 100 characters"],
    },

    gstin: {
      type: String,
      trim: true,
      uppercase: true,
      default: "",
      maxlength: [15, "GSTIN cannot exceed 15 characters"],
    },

    address: {
      type: String,
      trim: true,
      default: "",
      maxlength: [300, "Address cannot exceed 300 characters"],
    },

    city: {
      type: String,
      trim: true,
      default: "",
      maxlength: [100, "City cannot exceed 100 characters"],
    },

    state: {
      type: String,
      trim: true,
      default: "",
      maxlength: [100, "State cannot exceed 100 characters"],
    },

    pincode: {
      type: String,
      trim: true,
      default: "",
      maxlength: [10, "Pincode cannot exceed 10 characters"],
    },

    openingBalance: {
      type: Number,
      default: 0,
      min: [0, "Opening balance cannot be negative"],
    },

    openingBalanceType: {
      type: String,
      enum: {
        values: ["receivable", "payable", "none"],
        message: "Invalid opening balance type",
      },
      default: "none",
    },

    receivableBalance: {
      type: Number,
      default: 0,
      min: [0, "Receivable balance cannot be negative"],
    },

    payableBalance: {
      type: Number,
      default: 0,
      min: [0, "Payable balance cannot be negative"],
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

// Normalize name for consistent searching and duplicate detection
partySchema.pre("validate", function () {
  if (this.name) {
    this.name = this.name.trim();
  }
});

// Indexes for common queries
partySchema.index({ name: 1 });
partySchema.index({ type: 1 });
partySchema.index({ isActive: 1 });
partySchema.index({ phone: 1 });

const Party = mongoose.model("Party", partySchema);

module.exports = Party;
