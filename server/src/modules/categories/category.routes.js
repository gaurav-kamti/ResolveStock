const express = require("express");

const router = express.Router();

const {
  createCategory,
  getCategories,
  getCategory,
  updateCategory,
} = require("./category.controller");

const {
  createCategorySchema,
  updateCategorySchema,
  getCategorySchema,
  listCategoriesSchema,
} = require("./category.validation");

const validate = require("../../middleware/validate.middleware");
const { protect } = require("../auth/auth.middleware");

// All category routes require authentication
router.use(protect);

// Create category
router.post("/", validate(createCategorySchema), createCategory);

// Get all categories
router.get("/", validate(listCategoriesSchema), getCategories);

// Get one category
router.get("/:id", validate(getCategorySchema), getCategory);

// Update category
router.patch("/:id", validate(updateCategorySchema), updateCategory);

module.exports = router;
