const Unit = require("./models/unit.model");
const ApiError = require("../../utils/ApiError");

// Check whether MongoDB reports a duplicate key
const isDuplicateKeyError = (error) => error.code === 11000;

// Escape special regex characters in search text
const escapeRegex = (value) => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

// Create unit
const createUnit = async (req, res, next) => {
  try {
    const { name, symbol } = req.validated.body;

    const normalizedName = name.trim().toLowerCase();
    const normalizedSymbol = symbol.trim().toLowerCase();

    const existingUnit = await Unit.findOne({
      $or: [{ normalizedName }, { normalizedSymbol }],
    });

    if (existingUnit) {
      throw new ApiError(
        409,
        "A unit with this name or symbol already exists.",
      );
    }

    const unit = await Unit.create({
      name,
      symbol,
    });

    return res.status(201).json({
      success: true,
      message: "Unit created successfully.",
      data: { unit },
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      return next(
        new ApiError(409, "A unit with this name or symbol already exists."),
      );
    }

    return next(error);
  }
};

// Get all units
const getUnits = async (req, res, next) => {
  try {
    const { page, limit, search, isActive } = req.validated.query;

    const filter = {};

    if (typeof isActive === "boolean") {
      filter.isActive = isActive;
    }

    if (search) {
      const searchRegex = {
        $regex: escapeRegex(search),
        $options: "i",
      };

      filter.$or = [{ name: searchRegex }, { symbol: searchRegex }];
    }

    const skip = (page - 1) * limit;

    const [units, totalUnits] = await Promise.all([
      Unit.find(filter).sort({ name: 1 }).skip(skip).limit(limit),

      Unit.countDocuments(filter),
    ]);

    return res.status(200).json({
      success: true,
      message: "Units fetched successfully.",
      data: {
        units,
        pagination: {
          currentPage: page,
          limit,
          totalUnits,
          totalPages: Math.ceil(totalUnits / limit),
        },
      },
    });
  } catch (error) {
    return next(error);
  }
};

// Get a single unit
const getUnit = async (req, res, next) => {
  try {
    const { id } = req.validated.params;

    const unit = await Unit.findById(id);

    if (!unit) {
      throw new ApiError(404, "Unit not found.");
    }

    return res.status(200).json({
      success: true,
      message: "Unit fetched successfully.",
      data: { unit },
    });
  } catch (error) {
    return next(error);
  }
};

// Update unit
const updateUnit = async (req, res, next) => {
  try {
    const { id } = req.validated.params;
    const updates = req.validated.body;

    const unit = await Unit.findById(id);

    if (!unit) {
      throw new ApiError(404, "Unit not found.");
    }

    // Check duplicate name or symbol if either is being changed
    const duplicateConditions = [];

    if (updates.name) {
      duplicateConditions.push({
        normalizedName: updates.name.trim().toLowerCase(),
      });
    }

    if (updates.symbol) {
      duplicateConditions.push({
        normalizedSymbol: updates.symbol.trim().toLowerCase(),
      });
    }

    if (duplicateConditions.length > 0) {
      const existingUnit = await Unit.findOne({
        $or: duplicateConditions,
        _id: { $ne: id },
      });

      if (existingUnit) {
        throw new ApiError(
          409,
          "A unit with this name or symbol already exists.",
        );
      }
    }

    Object.assign(unit, updates);

    try {
      await unit.save();
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ApiError(
          409,
          "A unit with this name or symbol already exists.",
        );
      }

      throw error;
    }

    return res.status(200).json({
      success: true,
      message: "Unit updated successfully.",
      data: { unit },
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  createUnit,
  getUnits,
  getUnit,
  updateUnit,
};
