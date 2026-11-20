const { z } = require("zod");

const setupAdminSchema = z.object({
  body: z.object({
    name: z
      .string()
      .trim()
      .min(3, "Name must contain at least 3 characters")
      .max(50, "Name cannot exceed 50 characters"),

    email: z
      .string()
      .trim()
      .email("Please provide a valid email address")
      .toLowerCase(),

    password: z
      .string()
      .min(8, "Password must contain at least 8 characters")
      .refine(
        (value) => Buffer.byteLength(value, "utf8") <= 72,
        "Password cannot exceed 72 bytes",
      ),
  }),

  params: z.object({}),
  query: z.object({}),
});

const loginSchema = z.object({
  body: z.object({
    email: z
      .string()
      .trim()
      .email("Please provide a valid email address")
      .toLowerCase(),

    password: z.string().min(1, "Password is required"),
  }),

  params: z.object({}),
  query: z.object({}),
});

module.exports = {
  setupAdminSchema,
  loginSchema,
};
