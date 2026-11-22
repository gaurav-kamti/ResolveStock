const { z } = require("zod");

// Validate MongoDB ObjectId.
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

// All supported movement types.
const movementTypes = [
  "opening",
  "purchase",
  "sale",
  "sales_return",
  "purchase_return",
  "adjustment_in",
  "adjustment_out",
];

// Movement types allowed through the public API.
const manualMovementTypes = ["opening", "adjustment_in", "adjustment_out"];

// Create stock movement.
const createMovementSchema = z.object({
  body: z.object({
    product: objectIdSchema,

    type: z.enum(manualMovementTypes),

    quantity: z
      .number()
      .finite("Quantity must be a valid number")
      .positive("Quantity must be greater than zero"),

    unitCost: z
      .number()
      .finite("Unit cost must be a valid number")
      .min(0, "Unit cost cannot be negative")
      .optional(),

    note: z
      .string()
      .trim()
      .max(500, "Note cannot exceed 500 characters")
      .optional(),
  }),

  params: z.object({}),
  query: z.object({}),
});

// Get inventory overview.
const getInventorySchema = z.object({
  body: z.object({}),
  params: z.object({}),

  query: z.object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    search: z
      .string()
      .trim()
      .max(100, "Search cannot exceed 100 characters")
      .optional(),

    category: objectIdSchema.optional(),

    lowStock: z
      .enum(["true", "false"])
      .optional()
      .transform((value) => value === "true"),
  }),
});

// Get stock for one product.
const getProductStockSchema = z.object({
  body: z.object({}),

  params: z.object({
    productId: objectIdSchema,
  }),

  query: z.object({}),
});

// Get stock movement history.
const getStockMovementsSchema = z.object({
  body: z.object({}),
  params: z.object({}),

  query: z.object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    product: objectIdSchema.optional(),

    type: z.enum(movementTypes).optional(),

    direction: z.enum(["in", "out"]).optional(),
  }),
});

module.exports = {
  createMovementSchema,
  getInventorySchema,
  getProductStockSchema,
  getStockMovementsSchema,
};
