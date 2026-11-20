const Product = require("./models/product.model");
const Category = require("../categories/models/category.model");
const Unit = require("../units/models/unit.model");

const ApiError = require("../../utils/ApiError");

// Escape special regex characters in search text
const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Populate category and unit details
const populateProduct = (query) => {
  return query.populate("category", "name").populate("unit", "name symbol");
};

// Check whether category and unit exist and are active
const validateReferences = async (categoryId, unitId) => {
  const [category, unit] = await Promise.all([
    Category.findOne({
      _id: categoryId,
      isActive: true,
    }),

    Unit.findOne({
      _id: unitId,
      isActive: true,
    }),
  ]);

  if (!category) {
    throw new ApiError(400, "Category not found or inactive.");
  }

  if (!unit) {
    throw new ApiError(400, "Unit not found or inactive.");
  }
};

// Check for duplicate SKU
const checkDuplicateSku = async (sku, excludeId = null) => {
  const filter = {
    sku: sku.trim().toUpperCase(),
  };

  if (excludeId) {
    filter._id = { $ne: excludeId };
  }

  const existingProduct = await Product.findOne(filter);

  if (existingProduct) {
    throw new ApiError(409, "A product with this SKU already exists.");
  }
};

// Handle MongoDB duplicate key errors
const handleDuplicateError = (error, next) => {
  if (error.code === 11000) {
    return next(new ApiError(409, "A product with this SKU already exists."));
  }

  return next(error);
};

// Create product
const createProduct = async (req, res, next) => {
  try {
    const productData = req.validated.body;

    await validateReferences(productData.category, productData.unit);

    await checkDuplicateSku(productData.sku);

    const product = await Product.create(productData);

    await product.populate([
      { path: "category", select: "name" },
      { path: "unit", select: "name symbol" },
    ]);

    return res.status(201).json({
      success: true,
      message: "Product created successfully.",
      data: { product },
    });
  } catch (error) {
    return handleDuplicateError(error, next);
  }
};

// Get all products
const getProducts = async (req, res, next) => {
  try {
    const { page, limit, search, category, unit, isActive } =
      req.validated.query;

    const filter = {};

    if (category) {
      filter.category = category;
    }

    if (unit) {
      filter.unit = unit;
    }

    if (typeof isActive === "boolean") {
      filter.isActive = isActive;
    }

    if (search) {
      const searchRegex = {
        $regex: escapeRegex(search),
        $options: "i",
      };

      filter.$or = [
        { name: searchRegex },
        { sku: searchRegex },
        { description: searchRegex },
      ];
    }

    const skip = (page - 1) * limit;

    const [products, totalProducts] = await Promise.all([
      populateProduct(
        Product.find(filter).sort({ name: 1 }).skip(skip).limit(limit),
      ),

      Product.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Products fetched successfully.",
      data: {
        products,
        pagination: {
          currentPage: page,
          limit,
          totalProducts,
          totalPages: Math.ceil(totalProducts / limit),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get a single product
const getProduct = async (req, res, next) => {
  try {
    const { id } = req.validated.params;

    const product = await populateProduct(Product.findById(id));

    if (!product) {
      throw new ApiError(404, "Product not found.");
    }

    return res.status(200).json({
      success: true,
      message: "Product fetched successfully.",
      data: { product },
    });
  } catch (error) {
    return next(error);
  }
};

// Update product
const updateProduct = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const updates = req.validated.body;

    const product = await Product.findById(id);

    if (!product) {
      throw new ApiError(404, "Product not found.");
    }

    // Check SKU only when it is being updated
    if (updates.sku) {
      await checkDuplicateSku(updates.sku, id);
    }

    // Validate category and unit only when supplied
    if (updates.category || updates.unit) {
      await validateReferences(
        updates.category || product.category,
        updates.unit || product.unit,
      );
    }

    Object.assign(product, updates);

    await product.save();

    await product.populate([
      { path: "category", select: "name" },
      { path: "unit", select: "name symbol" },
    ]);

    return res.status(200).json({
      success: true,
      message: "Product updated successfully.",
      data: { product },
    });
  } catch (error) {
    return handleDuplicateError(error, next);
  }
};

module.exports = {
  createProduct,
  getProducts,
  getProduct,
  updateProduct,
};
