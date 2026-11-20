const { z } = require("zod");

// Validate MongoDB ObjectId
const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid party ID");

// Reusable field validations
const partyFields = {
  name: z
    .string()
    .trim()
    .min(2, "Party name must contain at least 2 characters")
    .max(100, "Party name cannot exceed 100 characters"),

  type: z.enum(["customer", "supplier", "both"], {
    message: "Party type must be customer, supplier, or both",
  }),

  phone: z.string().trim().max(20, "Phone number cannot exceed 20 characters"),

  email: z.union([
    z.string().trim().max(100).email("Invalid email address"),
    z.literal(""),
  ]),

  gstin: z.union([
    z
      .string()
      .trim()
      .regex(
        /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/i,
        "Invalid GSTIN format",
      ),
    z.literal(""),
  ]),

  address: z.string().trim().max(300, "Address cannot exceed 300 characters"),

  city: z.string().trim().max(100, "City cannot exceed 100 characters"),

  state: z.string().trim().max(100, "State cannot exceed 100 characters"),

  pincode: z.union([
    z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Pincode must contain exactly 6 digits"),
    z.literal(""),
  ]),

  openingBalance: z
    .number()
    .finite("Opening balance must be a valid number")
    .min(0, "Opening balance cannot be negative"),

  openingBalanceType: z.enum(["receivable", "payable", "none"], {
    message: "Invalid opening balance type",
  }),

  isActive: z.boolean(),
};

// Validate opening balance and its type together
const validateOpeningBalance = (data) => {
  const balance = data.openingBalance ?? 0;
  const balanceType = data.openingBalanceType ?? "none";

  return (
    (balance === 0 && balanceType === "none") ||
    (balance > 0 && ["receivable", "payable"].includes(balanceType))
  );
};

// Create party
const createPartySchema = z.object({
  body: z
    .object({
      name: partyFields.name,
      type: partyFields.type,

      phone: partyFields.phone.optional(),
      email: partyFields.email.optional(),
      gstin: partyFields.gstin.optional(),

      address: partyFields.address.optional(),
      city: partyFields.city.optional(),
      state: partyFields.state.optional(),
      pincode: partyFields.pincode.optional(),

      openingBalance: partyFields.openingBalance.optional(),
      openingBalanceType: partyFields.openingBalanceType.optional(),
    })
    .refine(validateOpeningBalance, {
      message:
        "A positive opening balance requires receivable or payable type. A zero balance requires none.",
      path: ["openingBalanceType"],
    }),

  params: z.object({}),
  query: z.object({}),
});

// Update party
const updatePartySchema = z.object({
  body: z
    .object({
      name: partyFields.name.optional(),
      type: partyFields.type.optional(),

      phone: partyFields.phone.optional(),
      email: partyFields.email.optional(),
      gstin: partyFields.gstin.optional(),

      address: partyFields.address.optional(),
      city: partyFields.city.optional(),
      state: partyFields.state.optional(),
      pincode: partyFields.pincode.optional(),

      openingBalance: partyFields.openingBalance.optional(),
      openingBalanceType: partyFields.openingBalanceType.optional(),

      isActive: partyFields.isActive.optional(),
    })
    .refine((data) => Object.keys(data).length > 0, {
      message: "At least one field is required to update a party",
    })
    .refine(
      (data) => "openingBalance" in data === "openingBalanceType" in data,
      {
        message:
          "Opening balance and opening balance type must be updated together",
        path: ["openingBalanceType"],
      },
    )
    .refine(
      (data) => !("openingBalance" in data) || validateOpeningBalance(data),
      {
        message: "Invalid opening balance and balance type combination",
        path: ["openingBalanceType"],
      },
    ),

  params: z.object({
    id: objectIdSchema,
  }),

  query: z.object({}),
});

// Get one party
const getPartySchema = z.object({
  body: z.object({}),

  params: z.object({
    id: objectIdSchema,
  }),

  query: z.object({}),
});

// List parties
const listPartiesSchema = z.object({
  body: z.object({}),
  params: z.object({}),

  query: z.object({
    page: z.coerce.number().int().min(1).default(1),

    limit: z.coerce.number().int().min(1).max(100).default(20),

    search: z.string().trim().optional(),

    type: z.enum(["customer", "supplier", "both"]).optional(),

    isActive: z
      .enum(["true", "false"])
      .transform((value) => value === "true")
      .optional(),
  }),
});

module.exports = {
  createPartySchema,
  updatePartySchema,
  getPartySchema,
  listPartiesSchema,
};
