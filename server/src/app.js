const express = require("express");
const cors = require("cors");

const notFound = require("./middleware/notFound.middleware");
const errorHandler = require("./middleware/error.middleware");

const testRoutes = require("./modules/test/test.routes");
const healthRoutes = require("./modules/health/health.routes");
const authRoutes = require("./modules/auth/auth.routes");
const categoryRoutes = require("./modules/categories/category.routes");
const unitRoutes = require("./modules/units/unit.routes");
const partyRoutes = require("./modules/parties/party.routes");
const productRoutes = require("./modules/products/product.routes");
const inventoryRoutes = require("./modules/inventory/inventory.routes");
const purchaseRoutes = require("./modules/purchases/purchase.routes");

const app = express();

// Global middleware
app.use(cors());
app.use(express.json({ limit: "1mb" }));

// Root route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "ResolveStock API is running!",
  });
});

// Health routes
app.use("/api/health", healthRoutes);

// Test routes
app.use("/api/test", testRoutes);

// Authentication routes
app.use("/api/auth", authRoutes);

// Category routes
app.use("/api/categories", categoryRoutes);

// Unit routes
app.use("/api/units", unitRoutes);

// Parties routes
app.use("/api/parties", partyRoutes);

// Product routes
app.use("/api/products", productRoutes);

// Inventory routes
app.use("/api/inventory", inventoryRoutes);

// Purchase routes
app.use("/api/purchases", purchaseRoutes);

// Handle unknown routes
app.use(notFound);

// Centralized error handler
app.use(errorHandler);

module.exports = app;
