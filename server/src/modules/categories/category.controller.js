const Category = require("./models/category.model");
const ApiError = require("../../utils/ApiError");

// Check whether MongoDB reports a duplicate key
const isDuplicateKeyError = (error) => error.code === 11000;

// Escape special regex characters in search text
const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Create category
const createCategory = async (req, res, next) => {
  try {
    const { name, description } = req.validated.body;

    const normalizedName = name.trim().toLowerCase();

    const existingCategory = await Category.findOne({ normalizedName });

    if (existingCategory) {
      throw new ApiError(409, "A category with this name already exists.");
    }

    const category = await Category.create({
      name,
      description,
    });

    return res.status(201).json({
      success: true,
      message: "Category created successfully.",
      data: { category },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return next(
        new ApiError(409, "A category with this name already exists."),
      );
    }

    return next(error);
  }
};

// Get all categories
const getCategories = async (req, res, next) => {
  try {
    const { page, limit, search, isActive } = req.validated.query;

    const filter = {};

    if (typeof isActive === "boolean") {
      filter.isActive = isActive;
    }

    if (search) {
      filter.name = {
        $regex: escapeRegex(search),
        $options: "i",
      };
    }

    const skip = (page - 1) * limit;

    const [categories, totalCategories] = await Promise.all([
      Category.find(filter).sort({ name: 1 }).skip(skip).limit(limit),

      Category.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Categories fetched successfully.",
      data: {
        categories,
        pagination: {
          currentPage: page,
          limit,
          totalCategories,
          totalPages: Math.ceil(totalCategories / limit),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get a single category
const getCategory = async (req, res, next) => {
  try {
    const { id } = req.validated.params;

    const category = await Category.findById(id);

    if (!category) {
      throw new ApiError(404, "Category not found.");
    }

    return res.status(200).json({
      success: true,
      message: "Category fetched successfully.",
      data: { category },
    });
  } catch (error) {
    return next(error);
  }
};

// Update category
const updateCategory = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const updates = req.validated.body;

    const category = await Category.findById(id);

    if (!category) {
      throw new ApiError(404, "Category not found.");
    }

    // Check for duplicate names when the name is being changed
    if (updates.name) {
      const normalizedName = updates.name.trim().toLowerCase();

      const existingCategory = await Category.findOne({
        normalizedName,
        _id: { $ne: id },
      });

      if (existingCategory) {
        throw new ApiError(409, "A category with this name already exists.");
      }
    }

    Object.assign(category, updates);

    try {
      await category.save();
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ApiError(409, "A category with this name already exists.");
      }

      throw error;
    }

    return res.status(200).json({
      success: true,
      message: "Category updated successfully.",
      data: { category },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createCategory,
  getCategories,
  getCategory,
  updateCategory,
};
