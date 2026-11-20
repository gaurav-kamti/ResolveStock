const mongoose = require("mongoose");

const productSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Product name is required"],
      trim: true,
      minlength: [2, "Product name must contain at least 2 characters"],
      maxlength: [150, "Product name cannot exceed 150 characters"],
    },

    sku: {
      type: String,
      required: [true, "Product SKU is required"],
      trim: true,
      uppercase: true,
      minlength: [2, "SKU must contain at least 2 characters"],
      maxlength: [50, "SKU cannot exceed 50 characters"],
    },

    description: {
      type: String,
      trim: true,
      default: "",
      maxlength: [500, "Description cannot exceed 500 characters"],
    },

    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "Product category is required"],
    },

    unit: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Unit",
      required: [true, "Product unit is required"],
    },

    purchasePrice: {
      type: Number,
      required: [true, "Purchase price is required"],
      min: [0, "Purchase price cannot be negative"],
    },

    sellingPrice: {
      type: Number,
      required: [true, "Selling price is required"],
      min: [0, "Selling price cannot be negative"],
    },

    gstRate: {
      type: Number,
      default: 0,
      min: [0, "GST rate cannot be negative"],
      max: [100, "GST rate cannot exceed 100"],
    },

    minimumStockLevel: {
      type: Number,
      default: 0,
      min: [0, "Minimum stock level cannot be negative"],
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

// Normalize SKU before validation and saving
productSchema.pre("validate", function () {
  if (this.sku) {
    this.sku = this.sku.trim().toUpperCase();
  }

  if (this.name) {
    this.name = this.name.trim();
  }
});

// Indexes
productSchema.index({ sku: 1 }, { unique: true });
productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ unit: 1 });
productSchema.index({ isActive: 1 });

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
