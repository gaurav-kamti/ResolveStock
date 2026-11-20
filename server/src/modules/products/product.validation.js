const { z } = require("zod");

// Validate MongoDB ObjectId
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

// Reusable field validations
const productFields = {
  name: z
    .string()
    .trim()
    .min(2, "Product name must contain at least 2 characters")
    .max(150, "Product name cannot exceed 150 characters"),

  sku: z
    .string()
    .trim()
    .min(2, "SKU must contain at least 2 characters")
    .max(50, "SKU cannot exceed 50 characters")
    .regex(
      /^[a-zA-Z0-9_-]+$/,
      "SKU can only contain letters, numbers, hyphens, and underscores",
    ),

  description: z
    .string()
    .trim()
    .max(500, "Description cannot exceed 500 characters"),

  category: objectIdSchema,

  unit: objectIdSchema,

  purchasePrice: z
    .number()
    .finite("Purchase price must be a valid number")
    .min(0, "Purchase price cannot be negative"),

  sellingPrice: z
    .number()
    .finite("Selling price must be a valid number")
    .min(0, "Selling price cannot be negative"),

  gstRate: z
    .number()
    .finite("GST rate must be a valid number")
    .min(0, "GST rate cannot be negative")
    .max(100, "GST rate cannot exceed 100"),

  minimumStockLevel: z
    .number()
    .finite("Minimum stock level must be a valid number")
    .min(0, "Minimum stock level cannot be negative"),

  isActive: z.boolean(),
};

// Create product
const createProductSchema = z.object({
  body: z.object({
    name: productFields.name,
    sku: productFields.sku,

    description: productFields.description.optional(),

    category: productFields.category,
    unit: productFields.unit,

    purchasePrice: productFields.purchasePrice,
    sellingPrice: productFields.sellingPrice,

    gstRate: productFields.gstRate.optional(),
    minimumStockLevel: productFields.minimumStockLevel.optional(),
  }),

  params: z.object({}),
  query: z.object({}),
});

// Update product
const updateProductSchema = z.object({
  body: z
    .object({
      name: productFields.name.optional(),
      sku: productFields.sku.optional(),

      description: productFields.description.optional(),

      category: productFields.category.optional(),
      unit: productFields.unit.optional(),

      purchasePrice: productFields.purchasePrice.optional(),
      sellingPrice: productFields.sellingPrice.optional(),

      gstRate: productFields.gstRate.optional(),
      minimumStockLevel: productFields.minimumStockLevel.optional(),

      isActive: productFields.isActive.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required to update a product",
    }),

  params: z.object({
    id: objectIdSchema,
  }),

  query: z.object({}),
});

// Get one product
const getProductSchema = z.object({
  body: z.object({}),

  params: z.object({
    id: objectIdSchema,
  }),

  query: z.object({}),
});

// List products
const listProductsSchema = z.object({
  body: z.object({}),
  params: z.object({}),

  query: z.object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    search: z.string().trim().optional(),

    category: objectIdSchema.optional(),

    unit: objectIdSchema.optional(),

    isActive: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  }),
});

module.exports = {
  createProductSchema,
  updateProductSchema,
  getProductSchema,
  listProductsSchema,
};
