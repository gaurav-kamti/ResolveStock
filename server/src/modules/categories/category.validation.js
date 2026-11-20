const { z } = require("zod");

// Validate MongoDB ObjectId
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid category ID");

// Create category
const createCategorySchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(2, "Category name must contain at least 2 characters")
      .max(50, "Category name cannot exceed 50 characters"),

    description: z
      .string()
      .trim()
      .max(250, "Description cannot exceed 250 characters")
      .optional(),
  }),

  params: z.object({}),
  query: z.object({}),
});

// Update category
const updateCategorySchema = z.object({
  body: z
    .object({
      name: z
        .string()
        .trim()
        .min(2, "Category name must contain at least 2 characters")
        .max(50, "Category name cannot exceed 50 characters")
        .optional(),

      description: z
        .string()
        .trim()
        .max(250, "Description cannot exceed 250 characters")
        .optional(),

      isActive: z.boolean().optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required to update a category",
    }),

  params: z.object({
    id: objectIdSchema,
  }),

  query: z.object({}),
});

// Get one category
const getCategorySchema = z.object({
  body: z.object({}),

  params: z.object({
    id: objectIdSchema,
  }),

  query: z.object({}),
});

// List categories
const listCategoriesSchema = z.object({
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
  createCategorySchema,
  updateCategorySchema,
  getCategorySchema,
  listCategoriesSchema,
};
