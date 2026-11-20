const { z } = require("zod");

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  PORT: z.coerce.number().int().min(1).max(65535).default(5000),

  MONGODB_URI: z
    .string()
    .min(1, "MONGODB_URI is required")
    .refine(
      (value) => /^mongodb(\+srv)?:\/\//.test(value),
      "MONGODB_URI must be a valid MongoDB connection string",
    ),

  JWT_SECRET: z
    .string()
    .min(64, "JWT_SECRET must contain at least 64 characters"),

  JWT_EXPIRES_IN: z.string().min(1).default("1d"),

  ADMIN_SETUP_KEY: z
    .string()
    .min(64, "ADMIN_SETUP_KEY must contain at least 64 characters"),
});

const result = envSchema.safeParse(process.env);

if (!result.success) {
  console.error("\nInvalid environment configuration:\n");

  result.error.issues.forEach((issue) => {
    console.error(`- ${issue.path.join(".")}: ${issue.message}`);
  });

  process.exit(1);
}

module.exports = result.data;
