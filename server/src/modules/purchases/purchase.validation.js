const { z } = require("zod");

// Validate MongoDB ObjectId.
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

// Validate individual purchase items.
const purchaseItemSchema = z.object({
  product: objectIdSchema,

  quantity: z
    .number()
    .finite("Quantity must be a valid number")
    .positive("Quantity must be greater than zero"),

  unitPrice: z
    .number()
    .finite("Unit price must be a valid number")
    .min(0, "Unit price cannot be negative"),

  discountAmount: z
    .number()
    .finite("Discount must be a valid number")
    .min(0, "Discount cannot be negative")
    .default(0),

  gstRate: z
    .number()
    .finite("GST rate must be a valid number")
    .min(0, "GST rate cannot be negative")
    .max(100, "GST rate cannot exceed 100")
    .optional(),
});

// Create purchase validation.
const createPurchaseSchema = z.object({
  body: z.object({
    supplier: objectIdSchema,

    supplierInvoiceNumber: z
      .string()
      .trim()
      .max(100, "Supplier invoice number cannot exceed 100 characters")
      .optional()
      .default(""),

    purchaseDate: z.iso.datetime({ offset: true }).optional(),

    items: z
      .array(purchaseItemSchema)
      .min(1, "A purchase must contain at least one product"),

    notes: z
      .string()
      .trim()
      .max(1000, "Notes cannot exceed 1000 characters")
      .optional()
      .default(""),
  }),

  params: z.object({}),
  query: z.object({}),
});

// Get purchase by ID.
const getPurchaseByIdSchema = z.object({
  body: z.object({}),
  params: z.object({
    purchaseId: objectIdSchema,
  }),
  query: z.object({}),
});

// Get purchases with filters and pagination.
const getPurchasesSchema = z.object({
  body: z.object({}),
  params: z.object({}),
  query: z.object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    supplier: objectIdSchema.optional(),

    status: z.enum(["draft", "received", "cancelled"]).optional(),

    search: z.string().trim().max(100).optional(),

    startDate: z.iso.date().optional(),

    endDate: z.iso.date().optional(),
  }),
});

// Receive a draft purchase.
const receivePurchaseSchema = z.object({
  body: z.object({}),
  params: z.object({
    purchaseId: objectIdSchema,
  }),
  query: z.object({}),
});

// Cancel a purchase.
const cancelPurchaseSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .trim()
      .max(500, "Cancellation reason cannot exceed 500 characters")
      .optional()
      .default(""),
  }),
  params: z.object({
    purchaseId: objectIdSchema,
  }),
  query: z.object({}),
});

module.exports = {
  createPurchaseSchema,
  getPurchaseByIdSchema,
  getPurchasesSchema,
  receivePurchaseSchema,
  cancelPurchaseSchema,
};
