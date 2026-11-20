const { z } = require("zod");

// Validate MongoDB ObjectId
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid unit ID");

// Create unit
const createUnitSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Unit name must contain at least 2 characters")
      .max(50, "Unit name cannot exceed 50 characters"),

    symbol: z
      .string()
      .trim()
      .min(1, "Unit symbol is required")
      .max(10, "Unit symbol cannot exceed 10 characters"),
  }),

  params: z.object({}),
  query: z.object({}),
});

// Update unit
const updateUnitSchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(2, "Unit name must contain at least 2 characters")
        .max(50, "Unit name cannot exceed 50 characters")
        .optional(),

      symbol: z
        .string()
        .trim()
        .min(1, "Unit symbol is required")
        .max(10, "Unit symbol cannot exceed 10 characters")
        .optional(),

      isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required to update a unit",
    }),

  params: z.object({
    id: objectIdSchema,
  }),

  query: z.object({}),
});

// Get one unit
const getUnitSchema = z.object({
  body: z.object({}),

  params: z.object({
    id: objectIdSchema,
  }),

  query: z.object({}),
});

// List units
const listUnitsSchema = z.object({
  body: z.object({}),
  params: z.object({}),

  query: z.object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    search: z.string().trim().optional(),

    isActive: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  }),
});

module.exports = {
  createUnitSchema,
  updateUnitSchema,
  getUnitSchema,
  listUnitsSchema,
};
