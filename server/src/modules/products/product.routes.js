const express = require("express");

const router = express.Router();

const {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
} = require("./product.controller");

const {
  createProductSchema,
  updateProductSchema,
  getProductSchema,
  listProductsSchema,
} = require("./product.validation");

const validate = require("../../middleware/validate.middleware");
const { protect } = require("../auth/auth.middleware");

// All product routes require authentication
router.use(protect);

// Create product
router.post("/", validate(createProductSchema), createProduct);

// Get all products
router.get("/", validate(listProductsSchema), getProducts);

// Get one product
router.get("/:id", validate(getProductSchema), getProduct);

// Update product
router.patch("/:id", validate(updateProductSchema), updateProduct);

module.exports = router;
