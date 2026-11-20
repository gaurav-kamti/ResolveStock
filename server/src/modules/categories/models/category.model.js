const mongoose = require("mongoose");

const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Category name is required"],
      trim: true,
      minlength: [2, "Category name must contain at least 2 characters"],
      maxlength: [50, "Category name cannot exceed 50 characters"],
    },

    // Used to prevent duplicate names regardless of letter casing
    normalizedName: {
      type: String,
      required: true,
    },

    description: {
      type: String,
      trim: true,
      maxlength: [250, "Description cannot exceed 250 characters"],
      default: "",
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

// Generate normalized name before validation
categorySchema.pre("validate", function () {
  if (this.name) {
    this.normalizedName = this.name.trim().toLowerCase();
  }
});

// Prevent duplicate category names
categorySchema.index(
  { normalizedName: 1 },
  {
    unique: true,
    name: "unique_category_name",
  },
);

const Category = mongoose.model("Category", categorySchema);

module.exports = Category;
