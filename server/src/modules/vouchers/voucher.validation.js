const { z } = require("zod");

// Validate MongoDB ObjectId.
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

// Validate individual bill allocations.
const voucherAllocationSchema = z.object({
  documentType: z.enum(["purchase", "sales"]),

  documentId: objectIdSchema,

  allocatedAmount: z
    .number()
    .finite("Allocated amount must be a valid number")
    .positive("Allocated amount must be greater than zero"),
});

// Validate voucher creation.
const createVoucherSchema = z.object({
  body: z
    .object({
      voucherType: z.enum(["payment", "receipt"], {
        error: "Voucher type must be payment or receipt",
      }),

      party: objectIdSchema,

      voucherDate: z.iso.datetime({ offset: true }).optional(),

      amount: z
        .number()
        .finite("Amount must be a valid number")
        .positive("Amount must be greater than zero"),

      paymentMethod: z.enum([
        "cash",
        "bank_transfer",
        "upi",
        "cheque",
        "other",
      ]),

      allocationMode: z.enum(["against_bill", "on_account", "advance"]),

      allocations: z.array(voucherAllocationSchema).optional().default([]),

      referenceNumber: z
        .string()
        .trim()
        .max(100, "Reference number cannot exceed 100 characters")
        .optional()
        .default(""),

      bankName: z
        .string()
        .trim()
        .max(100, "Bank name cannot exceed 100 characters")
        .optional()
        .default(""),

      chequeNumber: z
        .string()
        .trim()
        .max(100, "Cheque number cannot exceed 100 characters")
        .optional()
        .default(""),

      chequeDate: z.iso.datetime({ offset: true }).optional(),

      notes: z
        .string()
        .trim()
        .max(1000, "Notes cannot exceed 1000 characters")
        .optional()
        .default(""),
    })
    .superRefine((data, ctx) => {
      // Against Bill requires at least one allocation.
      if (
        data.allocationMode === "against_bill" &&
        data.allocations.length === 0
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["allocations"],
          message: "Select at least one bill for Against Bill",
        });
      }

      // On Account and Advance allocations are calculated or applied
      // separately by the service layer.
      if (
        data.allocationMode !== "against_bill" &&
        data.allocations.length > 0
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["allocations"],
          message: "Manual bill allocations are only allowed for Against Bill",
        });
      }

      // Payment vouchers must allocate against purchase bills.
      if (data.voucherType === "payment") {
        data.allocations.forEach((allocation, index) => {
          if (allocation.documentType !== "purchase") {
            ctx.addIssue({
              code: "custom",
              path: ["allocations", index, "documentType"],
              message:
                "Payment vouchers can only allocate against purchase bills",
            });
          }
        });
      }

      // Receipt vouchers must allocate against sales invoices.
      if (data.voucherType === "receipt") {
        data.allocations.forEach((allocation, index) => {
          if (allocation.documentType !== "sales") {
            ctx.addIssue({
              code: "custom",
              path: ["allocations", index, "documentType"],
              message:
                "Receipt vouchers can only allocate against sales invoices",
            });
          }
        });
      }

      // Prevent the same bill from appearing more than once.
      const documentIds = data.allocations.map(
        (allocation) => `${allocation.documentType}:${allocation.documentId}`,
      );

      if (new Set(documentIds).size !== documentIds.length) {
        ctx.addIssue({
          code: "custom",
          path: ["allocations"],
          message: "A bill cannot be selected more than once",
        });
      }

      // Against Bill must allocate the entire voucher amount.
      if (data.allocationMode === "against_bill") {
        const allocatedTotal = data.allocations.reduce(
          (total, allocation) => total + allocation.allocatedAmount,
          0,
        );

        if (
          Math.round(allocatedTotal * 100) !== Math.round(data.amount * 100)
        ) {
          ctx.addIssue({
            code: "custom",
            path: ["allocations"],
            message: "Total bill allocations must equal the voucher amount",
          });
        }
      }

      // Cheque number is required when payment method is cheque.
      if (data.paymentMethod === "cheque" && !data.chequeNumber.trim()) {
        ctx.addIssue({
          code: "custom",
          path: ["chequeNumber"],
          message: "Cheque number is required for cheque payments",
        });
      }
    }),

  params: z.object({}),
  query: z.object({}),
});

// Validate voucher ID.
const getVoucherByIdSchema = z.object({
  body: z.object({}),

  params: z.object({
    voucherId: objectIdSchema,
  }),

  query: z.object({}),
});

// Validate voucher listing with filters and pagination.
const getVouchersSchema = z.object({
  body: z.object({}),
  params: z.object({}),

  query: z.object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    voucherType: z.enum(["payment", "receipt"]).optional(),

    party: objectIdSchema.optional(),

    status: z.enum(["posted", "cancelled"]).optional(),

    search: z.string().trim().max(100).optional(),

    startDate: z.iso.date().optional(),

    endDate: z.iso.date().optional(),
  }),
});

// Validate voucher cancellation.
const cancelVoucherSchema = z.object({
  body: z.object({
    reason: z
      .string()
      .trim()
      .max(500, "Cancellation reason cannot exceed 500 characters")
      .optional()
      .default(""),
  }),

  params: z.object({
    voucherId: objectIdSchema,
  }),

  query: z.object({}),
});

module.exports = {
  createVoucherSchema,
  getVoucherByIdSchema,
  getVouchersSchema,
  cancelVoucherSchema,
};
